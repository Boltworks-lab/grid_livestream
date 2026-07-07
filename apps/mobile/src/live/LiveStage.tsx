import { color } from '@grid/ui-tokens';
import { Track } from 'livekit-client';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * LiveKit video for mobile. The SDK pulls in native modules that only exist in
 * a custom dev/production build (not Expo Go), so it's loaded lazily and
 * degrades to a "chat-only" note if the native side is missing — the JS bundles
 * everywhere. In a dev build this renders the real multi-source stage
 * (screen-share-first, then camera).
 */
type LiveKitModule = typeof import('@livekit/react-native');

let LK: LiveKitModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  LK = require('@livekit/react-native') as LiveKitModule;
  LK.registerGlobals();
} catch {
  LK = null;
}

function Fallback({ note }: { note: string }) {
  return (
    <View style={styles.fill}>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

type VideoTrackRef = React.ComponentProps<LiveKitModule['VideoTrack']>['trackRef'];

function RoomTracks() {
  const kit = LK!;
  const tracks = kit.useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
    { source: Track.Source.Camera, withPlaceholder: false },
  ]);
  // only real (non-placeholder) references carry a publication
  const primary = tracks.find((t) => t.publication) as VideoTrackRef | undefined;
  if (!primary) return <Fallback note="Waiting for the creator's video…" />;
  return <kit.VideoTrack trackRef={primary} style={styles.fill} objectFit="contain" />;
}

export function LiveStage({
  token,
  url,
  isCreator,
}: {
  token: string;
  url: string;
  isCreator: boolean;
}) {
  useEffect(() => {
    if (!LK) return;
    void LK.AudioSession.startAudioSession();
    return () => {
      void LK.AudioSession.stopAudioSession();
    };
  }, []);

  if (!LK) {
    return <Fallback note="Video activates in the Grid dev/production build — chat is live." />;
  }

  return (
    <View style={styles.fill}>
      <LK.LiveKitRoom serverUrl={url} token={token} connect audio video={isCreator}>
        <RoomTracks />
      </LK.LiveKitRoom>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg2 },
  note: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: color.t3,
    fontSize: 12,
    paddingHorizontal: 40,
  },
});
