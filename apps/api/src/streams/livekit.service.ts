import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

import { env } from '../config/env';

/**
 * LiveKit Cloud wrapper (ADR 0004). Keys are owner-blocked (docs/deferred.md):
 * until LIVEKIT_* env vars are set, token minting 503s with a clear message —
 * everything else in Phase 4 (chat, presence, lifecycle) works without video.
 */
@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly rooms =
    env.LIVEKIT_URL && env.LIVEKIT_API_KEY
      ? new RoomServiceClient(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET)
      : null;

  get configured(): boolean {
    return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
  }

  /** Short-lived join token, minted ONLY after an entitlement check upstream. */
  async mintToken(room: string, identity: string, name: string, publisher: boolean) {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'live video is not configured yet (LIVEKIT_* env vars — see docs/deferred.md)',
      );
    }
    const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity,
      name,
      ttl: 120, // seconds — a door key, not a session (ADR 0004)
    });
    token.addGrant({
      room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: publisher,
      canPublishData: publisher,
      roomAdmin: publisher,
    });
    return { token: await token.toJwt(), url: env.LIVEKIT_URL };
  }

  async createRoom(name: string): Promise<void> {
    if (!this.rooms) return; // chat-only mode
    await this.rooms.createRoom({ name, emptyTimeout: 60 });
  }

  async deleteRoom(name: string): Promise<void> {
    if (!this.rooms) return;
    try {
      await this.rooms.deleteRoom(name);
    } catch (error) {
      this.logger.warn(`deleteRoom(${name}) failed: ${String(error)}`);
    }
  }
}
