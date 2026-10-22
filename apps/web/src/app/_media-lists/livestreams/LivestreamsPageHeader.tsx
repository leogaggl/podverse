'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import { MainHeader } from '@podverse/ui';

import { useLivestreamsPageContext } from './LivestreamsPageContext';

export const LivestreamsPageHeader: React.FC = () => {
  const { scope } = useLivestreamsPageContext();
  const tSubscriptions = useTranslations('subscriptions');
  const tFeatures = useTranslations('features');
  const title = scope === 'subscribed' ? tSubscriptions('subscribed') : tFeatures('browse.browse');
  return <MainHeader title={title} />;
};
