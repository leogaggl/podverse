'use client';

import { useTranslations } from 'next-intl';

import { ImageNonReact, MarqueeText } from '@podverse/ui';

import { IMAGES } from '../../../constants/images';
import {
  MEDIA_PLAYER_MARQUEE_TURN_GROUP,
  MEDIA_PLAYER_MARQUEE_TURN_ORDER,
} from '../../../constants/mediaPlayerMarquee';
import { useMediaPlayer } from '../../../contexts/MediaPlayer';
import { useMediaPlayerCurrentTime } from '../../../contexts/MediaPlayerCurrentTime';
import { useDeviceArtistLinks } from '../../../hooks/useDeviceArtistLinks';
import {
  buildMediaPlayerArtworkImageCandidates,
  getMediaPlayerArtworkSources,
  shouldUseChapterArtwork,
} from '../../../utils/mediaPlayer/mediaPlayerArtwork';
import { getMediaPlayerInfoResolution } from '../../../utils/mediaPlayer/mediaPlayerInfoResolution';

import styles from '../../../styles/components/MediaPlayer/Mobile/MediaPlayerInfoMobile.module.scss';

export const MediaPlayerInfoMobile: React.FC = () => {
  const {
    mpChannel,
    mpItem,
    mpAddByRSS,
    mpItemChapter,
    mpItemChapters,
    mpClip,
    mpItemSoundbite,
    setPlayerModalIsOpen,
  } = useMediaPlayer();
  const deviceArtistLinks = useDeviceArtistLinks();
  const { mpCurrentTime } = useMediaPlayerCurrentTime();
  const tMediaPlayer = useTranslations('media_player');
  const tMisc = useTranslations('misc');

  const hasContent = !!mpChannel || !!mpAddByRSS;
  const infoResolution = getMediaPlayerInfoResolution({
    mpChannel,
    mpItem,
    mpAddByRSS,
    mpClip,
    mpItemSoundbite,
    mpItemChapter,
    mpItemChapters,
    currentTimeSeconds: mpCurrentTime,
    deviceArtistLinks,
  });
  const title = hasContent ? (infoResolution.itemTitle ?? tMisc('untitled')) : '';
  const subtitle = hasContent ? (infoResolution.compactChannelLine ?? tMisc('untitled')) : '';

  const { channelImages, itemImages } = getMediaPlayerArtworkSources({
    mpChannel,
    mpItem,
    mpAddByRSSResourceData: mpAddByRSS?.resourceData,
  });
  const artImageCandidates = buildMediaPlayerArtworkImageCandidates({
    channelImages,
    itemImages,
    chapterImageUrl: mpItemChapter?.img,
    includeChapterImage: shouldUseChapterArtwork({
      mpItemChapter,
      mpClip,
      mpItemSoundbite,
    }),
    imageSizeTarget: IMAGES.MEDIA_PLAYER.MOBILE.MINI.SIZE_FIND_TARGET,
    imageSizeComparison: 'lesser',
    artworkRole: 'list',
  });

  return (
    <div className={styles.info}>
      <button
        className={styles.button}
        aria-description={tMediaPlayer('show_fullscreen_media_player')}
        type="button"
        onClick={() => setPlayerModalIsOpen(true)}
      >
        <div className={styles.imageWrapper}>
          <ImageNonReact
            className={styles.image}
            candidates={artImageCandidates}
            alt={tMediaPlayer('media_player_image')}
          />
        </div>
        <div className={styles.textSection}>
          <MarqueeText
            className={styles.title}
            data-testid="media-player-bar-title-mobile"
            turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.playerBar}
            turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.playerBar.title}
          >
            {title}
          </MarqueeText>
          <MarqueeText
            className={styles.subtitle}
            data-testid="media-player-bar-subtitle-mobile"
            turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.playerBar}
            turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.playerBar.channel}
          >
            {subtitle}
          </MarqueeText>
        </div>
      </button>
    </div>
  );
};
