'use client';

import { useTranslations } from 'next-intl';
import React from 'react';

import { MainHeader } from '@podverse/ui';

import { useProfilesPageContext } from './ProfilesPageContext';

export const ProfilesPageHeader: React.FC = () => {
  const { listScope } = useProfilesPageContext();
  const tFeatures = useTranslations('features');
  const title = listScope === 'browse' ? tFeatures('browse.browse') : tFeatures('profiles');

  return <MainHeader title={title} />;
};
