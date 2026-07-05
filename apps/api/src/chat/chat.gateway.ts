import { chatSendSchema, streamJoinSchema, type ChatMessage } from '@grid/shared';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import type { AccessTokenPayload } from '../auth/current-user.decorator';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../streams/entitlement.service';
import { ChatService } from './chat.service';

interface SocketData {
  user: AccessTokenPayload;
  level: number;
  joined: Set<string>;
}

type Ack = { ok: true } | { ok: false; error: string };

/**
 * Realtime gateway (namespace /rt). Payloads validated with the shared zod
 * contract on BOTH sides (§3.6); gated streams enforce entitlement on join —
 * chat is part of the gate (§3.4). Money never moves here (§3.1): gifts are
 * HTTP, the socket only ever broadcasts results.
 */
@WebSocketGateway({
  namespace: '/rt',
  cors: { origin: env.CORS_ORIGINS.split(',') },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly chat: ChatService,
    private readonly prisma: PrismaService,
    private readonly entitlement: EntitlementService,
  ) {}

  afterInit(server: Server) {
    this.chat.bindServer(server);
  }

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('missing token');
      const user = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      const profile = await this.prisma.creatorProfile.findUnique({
        where: { userId: user.sub },
        select: { level: true },
      });
      (socket.data as SocketData).user = user;
      (socket.data as SocketData).level = profile?.level ?? 0;
      (socket.data as SocketData).joined = new Set();
    } catch {
      socket.emit('error', 'unauthorized');
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const data = socket.data as SocketData;
    for (const streamId of data.joined ?? []) {
      await this.chat.viewerLeft(streamId);
    }
  }

  @SubscribeMessage('stream:join')
  async onJoin(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    const data = socket.data as SocketData;
    const parsed = streamJoinSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'invalid payload' };
    const { streamId } = parsed.data;
    if (data.joined.has(streamId)) return { ok: true };

    const stream = await this.prisma.stream.findUnique({ where: { id: streamId } });
    if (!stream || stream.status !== 'LIVE') return { ok: false, error: 'stream is not live' };
    if (!(await this.entitlement.check(stream, data.user.sub))) {
      return { ok: false, error: 'not entitled' }; // §3.4: the gate covers chat too
    }

    await socket.join(`stream:${streamId}`);
    data.joined.add(streamId);
    await this.chat.viewerJoined(streamId);
    this.chat.broadcastPresence(streamId, data.user.sub, data.user.handle, 'join');
    return { ok: true };
  }

  @SubscribeMessage('stream:leave')
  async onLeave(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    const data = socket.data as SocketData;
    const parsed = streamJoinSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'invalid payload' };
    const { streamId } = parsed.data;
    if (!data.joined.delete(streamId)) return { ok: true };
    await socket.leave(`stream:${streamId}`);
    await this.chat.viewerLeft(streamId);
    return { ok: true };
  }

  @SubscribeMessage('chat:send')
  async onChatSend(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack> {
    const data = socket.data as SocketData;
    const parsed = chatSendSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'invalid payload' };
    const { streamId, body: text } = parsed.data;

    if (!data.joined.has(streamId)) return { ok: false, error: 'join the stream first' };
    if (!(await this.chat.allowMessage(data.user.sub))) {
      return { ok: false, error: 'slow down' };
    }

    const message: ChatMessage = {
      streamId,
      messageId: this.chat.mintMessageId(),
      senderId: data.user.sub,
      senderHandle: data.user.handle,
      senderLevel: data.level,
      body: text,
      sentAt: new Date().toISOString(),
    };
    await this.chat.publishMessage(message);
    return { ok: true };
  }
}
