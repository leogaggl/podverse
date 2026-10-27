import { useTranslation } from 'react-i18next';

import { enterVideoFullscreen } from '../../playback/videoFullscreenStore';
import { VideoCornerChrome, videoCornerChromeInset } from './VideoCornerChrome';

/** Full-player video tap target. Reveals Full Screen at the bottom right of the picture. */
export function FullPlayerVideoChrome() {
  const { t } = useTranslation();

  return (
    <VideoCornerChrome
      actionTestID="full-player-video-fullscreen"
      bottomInset={videoCornerChromeInset}
      iconName="expand-outline"
      label={t('media_player.enter_video_full_screen')}
      onAction={enterVideoFullscreen}
      revealTestID="full-player-video-tap"
      rightInset={videoCornerChromeInset}
    />
  );
}
