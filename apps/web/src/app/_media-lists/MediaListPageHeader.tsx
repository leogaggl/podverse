'use client';

import { useTranslations } from 'next-intl';

import { MainHeader } from '@podverse/ui';

import type { MediaListScope } from '../../utils/mediaListChips';

type MediaListPageHeaderProps = { scope: MediaListScope };

/** Subscribed or Browse title. The list's controls live in its chip row. */
export function MediaListPageHeader({ scope }: MediaListPageHeaderProps) {
  const tSubscriptions = useTranslations('subscriptions');
  const tFeatures = useTranslations('features');
  const title = scope === 'subscribed' ? tSubscriptions('subscribed') : tFeatures('browse.browse');
  return <MainHeader title={title} />;
}
