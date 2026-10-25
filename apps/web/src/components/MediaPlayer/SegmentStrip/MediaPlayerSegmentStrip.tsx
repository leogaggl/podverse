'use client';

import { useTranslations } from 'next-intl';
import { useId, useLayoutEffect } from 'react';
import type { IconType } from 'react-icons';
import { FaMicrophone, FaScissors } from 'react-icons/fa6';

import { MarqueeText } from '@podverse/ui';

import {
  MEDIA_PLAYER_MARQUEE_TURN_GROUP,
  MEDIA_PLAYER_MARQUEE_TURN_ORDER,
} from '../../../constants/mediaPlayerMarquee';
import { useMediaPlayer } from '../../../contexts/MediaPlayer';
import { useMediaPlayerCurrentTime } from '../../../contexts/MediaPlayerCurrentTime';
import { useRemotePlayerInfo } from '../../../hooks/useRemotePlayerInfo';
import { getMediaPlayerInfoResolution } from '../../../utils/mediaPlayer/mediaPlayerInfoResolution';
import type { MediaPlayerSegmentKind } from '../../../utils/mediaPlayer/mediaPlayerSegmentStrip';
import {
  mediaPlayerSegmentStripLabelKey,
  resolveMediaPlayerSegmentStripSegment,
} from '../../../utils/mediaPlayer/mediaPlayerSegmentStrip';
import { setMediaPlayerSegmentStripVisible } from './mediaPlayerSegmentStripPresence';

import styles from '../../../styles/components/MediaPlayer/SegmentStrip/MediaPlayerSegmentStrip.module.scss';

type MediaPlayerSegmentStripProps = {
  variant: 'desktop' | 'mobile';
};

const segmentStripLeadingIcon = (kind: MediaPlayerSegmentKind): IconType | null => {
  switch (kind) {
    case 'chapter':
      return null;
    case 'clip':
      return FaScissors;
    case 'official-clip':
      return FaMicrophone;
  }
};

export const MediaPlayerSegmentStrip = ({ variant }: MediaPlayerSegmentStripProps) => {
  const { mpAddByRSS, mpChannel, mpClip, mpItem, mpItemChapter, mpItemChapters, mpItemSoundbite } =
    useMediaPlayer();
  const { mpCurrentTime } = useMediaPlayerCurrentTime();
  const remoteInfo = useRemotePlayerInfo();
  const tMediaPlayer = useTranslations('media_player');
  const instanceId = useId();

  const { subsectionTitle } = getMediaPlayerInfoResolution({
    mpChannel,
    mpItem,
    mpAddByRSS,
    mpClip,
    mpItemSoundbite,
    mpItemChapter,
    mpItemChapters,
    currentTimeSeconds: mpCurrentTime,
  });
  const localSegment = resolveMediaPlayerSegmentStripSegment({
    hasContent: mpChannel !== null || mpAddByRSS !== null,
    mpClip,
    mpItemSoundbite,
    subsectionTitle,
  });
  const segment = remoteInfo !== null ? remoteInfo.segment : localSegment;
  const segmentVisible = segment !== null;

  useLayoutEffect(() => {
    setMediaPlayerSegmentStripVisible(instanceId, segmentVisible);
  }, [instanceId, segmentVisible]);

  useLayoutEffect(() => {
    return () => {
      setMediaPlayerSegmentStripVisible(instanceId, false);
    };
  }, [instanceId]);

  if (segment === null) {
    return null;
  }

  const LeadingIcon = segmentStripLeadingIcon(segment.kind);

  return (
    <div
      className={styles.strip}
      data-segment-kind={segment.kind}
      data-testid={`media-player-segment-strip-${variant}`}
    >
      <div aria-hidden="true" className={styles.row}>
        {LeadingIcon !== null ? (
          <span className={styles.icon} data-testid={`media-player-segment-strip-icon-${variant}`}>
            <LeadingIcon />
          </span>
        ) : null}
        <div className={styles.titleSlot}>
          <MarqueeText
            align={LeadingIcon === null ? 'center' : 'left'}
            className={styles.title}
            data-testid={`media-player-segment-strip-title-${variant}`}
            restInset={LeadingIcon === null ? 'var(--spacing-lg)' : undefined}
            turnGroup={MEDIA_PLAYER_MARQUEE_TURN_GROUP.playerBar}
            turnOrder={MEDIA_PLAYER_MARQUEE_TURN_ORDER.playerBar.segment}
          >
            {segment.title}
          </MarqueeText>
        </div>
      </div>
      <span
        className={styles.visuallyHidden}
        data-testid={`media-player-segment-strip-label-${variant}`}
      >
        {tMediaPlayer(mediaPlayerSegmentStripLabelKey(segment.kind), { title: segment.title })}
      </span>
    </div>
  );
};
