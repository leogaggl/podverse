import { useTranslation } from 'react-i18next';

import type { DTOItemChapter } from '@podverse/helpers';
import { resolveChapterRowArtwork } from '@podverse/helpers';
import { formatHHMMSS } from '@podverse/helpers/time';

import { ChapterListRow } from './ChapterListRow';

export type ItemChapterRowProps = {
  chapter: DTOItemChapter;
  fallbackImageUrl: string | null;
  /** The playing chapter: its title uses the highlighted color. */
  isPlaying?: boolean;
  showImages: boolean;
  testID: string;
};

/** One chapter on an episode page: artwork when the section has any, title, and time range. */
export function ItemChapterRow({
  chapter,
  fallbackImageUrl,
  isPlaying,
  showImages,
  testID,
}: ItemChapterRowProps) {
  const { t } = useTranslation();
  const artwork = resolveChapterRowArtwork(chapter, fallbackImageUrl, showImages);

  return (
    <ChapterListRow
      artworkAccessibilityLabel={t('info.chapter.chapter_image')}
      artworkUri={artwork.show ? artwork.uri : null}
      isPlaying={isPlaying}
      showArtwork={artwork.show}
      testID={testID}
      timeRange={t('features.clip.clip_time_range', {
        hhmmssEnd: formatHHMMSS(Number(chapter.end_time)),
        hhmmssStart: formatHHMMSS(Number(chapter.start_time)),
      })}
      title={chapter.title ?? chapter.id_text}
    />
  );
}
