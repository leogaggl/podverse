import { useCrossDevicePlayerDisplay } from '../../playback/crossDevice/useCrossDevicePlayerDisplay';
import { usePlaybackSession } from '../../playback/PlaybackProvider';

/** True when the mini player draws: this phone has a session, or another device's playback shows. */
export function useMiniPlayerVisible(): boolean {
  const { activeTarget, nowPlaying } = usePlaybackSession();
  const display = useCrossDevicePlayerDisplay();
  return display.kind === 'remote' || (activeTarget !== null && nowPlaying !== null);
}
