import type { DTOClip, DTOItemSoundbite } from '@podverse/helpers';

export type MediaPlayerSegmentKind = 'chapter' | 'clip' | 'official-clip';

export type MediaPlayerSegmentStripSegment = {
  kind: MediaPlayerSegmentKind;
  title: string;
};

/**
 * The segment the strip above the player bar names, or `null` when the whole item is playing.
 * `subsectionTitle` comes from `getMediaPlayerInfoResolution`; the kind follows the same
 * precedence (clip, then official clip, then chapter).
 */
export const resolveMediaPlayerSegmentStripSegment = ({
  hasContent,
  mpClip,
  mpItemSoundbite,
  subsectionTitle,
}: {
  hasContent: boolean;
  mpClip: DTOClip | null;
  mpItemSoundbite: DTOItemSoundbite | null;
  subsectionTitle: string | null;
}): MediaPlayerSegmentStripSegment | null => {
  if (!hasContent) {
    return null;
  }
  const title = subsectionTitle?.trim() ?? '';
  if (title === '') {
    return null;
  }
  const kind: MediaPlayerSegmentKind =
    mpClip !== null ? 'clip' : mpItemSoundbite !== null ? 'official-clip' : 'chapter';
  return { kind, title };
};

/** `media_player` catalog key for the strip's accessible label (`{title}` interpolated). */
export const mediaPlayerSegmentStripLabelKey = (
  kind: MediaPlayerSegmentKind
): 'segment_strip_chapter' | 'segment_strip_clip' | 'segment_strip_official_clip' => {
  switch (kind) {
    case 'chapter':
      return 'segment_strip_chapter';
    case 'clip':
      return 'segment_strip_clip';
    case 'official-clip':
      return 'segment_strip_official_clip';
  }
};
