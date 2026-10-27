import { useEffect, useSyncExternalStore } from 'react';

import { nativePlaybackBridge } from '../../bridge/nativePlaybackBridge';
import {
  getVideoFullscreenSnapshot,
  setVideoPresented,
  subscribeVideoFullscreen,
} from '../../playback/videoFullscreenStore';
import { VideoFullscreenOverlay } from './VideoFullscreenOverlay';

/**
 * Listens for the native video surface and mounts the fullscreen window.
 * Lives above the navigator so the video covers the player while that mode is on.
 */
export function VideoPlaybackChromeBridge() {
  const fullscreen = useSyncExternalStore(subscribeVideoFullscreen, getVideoFullscreenSnapshot);

  useEffect(() => {
    setVideoPresented(false);
    try {
      setVideoPresented(nativePlaybackBridge.isVideoPresented());
    } catch {
      setVideoPresented(false);
    }
    const subscription = nativePlaybackBridge.addListener('videoPresented', (event) => {
      setVideoPresented(event.presented);
    });
    return () => {
      subscription.remove();
    };
  }, []);

  if (!fullscreen) {
    return null;
  }

  return <VideoFullscreenOverlay />;
}
