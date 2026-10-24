'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { ChipRow } from '@podverse/ui';

import type { MediaListChip, MediaListChipsPage } from '../../utils/mediaListChips';
import {
  buildMediaListChipPath,
  MEDIA_LIST_CHIP_LABEL_KEYS,
  writeMediaListChip,
} from '../../utils/mediaListChips';

import styles from '../../styles/components/MediaListChips/MediaListChips.module.scss';

/** What a server page knows about the chip row. Serializable; a client adds `trailing`. */
export type MediaListChipsConfig = {
  page: MediaListChipsPage;
  chips: readonly MediaListChip[];
  selected: MediaListChip;
  urlChip: MediaListChip | null;
};

type MediaListChipsProps = MediaListChipsConfig & {
  /**
   * Controls after the media chips, in this order: Category (Browse only, where it applies),
   * Sort, then the gear. Mount each only when the selected chip can use it.
   */
  trailing?: ReactNode;
};

/**
 * Media chips plus the trailing controls for Subscribed, Browse, Add by RSS, and
 * Recommendations.
 */
export function MediaListChips({ page, chips, selected, urlChip, trailing }: MediaListChipsProps) {
  const t = useTranslations();
  const router = useRouter();

  useEffect(() => {
    // A chip named in the URL is remembered once, when this row mounts.
    if (urlChip !== null) {
      writeMediaListChip(page, urlChip);
    }
  }, []);

  const onSelect = (chip: MediaListChip) => {
    if (chip === selected) {
      return;
    }
    writeMediaListChip(page, chip);
    const path = buildMediaListChipPath(page, chip);
    const current = `${window.location.pathname}${window.location.search}`;
    if (path === current) {
      router.refresh();
      return;
    }
    router.replace(path);
  };

  return (
    <ChipRow
      className={styles.chipRow}
      items={chips.map((chip) => ({ key: chip, label: t(MEDIA_LIST_CHIP_LABEL_KEYS[chip]) }))}
      onSelect={onSelect}
      selectedKey={selected}
      testId="media-list-chips"
      trailing={trailing}
    />
  );
}
