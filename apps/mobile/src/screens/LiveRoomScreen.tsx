import type { ChatMessage, GiftCatalogItem, GiftSent, StreamSummary } from '@grid/shared';
import { alpha, color, radius, space } from '@grid/ui-tokens';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Socket } from 'socket.io-client';

import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { connectRealtime, emitWithAck } from '../lib/realtime';
import type { RootStackParamList } from '../navigation';

type ChatLine = { id: string; text: string; system?: boolean };

function FloatingEmoji({ emoji, left }: { emoji: string; left: number }) {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 2600, useNativeDriver: true }).start();
  }, [rise]);
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        bottom: 120,
        left: `${left}%`,
        fontSize: 30,
        opacity: rise.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -420] }) },
        ],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

export function LiveRoomScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'LiveRoom'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { streamId, ids = [] } = route.params;

  const [stream, setStream] = useState<StreamSummary | null>(null);
  const [ended, setEnded] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [floats, setFloats] = useState<{ key: string; emoji: string; left: number }[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const isCreator = stream !== null && user !== null && stream.creatorId === user.id;

  const swipeTo = useCallback(
    (direction: 1 | -1) => {
      if (ids.length < 2) return;
      const index = ids.indexOf(streamId);
      const next = ids[(index + direction + ids.length) % ids.length];
      if (next && next !== streamId) navigation.replace('LiveRoom', { streamId: next, ids });
    },
    [ids, streamId, navigation],
  );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 60 && Math.abs(g.dx) < 40,
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -60) swipeTo(1);
        else if (g.dy > 60) swipeTo(-1);
      },
    }),
  ).current;

  const loadStream = useCallback(async () => {
    const { data } = await api.GET('/streams/{id}', { params: { path: { id: streamId } } });
    if (data) setStream(data as StreamSummary);
  }, [streamId]);

  useEffect(() => {
    void loadStream();
    void api
      .GET('/gifts/catalog')
      .then(({ data }) => data && setCatalog(data as GiftCatalogItem[]));
  }, [streamId, loadStream]);

  useEffect(() => {
    if (!stream?.entitled || stream.status !== 'LIVE') return;
    const socket = connectRealtime();
    socketRef.current = socket;
    socket.on('connect', () => void emitWithAck(socket, 'stream:join', { streamId }));
    socket.on('chat:message', (m: ChatMessage) =>
      setLines((prev) => [
        ...prev.slice(-60),
        { id: m.messageId, text: `@${m.senderHandle}  ${m.body}` },
      ]),
    );
    socket.on('chat:message:removed', ({ messageId }: { messageId: string }) =>
      setLines((prev) => prev.filter((l) => l.id !== messageId)),
    );
    socket.on('viewer:count', ({ count }: { count: number }) => setViewerCount(count));
    socket.on('presence:event', (e: { handle: string; kind: string }) =>
      setLines((prev) => [
        ...prev.slice(-60),
        {
          id: `p${Date.now()}${Math.random()}`,
          text: `@${e.handle} ${e.kind === 'join' ? 'joined' : 'followed'}`,
          system: true,
        },
      ]),
    );
    socket.on('gift:sent', (gift: GiftSent) => {
      const emoji = gift.emoji ?? '🎁';
      const burst = Array.from({ length: 1 + gift.animationTier * 2 }, (_, i) => ({
        key: `${gift.sentAt}-${i}-${Math.random()}`,
        emoji,
        left: 20 + Math.random() * 60,
      }));
      setFloats((prev) => [...prev.slice(-20), ...burst]);
      setTimeout(
        () => setFloats((prev) => prev.filter((f) => !burst.some((b) => b.key === f.key))),
        2800,
      );
      setLines((prev) => [
        ...prev.slice(-60),
        {
          id: `g${Date.now()}${Math.random()}`,
          text: `@${gift.senderHandle} sent ${gift.giftName} ${emoji}${gift.combo > 1 ? ` ×${gift.combo}` : ''}`,
          system: true,
        },
      ]);
    });
    socket.on(
      'stream:status',
      ({ status }: { status: string }) => status === 'ended' && setEnded(true),
    );
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [stream?.entitled, stream?.status, streamId]);

  async function sendChat() {
    const body = input.trim();
    if (!body || !socketRef.current) return;
    const ack = await emitWithAck(socketRef.current, 'chat:send', { streamId, body });
    if (ack.ok) setInput('');
  }

  async function sendGift(gift: GiftCatalogItem) {
    setGiftError(null);
    const { data, response } = await api.POST('/streams/{id}/gifts', {
      params: { path: { id: streamId } },
      body: { giftId: gift.id, qty: 1, idempotencyKey: Crypto.randomUUID() },
    });
    if (!data) {
      setGiftError(
        response.status === 422
          ? 'Not enough diamonds — recharge in Wallet'
          : 'Could not send gift',
      );
    }
  }

  if (!stream) return <View style={styles.flex} />;

  if (!stream.entitled) {
    return (
      <View style={[styles.flex, styles.center]}>
        <Text style={styles.gateLock}>🔒</Text>
        <Text style={styles.gateTitle}>{stream.title}</Text>
        <Text style={styles.muted}>@{stream.creatorHandle}</Text>
        {stream.access === 'PPV' && (
          <>
            <Text style={styles.gatePrice}>Unlock for 💎 {stream.ppvPriceDiamonds}</Text>
            <Pressable
              style={[styles.backBtn, unlockBusy && { opacity: 0.6 }]}
              onPress={() =>
                void (async () => {
                  setUnlockBusy(true);
                  setUnlockMsg(null);
                  const { data, response } = await api.POST('/gates/{streamId}/unlock', {
                    params: { path: { streamId } },
                  });
                  if (data?.unlocked) await loadStream();
                  else
                    setUnlockMsg(
                      response.status === 422
                        ? 'Not enough diamonds — recharge in Wallet (web)'
                        : 'Unlock failed — try again',
                    );
                  setUnlockBusy(false);
                })()
              }
            >
              <Text style={styles.backText}>
                {unlockBusy ? '…' : `Unlock — 💎 ${stream.ppvPriceDiamonds}`}
              </Text>
            </Pressable>
            {unlockMsg && <Text style={[styles.muted, styles.smallCenter]}>{unlockMsg}</Text>}
          </>
        )}
        {stream.access !== 'PPV' && (
          <Text style={[styles.muted, styles.smallCenter]}>Access is enforced server-side.</Text>
        )}
        <Pressable style={[styles.backBtn, styles.ghostBtn]} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back to Discover</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      {...pan.panHandlers}
    >
      {/* full-bleed “video” background; LiveKit view mounts here once keys exist */}
      <View style={styles.videoBg}>
        <Text style={styles.videoHint}>
          {ended ? 'Stream ended' : 'Video activates with LiveKit keys — chat is live'}
        </Text>
      </View>

      {floats.map((f) => (
        <FloatingEmoji key={f.key} emoji={f.emoji} left={f.left} />
      ))}

      {/* top bar */}
      <View style={styles.topBar}>
        <View style={styles.hostPill}>
          <Text style={styles.hostText}>@{stream.creatorHandle}</Text>
        </View>
        <Text style={styles.viewerPill}>👁 {viewerCount}</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      {/* action rail */}
      <View style={styles.rail}>
        <Pressable style={styles.railBtn} onPress={() => swipeTo(-1)}>
          <Text style={styles.railIcon}>⌃</Text>
        </Pressable>
        <Pressable style={styles.railBtn} onPress={() => swipeTo(1)}>
          <Text style={[styles.railIcon, { transform: [{ rotate: '180deg' }] }]}>⌃</Text>
        </Pressable>
        {!isCreator && (
          <Pressable style={styles.railBtn} onPress={() => setDrawerOpen(true)}>
            <Text style={styles.railIcon}>🎁</Text>
          </Pressable>
        )}
        {isCreator && !ended && (
          <Pressable
            style={[styles.railBtn, styles.endBtn]}
            onPress={() =>
              void api
                .POST('/streams/{id}/end', { params: { path: { id: streamId } } })
                .then(() => navigation.goBack())
            }
          >
            <Text style={styles.railIcon}>⏹</Text>
          </Pressable>
        )}
      </View>

      {/* overlay chat */}
      <View style={styles.chatOverlay} pointerEvents="box-none">
        <ScrollView style={styles.chatList} showsVerticalScrollIndicator={false}>
          {lines.slice(-12).map((l) => (
            <Text key={l.id} style={[styles.chatLine, l.system && styles.chatSystem]}>
              {l.text}
            </Text>
          ))}
        </ScrollView>
        {!ended && (
          <View style={styles.chatRow}>
            <TextInput
              style={styles.chatInput}
              value={input}
              onChangeText={setInput}
              placeholder="Say something…"
              placeholderTextColor={color.t3}
              maxLength={500}
              onSubmitEditing={() => void sendChat()}
            />
            <Pressable style={styles.sendBtn} onPress={() => void sendChat()}>
              <Text style={styles.sendText}>➤</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* gift drawer */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <Pressable style={styles.drawerScrim} onPress={() => setDrawerOpen(false)} />
        <View style={styles.drawer}>
          <Text style={styles.drawerTitle}>Send a gift</Text>
          <View style={styles.giftGrid}>
            {catalog.map((g) => (
              <Pressable key={g.id} style={styles.giftCell} onPress={() => void sendGift(g)}>
                <Text style={styles.giftEmoji}>{g.emoji}</Text>
                <Text style={styles.giftPrice}>💎{g.priceDiamonds.toLocaleString()}</Text>
              </Pressable>
            ))}
          </View>
          {giftError && <Text style={styles.giftError}>{giftError}</Text>}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg0 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: space.xxl },
  videoBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoHint: { color: color.t3, fontSize: 12, textAlign: 'center', paddingHorizontal: 40 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 54,
    paddingHorizontal: space.lg,
  },
  hostPill: {
    backgroundColor: 'rgba(0,0,0,.5)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hostText: { color: color.white, fontSize: 13, fontWeight: '600' },
  viewerPill: { color: color.t2, fontSize: 12, marginLeft: 'auto' },
  close: { color: color.t2, fontSize: 18, padding: 6 },
  rail: {
    position: 'absolute',
    right: 10,
    bottom: 140,
    gap: 12,
    alignItems: 'center',
  },
  railBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,.45)',
    borderWidth: 1,
    borderColor: alpha.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: { backgroundColor: color.red },
  railIcon: { color: color.white, fontSize: 20 },
  chatOverlay: {
    position: 'absolute',
    left: 0,
    right: 66,
    bottom: 0,
    padding: space.lg,
    gap: 8,
  },
  chatList: { maxHeight: 220 },
  chatLine: {
    color: color.t1,
    fontSize: 13,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,.8)',
    textShadowRadius: 4,
  },
  chatSystem: { color: color.t2, fontSize: 12 },
  chatRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(27,27,40,.85)',
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.pill,
    color: color.t1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: color.white, fontSize: 15 },
  drawerScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)' },
  drawer: {
    backgroundColor: color.bg1,
    borderTopLeftRadius: radius.rx,
    borderTopRightRadius: radius.rx,
    padding: space.xl,
    paddingBottom: 34,
  },
  drawerTitle: { color: color.t1, fontSize: 15, fontWeight: '700', marginBottom: space.lg },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  giftCell: {
    width: '22%',
    backgroundColor: color.bg2,
    borderWidth: 1,
    borderColor: alpha.border,
    borderRadius: radius.r,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  giftEmoji: { fontSize: 24 },
  giftPrice: { color: color.amber2, fontSize: 10, fontWeight: '600' },
  giftError: { color: color.red, fontSize: 12, marginTop: space.md },
  gateLock: { fontSize: 44 },
  gateTitle: { color: color.t1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  gatePrice: { color: color.amber2, fontWeight: '700' },
  muted: { color: color.t2 },
  smallCenter: { fontSize: 12, textAlign: 'center' },
  backBtn: {
    marginTop: 14,
    backgroundColor: color.purple,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  ghostBtn: { backgroundColor: color.bg2 },
  backText: { color: color.white, fontWeight: '600' },
});
