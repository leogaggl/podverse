'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';

import { ImageNonReact, LoadingSpinner, MarqueeText } from '@podverse/ui';

import {
  MEDIA_PLAYER_MARQUEE_TURN_GROUP,
  MEDIA_PLAYER_MARQUEE_TURN_ORDER,
} from '../../../constants/mediaPlayerMarquee';
import { useMediaPlayer } from '../../../contexts/MediaPlayer';
import { useMediaPlayerCurrentTime } from '../../../contexts/MediaPlayerCurrentTime';
import { useMediaPlayerVideo } from '../../../contexts/MediaPlayerVideo';
import { useModalArtworkSquareSize } from '../../../hooks/useModalArtworkSquareSize';
import { isNonLiveVideoPlaying } from '../../../utils/mediaPlayer/isNonLiveVideoPlaying';
import {
  buildMediaPlayerArtworkImageCandidates,
  getMediaPlayerArtworkSources,
  shouldUseChapterArtwork,
} from '../../../utils/mediaPlayer/mediaPlayerArtwork';
import { getMediaPlayerInfoResolution } from '../../../utils/mediaPlayer/mediaPlayerInfoResolution';
import { Link } from '../../Link/Link';
import { ReadableTimeRange } from '../../Time/ReadableTimeRange';
import { ChapterLinkButton } from './ChapterLinkButton';
import { MediaPlayerVtsOverrideLikeButton } from './MediaPlayerVtsOverrideLikeButton';

import styles from '../../../styles/components/MediaPlayer/Modal/MediaPlayerInfoModal.module.scss';

function ClickableTitle({
  title,
  onClick,
  className,
  testId,
  turnOrder,
  setPlayerModalIsOpen,
}: {
  title?: string | null;
  onClick: () => void;
  className?: string;
  testId: string;
  turnOrder: number;
  setPlayerModalIsOpen: (isOpen: boolean) => void;
}) {
  const tMisc = useTranslations('misc');

  const handleOnClick = () => {
    setPlayerModalIsOpen(false);
    onClick();
  };

  return (
    <div className={className || ''}>
      <Link onClick={handleOnClick}>
        <MarqueeText
          align="center"
          data-testid={testId}
          turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.fullPlayer}
          turnOrder={turnOrder}
        >
          {title || tMisc('untitled')}
        </MarqueeText>
      </Link>
    </div>
  );
}

export const MediaPlayerInfoModal: React.FC = () => {
  const {
    mpChannel,
    mpItem,
    mpAddByRSS,
    mpClip,
    mpItemChapter,
    mpItemChapters,
    mpItemSoundbite,
    mpItemLabeledItemEnclosures,
    mpEnclosureSelectedParams,
    setPlayerModalIsOpen,
  } = useMediaPlayer();
  const { mpCurrentTime } = useMediaPlayerCurrentTime();
  const { videoLocation, setModalVideoTarget, modalVideoAspectRatio } = useMediaPlayerVideo();
  const tMediaPlayer = useTranslations('media_player');
  const router = useRouter();

  const isVideoPlaying = isNonLiveVideoPlaying({
    mpItem,
    mpAddByRSS,
    mpItemLabeledItemEnclosures,
    mpEnclosureSelectedParams,
  });

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
    imageSizeTarget: 'largest',
  });

  const infoResolution = getMediaPlayerInfoResolution({
    mpChannel,
    mpItem,
    mpAddByRSS,
    mpClip,
    mpItemSoundbite,
    mpItemChapter,
    mpItemChapters,
    currentTimeSeconds: mpCurrentTime,
  });

  const showModalVideo = videoLocation === 'full-modal' && isVideoPlaying;
  const ratioKnown = modalVideoAspectRatio !== null;

  const infoRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const artSquareSide = useModalArtworkSquareSize({
    infoRef,
    titleRef,
    subtitleRef,
    active: !showModalVideo,
  });

  const titleSection = (
    <div className={styles.titleSection} ref={titleRef}>
      <ClickableTitle
        title={infoResolution.itemTitle ?? undefined}
        className={styles.itemTitle}
        testId="media-player-modal-title"
        turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.fullPlayer.title}
        onClick={() => infoResolution.itemLinkUrl && router.push(infoResolution.itemLinkUrl)}
        setPlayerModalIsOpen={setPlayerModalIsOpen}
      />
      {infoResolution.channelLinkUrl ? (
        <ClickableTitle
          title={infoResolution.channelTitle ?? undefined}
          className={styles.channelTitle}
          testId="media-player-modal-channel-title"
          turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.fullPlayer.channel}
          onClick={() => router.push(infoResolution.channelLinkUrl)}
          setPlayerModalIsOpen={setPlayerModalIsOpen}
        />
      ) : infoResolution.channelTitle ? (
        <div className={styles.channelTitle}>
          <MarqueeText
            align="center"
            data-testid="media-player-modal-channel-title"
            turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.fullPlayer}
            turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.fullPlayer.channel}
          >
            {infoResolution.channelTitle}
          </MarqueeText>
        </div>
      ) : null}
      {infoResolution.resolvedLikeTarget && (
        <div className={styles.vtsLike}>
          <MediaPlayerVtsOverrideLikeButton likeTarget={infoResolution.resolvedLikeTarget} />
        </div>
      )}
    </div>
  );

  const subtitleSection = (
    <div className={styles.subtitleSection} ref={subtitleRef}>
      {infoResolution.subsectionTitle && infoResolution.subsectionUrl && (
        <>
          <div className={styles.subtitleCopy}>
            <ClickableTitle
              title={infoResolution.subsectionTitle}
              className={styles.subtitle}
              testId="media-player-modal-subsection-title"
              turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.fullPlayer.subsection}
              onClick={() => router.push(infoResolution.subsectionUrl)}
              setPlayerModalIsOpen={setPlayerModalIsOpen}
            />
            {infoResolution.subsectionStartTime && infoResolution.subsectionEndTime && (
              <div className={styles.timeRange}>
                <ReadableTimeRange
                  startTime={infoResolution.subsectionStartTime}
                  endTime={infoResolution.subsectionEndTime}
                />
              </div>
            )}
          </div>
          {infoResolution.chapterWebUrl !== null ? (
            <ChapterLinkButton className={styles.chapterLink} href={infoResolution.chapterWebUrl} />
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <div className={styles.info} ref={infoRef}>
      {!showModalVideo || ratioKnown ? titleSection : null}
      {showModalVideo ? (
        <div className={styles.videoStage}>
          {!ratioKnown ? <LoadingSpinner className={styles.videoStageSpinner} /> : null}
          <div
            ref={setModalVideoTarget}
            className={styles.videoWrapper}
            data-testid="modal-video-target"
            style={
              ratioKnown
                ? { aspectRatio: modalVideoAspectRatio, display: 'flex' }
                : { display: 'none' }
            }
          />
        </div>
      ) : (
        <div className={styles.imageWrapper}>
          <div
            className={styles.imageInner}
            style={
              artSquareSide !== null ? { width: artSquareSide, height: artSquareSide } : undefined
            }
          >
            <ImageNonReact
              className={styles.image}
              candidates={artImageCandidates}
              alt={tMediaPlayer('media_player_image')}
            />
          </div>
        </div>
      )}
      {!showModalVideo || ratioKnown ? subtitleSection : null}
    </div>
  );
};
