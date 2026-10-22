'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { ButtonTabs } from '@podverse/ui';

import type { MediaListChip, MediaListChipsPage } from '../../utils/mediaListChips';
import {
  buildMediaListChipPath,
  MEDIA_LIST_CHIP_LABEL_KEYS,
  writeMediaListChip,
} from '../../utils/mediaListChips';

import styles from '../../styles/components/MediaListChips/MediaListChips.module.scss';

type MediaListChipsProps = {
  page: MediaListChipsPage;
  chips: readonly MediaListChip[];
  selected: MediaListChip;
  urlChip: MediaListChip | null;
};

/** Chip row for Subscribed, Browse, and Add by RSS. */
export function MediaListChips({ page, chips, selected, urlChip }: MediaListChipsProps) {
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
    <div className={styles.chipRow} data-testid="media-list-chips">
      <ButtonTabs
        buttonTabs={chips.map((chip) => ({
          key: chip,
          label: t(MEDIA_LIST_CHIP_LABEL_KEYS[chip]),
          onClick: () => onSelect(chip),
        }))}
        className={styles.chips}
        selectedKey={selected}
      />
    </div>
  );
}
