import { io, type Socket } from 'socket.io-client';

import { API_BASE, tokenStore } from './api';

export function connectRealtime(): Socket {
  return io(`${API_BASE}/rt`, {
    auth: { token: tokenStore.getAccess() },
    transports: ['websocket'],
  });
}

export type Ack = { ok: true } | { ok: false; error: string };

export function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<Ack> {
  return new Promise((resolve) => {
    socket.timeout(5000).emit(event, payload, (err: Error | null, ack: Ack) => {
      resolve(err ? { ok: false, error: 'timeout' } : ack);
    });
  });
}
