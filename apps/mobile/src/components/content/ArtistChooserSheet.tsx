import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { LineArtist } from '../../lib/playback/lineArtist';
import { lineArtistKey, lineArtistTitle } from '../../lib/playback/lineArtist';
import type { MoreMenuSection } from '../primitives/MoreMenu';
import { MoreMenu } from '../primitives/MoreMenu';

export type ArtistChooserSheetProps = {
  artists: readonly LineArtist[];
  onCancel: () => void;
  onSelect: (artist: LineArtist) => void;
  /** Root testID. Rows are `${testID}-artist-${index}`; cancel is `${testID}-cancel`. */
  testID: string;
  visible: boolean;
};

/** Lists artists in a bottom sheet. Callers set `visible` false from `onSelect` and `onCancel`. */
export function ArtistChooserSheet({
  artists,
  onCancel,
  onSelect,
  testID,
  visible,
}: ArtistChooserSheetProps) {
  const { t } = useTranslation();
  const sections = useMemo<MoreMenuSection[]>(
    () => [
      {
        items: artists.map((artist, index) => ({
          key: lineArtistKey(artist),
          label: lineArtistTitle(artist),
          onPress: () => {
            onSelect(artist);
          },
          testID: `${testID}-artist-${index}`,
        })),
        key: 'artists',
        title: t('media.music.artists'),
      },
    ],
    [artists, onSelect, t, testID]
  );

  return (
    <MoreMenu
      cancelLabel={t('misc.cancel')}
      cancelTestID={`${testID}-cancel`}
      onCancel={onCancel}
      sections={sections}
      testID={testID}
      visible={visible}
    />
  );
}
