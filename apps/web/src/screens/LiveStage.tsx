import '@livekit/components-styles';

import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * The media stage (ADR 0004 + owner requirement): creators broadcast any mix of
 * camera, microphone, and screen share (with audio) — the ControlBar toggles
 * each source independently and LiveKit publishes them as separate tracks.
 * Viewers get a screen-share-first layout and subscribe only.
 */
function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false },
  );
  // screen share (if any) leads; camera tiles follow
  return (
    <GridLayout tracks={tracks} style={{ height: '100%' }}>
      <ParticipantTile />
    </GridLayout>
  );
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
  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect
      video={false /* creators choose sources via the control bar */}
      audio={false}
      data-lk-theme="default"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <Stage />
      </div>
      <RoomAudioRenderer />
      {isCreator && (
        <ControlBar
          variation="minimal"
          controls={{
            camera: true,
            microphone: true,
            screenShare: true,
            chat: false,
            leave: false,
            settings: false,
          }}
        />
      )}
    </LiveKitRoom>
  );
}
