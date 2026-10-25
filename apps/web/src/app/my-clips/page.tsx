import { getTranslations } from 'next-intl/server';

import { CenteredMessage, MainHeader } from '@podverse/ui';

import { MainWrapper } from '../../components/Main/MainWrapper';
import { buildNoindexMetadata } from '../../lib/seo/buildNoindexMetadata';

export async function generateMetadata() {
  return buildNoindexMetadata();
}

export default async function MyClipsPage() {
  const tFeatures = await getTranslations('features');
  const tPlayer = await getTranslations('media_player');

  return (
    <>
      <MainHeader title={tFeatures('my_clips')} />
      <MainWrapper>
        <CenteredMessage live="status">{tPlayer('coming_soon')}</CenteredMessage>
      </MainWrapper>
    </>
  );
}
