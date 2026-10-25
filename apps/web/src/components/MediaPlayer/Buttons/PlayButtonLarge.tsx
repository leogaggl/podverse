import { useTranslations } from 'next-intl';
import { FaPause, FaPlay } from 'react-icons/fa6';

import type { DTOClip, DTOItem, DTOItemChapter, DTOItemSoundbite } from '@podverse/helpers';

import { useMediaPlayer } from '../../../contexts/MediaPlayer';
import { useRemoteRowPlayback } from '../../../hooks/useRemoteRowPlayback';
import { playbackErrorIdentity } from '../../../utils/media/playbackErrorCopy';
import { PlaybackErrorButton } from './PlaybackErrorButton';

import styles from '../../../styles/components/MediaPlayer/Buttons/PlayButtonLarge.module.scss';

type PlayButtonLargeProps = {
  clip?: DTOClip;
  item?: DTOItem;
  item_chapter?: DTOItemChapter;
  item_soundbite?: DTOItemSoundbite;
  /** When provided (e.g. add-by-RSS livestream detail), match now-playing by idText. */
  addByRSSIdText?: string;
  /** Add by RSS hash ids for this row (getAddByRSSHashIds), to match playback on another device. */
  addByRSSHashIds?: readonly string[];
  onClick: () => void;
};

export const PlayButtonLarge: React.FC<PlayButtonLargeProps> = ({
  clip,
  item,
  item_chapter,
  item_soundbite,
  addByRSSIdText,
  addByRSSHashIds,
  onClick,
}) => {
  const {
    mpAddByRSS,
    mpClip,
    mpIsPlaying,
    mpItem,
    mpItemChapter,
    mpItemSoundbite,
    mpPlaybackError,
  } = useMediaPlayer();
  const tMediaPlayer = useTranslations('media_player');
  const remoteRow = useRemoteRowPlayback({
    itemIdText: item?.id_text ?? null,
    chapterIdText: item_chapter?.id_text ?? null,
    clipIdText: clip?.id_text ?? null,
    soundbiteIdText: item_soundbite?.id_text ?? null,
    addByRSSHashIds: addByRSSHashIds ?? null,
  });

  let isLocalMatch = false;
  if (addByRSSIdText && mpAddByRSS?.idText === addByRSSIdText) {
    isLocalMatch = true;
  } else if (clip) {
    isLocalMatch = mpClip?.id_text === clip.id_text;
  } else if (item_soundbite) {
    isLocalMatch = mpItemSoundbite?.id_text === item_soundbite.id_text;
  } else if (item_chapter) {
    isLocalMatch = mpItemChapter?.id_text === item_chapter.id_text;
  } else if (item && !mpClip && !mpItemSoundbite) {
    isLocalMatch = mpItem?.id === item.id;
  }

  const isPlaying = (isLocalMatch && mpIsPlaying) || remoteRow.isPlaying;
  const loadedIdentity = playbackErrorIdentity({
    addByRssResourceData: mpAddByRSS?.resourceData ?? null,
    itemIdText: mpItem?.id_text ?? null,
    clipIdText: mpClip?.id_text ?? null,
    soundbiteIdText: mpItemSoundbite?.id_text ?? null,
  });
  if (
    isLocalMatch &&
    mpPlaybackError !== null &&
    loadedIdentity !== null &&
    mpPlaybackError.identity === loadedIdentity
  ) {
    return <PlaybackErrorButton className={styles.playButtonLarge} />;
  }
  const label = isPlaying ? tMediaPlayer('pause') : tMediaPlayer('play');
  const icon = isPlaying ? <FaPause /> : <FaPlay />;

  return (
    <button
      className={styles.playButtonLarge}
      aria-label={label}
      data-media-player-playing={isPlaying ? 'true' : undefined}
      onClick={onClick}
      type="button"
    >
      {icon}
    </button>
  );
};
