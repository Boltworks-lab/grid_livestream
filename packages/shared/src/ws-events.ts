import { z } from 'zod';

/**
 * WebSocket event contract (Socket.IO). Phase 1 deliverable — implemented by the
 * api chat gateway in Phase 4. Every payload is validated with these schemas on
 * BOTH sides (PROJECT_BRIEF §3.6); the server is authoritative for anything the
 * client could lie about (§3.2), so client→server payloads carry no prices,
 * balances, or identities beyond the authenticated socket.
 *
 * Rooms: sockets join `stream:{streamId}`. Server→client events broadcast to the
 * room; client→server events are acknowledged with `{ ok: true } | { ok: false,
 * error }`.
 */

// ── client → server ────────────────────────────────────────────────────────

export const chatSendSchema = z.object({
  streamId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});
export type ChatSend = z.infer<typeof chatSendSchema>;

export const streamJoinSchema = z.object({
  streamId: z.string().uuid(),
});
export type StreamJoin = z.infer<typeof streamJoinSchema>;

// gift sending is an HTTP POST (money moves in the ledger, §3.1) — the WS layer
// only broadcasts the resulting event; there is deliberately no `gift:send` here.

// ── server → client ────────────────────────────────────────────────────────

export const chatMessageSchema = z.object({
  streamId: z.string().uuid(),
  messageId: z.string(),
  senderId: z.string().uuid(),
  senderHandle: z.string(),
  senderLevel: z.number().int().nonnegative(),
  body: z.string(),
  sentAt: z.string(), // ISO 8601
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatMessageRemovedSchema = z.object({
  streamId: z.string().uuid(),
  messageId: z.string(),
});
export type ChatMessageRemoved = z.infer<typeof chatMessageRemovedSchema>;

export const giftSentSchema = z.object({
  streamId: z.string().uuid(),
  giftId: z.string(),
  giftName: z.string(),
  emoji: z.string().optional(),
  animationTier: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
  senderId: z.string().uuid(),
  senderHandle: z.string(),
  /** consecutive sends of the same gift by the same sender (combo counter) */
  combo: z.number().int().positive().default(1),
  sentAt: z.string(),
});
export type GiftSent = z.infer<typeof giftSentSchema>;

export const viewerCountSchema = z.object({
  streamId: z.string().uuid(),
  count: z.number().int().nonnegative(),
});
export type ViewerCount = z.infer<typeof viewerCountSchema>;

export const streamStatusSchema = z.object({
  streamId: z.string().uuid(),
  status: z.enum(['scheduled', 'live', 'ended']),
});
export type StreamStatus = z.infer<typeof streamStatusSchema>;

export const presenceEventSchema = z.object({
  streamId: z.string().uuid(),
  userId: z.string().uuid(),
  handle: z.string(),
  /** join | follow — rendered as chat system lines in the prototypes */
  kind: z.enum(['join', 'follow']),
});
export type PresenceEvent = z.infer<typeof presenceEventSchema>;

// ── event name → schema map ────────────────────────────────────────────────

export const clientEvents = {
  'chat:send': chatSendSchema,
  'stream:join': streamJoinSchema,
  'stream:leave': streamJoinSchema,
} as const;

export const serverEvents = {
  'chat:message': chatMessageSchema,
  'chat:message:removed': chatMessageRemovedSchema,
  'gift:sent': giftSentSchema,
  'viewer:count': viewerCountSchema,
  'stream:status': streamStatusSchema,
  'presence:event': presenceEventSchema,
} as const;

export type ClientEventName = keyof typeof clientEvents;
export type ServerEventName = keyof typeof serverEvents;
