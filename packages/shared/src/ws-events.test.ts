import { describe, expect, it } from 'vitest';

import { chatSendSchema, giftSentSchema, serverEvents, viewerCountSchema } from './ws-events';

const uuid = '3f0d1c9e-2b7a-4e5d-9c1f-8a6b5d4e3f2a';

describe('ws event schemas', () => {
  it('accepts a valid chat:send and trims the body', () => {
    const parsed = chatSendSchema.parse({ streamId: uuid, body: '  gg!  ' });
    expect(parsed.body).toBe('gg!');
  });

  it('rejects an empty chat body', () => {
    expect(() => chatSendSchema.parse({ streamId: uuid, body: '   ' })).toThrow();
  });

  it('defaults gift combo to 1', () => {
    const parsed = giftSentSchema.parse({
      streamId: uuid,
      giftId: 'rose',
      giftName: 'Rose',
      animationTier: 0,
      qty: 1,
      senderId: uuid,
      senderHandle: 'mia',
      sentAt: new Date().toISOString(),
    });
    expect(parsed.combo).toBe(1);
  });

  it('rejects negative viewer counts', () => {
    expect(() => viewerCountSchema.parse({ streamId: uuid, count: -1 })).toThrow();
  });

  it('registers every server event under a namespaced name', () => {
    for (const name of Object.keys(serverEvents)) {
      expect(name).toMatch(/^[a-z]+:[a-z]+(:[a-z]+)?$/);
    }
  });
});
