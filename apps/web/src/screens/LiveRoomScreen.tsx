import type {
  ChatMessage,
  GiftSent,
  PresenceEvent,
  StreamSummary,
  ViewerCount,
} from '@grid/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Socket } from 'socket.io-client';

import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { connectRealtime, emitWithAck } from '../lib/realtime';
import { GiftBar } from './GiftBar';

interface FloatingGift {
  key: string;
  emoji: string;
  tier: number;
  left: number;
}

type ChatLine =
  { type: 'message'; message: ChatMessage } | { type: 'system'; id: string; text: string };

export function LiveRoomScreen() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stream, setStream] = useState<StreamSummary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [ended, setEnded] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [videoState, setVideoState] = useState<'checking' | 'unconfigured' | 'ready' | 'blocked'>(
    'checking',
  );
  const [floats, setFloats] = useState<FloatingGift[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const isCreator = stream !== null && user !== null && stream.creatorId === user.id;

  useEffect(() => {
    if (!id) return;
    void api.GET('/streams/{id}', { params: { path: { id } } }).then(({ data, response }) => {
      if (response.status === 404) setNotFound(true);
      else if (data) {
        const s = data as StreamSummary;
        setStream(s);
        setViewerCount(s.viewerCount);
        if (s.status === 'ENDED') setEnded(true);
      }
    });
  }, [id]);

  // media token: proves the §3.4 gate; LiveKit playback mounts here once keys exist
  useEffect(() => {
    if (!id || !stream?.entitled || stream.status !== 'LIVE') return;
    void api.POST('/streams/{id}/token', { params: { path: { id } } }).then(({ response }) => {
      if (response.status === 503) setVideoState('unconfigured');
      else if (response.ok) setVideoState('ready');
      else setVideoState('blocked');
    });
  }, [id, stream?.entitled, stream?.status]);

  useEffect(() => {
    if (!id || !stream?.entitled || stream.status !== 'LIVE') return;
    const socket = connectRealtime();
    socketRef.current = socket;

    socket.on('connect', () => {
      void emitWithAck(socket, 'stream:join', { streamId: id }).then((ack) => {
        if (!ack.ok) setChatError(ack.error);
      });
    });
    socket.on('chat:message', (message: ChatMessage) =>
      setLines((prev) => [...prev.slice(-199), { type: 'message', message }]),
    );
    socket.on('chat:message:removed', ({ messageId }: { messageId: string }) =>
      setLines((prev) =>
        prev.filter((l) => l.type !== 'message' || l.message.messageId !== messageId),
      ),
    );
    socket.on('viewer:count', (payload: ViewerCount) => setViewerCount(payload.count));
    socket.on('presence:event', (event: PresenceEvent) =>
      setLines((prev) => [
        ...prev.slice(-199),
        {
          type: 'system',
          id: `${event.userId}-${Date.now()}`,
          text: `@${event.handle} ${event.kind === 'join' ? 'joined' : 'followed'}`,
        },
      ]),
    );
    socket.on('stream:status', ({ status }: { status: string }) => {
      if (status === 'ended') setEnded(true);
    });
    socket.on('gift:sent', (gift: GiftSent) => {
      const emoji = gift.emoji ?? '🎁';
      // bigger gifts burst more emojis (animation tiers from the catalog)
      const burst = 1 + gift.animationTier * 2;
      const newFloats = Array.from({ length: burst }, (_, i) => ({
        key: `${gift.streamId}-${gift.sentAt}-${i}-${Math.random()}`,
        emoji,
        tier: gift.animationTier,
        left: 15 + Math.random() * 70,
      }));
      setFloats((prev) => [...prev.slice(-30), ...newFloats]);
      setTimeout(
        () => setFloats((prev) => prev.filter((f) => !newFloats.some((n) => n.key === f.key))),
        3000,
      );
      setLines((prev) => [
        ...prev.slice(-199),
        {
          type: 'system',
          id: `gift-${gift.sentAt}-${Math.random()}`,
          text: `@${gift.senderHandle} sent ${gift.giftName} ${emoji}${gift.qty > 1 ? ` ×${gift.qty}` : ''}${gift.combo > 1 ? ` (combo ×${gift.combo})` : ''}`,
        },
      ]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id, stream?.entitled, stream?.status]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  const send = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const input = e.currentTarget.elements.namedItem('body') as HTMLInputElement;
      const body = input.value.trim();
      if (!body || !socketRef.current || !id) return;
      const ack = await emitWithAck(socketRef.current, 'chat:send', { streamId: id, body });
      if (ack.ok) {
        input.value = '';
        setChatError(null);
      } else setChatError(ack.error);
    },
    [id],
  );

  async function removeMessage(messageId: string) {
    if (!id) return;
    await api.DELETE('/streams/{id}/chat/{messageId}', {
      params: { path: { id, messageId } },
    });
  }

  async function endStream() {
    if (!id) return;
    await api.POST('/streams/{id}/end', { params: { path: { id } } });
    navigate('/');
  }

  if (notFound) {
    return (
      <main className="page narrow">
        <section className="panel">
          <h2>Stream not found</h2>
          <Link className="primary-link" to="/">
            Back to Discover
          </Link>
        </section>
      </main>
    );
  }
  if (!stream) return <main className="page" aria-busy="true" />;

  if (!stream.entitled) {
    return (
      <main className="page narrow">
        <section className="panel gate">
          <div className="gate-lock">🔒</div>
          <h2>{stream.title}</h2>
          <p className="muted">by @{stream.creatorHandle}</p>
          {stream.access === 'PPV' && (
            <p className="gate-price">Unlock for 💎 {stream.ppvPriceDiamonds}</p>
          )}
          {stream.access === 'SUBS' && <p className="gate-price">Subscribers only</p>}
          {stream.visibility === 'FOLLOWERS' && <p className="gate-price">Followers only</p>}
          <p className="muted small">
            {stream.access === 'PPV'
              ? 'Pay-per-view unlocking ships in Phase 6 — the gate itself is already enforced server-side.'
              : 'Access is enforced at the media layer — this is not a CSS curtain.'}
          </p>
          <Link className="primary-link" to="/">
            Back to Discover
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="live-wrap">
      <section className="video-col">
        <div className="video-area">
          <div className="float-layer" aria-hidden="true">
            {floats.map((f) => (
              <span
                key={f.key}
                className="float-gift"
                style={{ left: `${f.left}%`, fontSize: `${22 + f.tier * 10}px` }}
              >
                {f.emoji}
              </span>
            ))}
          </div>
          {ended ? (
            <div className="video-note">
              <b>Stream ended</b>
              <Link className="primary-link" to="/">
                Back to Discover
              </Link>
            </div>
          ) : videoState === 'unconfigured' ? (
            <div className="video-note">
              <b>{stream.title}</b>
              <span className="muted">
                Chat is live. Video activates the moment LiveKit keys are configured
                (docs/deferred.md).
              </span>
            </div>
          ) : videoState === 'ready' ? (
            <div className="video-note">
              <b>{stream.title}</b>
              <span className="muted">LiveKit token minted — player mounts here next.</span>
            </div>
          ) : (
            <div className="video-note muted">connecting…</div>
          )}
        </div>
        <div className="room-bar">
          <div>
            <b>{stream.title}</b>
            <span className="muted"> · @{stream.creatorHandle}</span>
          </div>
          <div className="room-meta">
            <span className="live-tag">LIVE · {viewerCount}</span>
            {isCreator && !ended && (
              <button type="button" className="danger" onClick={() => void endStream()}>
                End stream
              </button>
            )}
          </div>
        </div>
      </section>

      <aside className="chat-col">
        <div className="chat-log" ref={logRef}>
          {lines.map((line) =>
            line.type === 'system' ? (
              <p key={line.id} className="chat-system">
                {line.text}
              </p>
            ) : (
              <p key={line.message.messageId} className="chat-line">
                {line.message.senderLevel > 0 && (
                  <span className="level">Lv{line.message.senderLevel}</span>
                )}
                <b>@{line.message.senderHandle}</b> {line.message.body}
                {isCreator && line.message.senderId !== user?.id && (
                  <button
                    type="button"
                    className="remove-msg"
                    title="Remove message"
                    onClick={() => void removeMessage(line.message.messageId)}
                  >
                    ✕
                  </button>
                )}
              </p>
            ),
          )}
        </div>
        {!isCreator && !ended && <GiftBar streamId={stream.id} disabled={ended} />}
        {chatError && <p className="error small">{chatError}</p>}
        <form className="chat-input" onSubmit={(e) => void send(e)}>
          <input name="body" maxLength={500} placeholder="Say something…" disabled={ended} />
          <button className="primary" type="submit" disabled={ended}>
            Send
          </button>
        </form>
      </aside>
    </main>
  );
}
