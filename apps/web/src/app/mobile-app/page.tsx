import { getTranslations } from 'next-intl/server';

import { CenteredMessage, MainHeader } from '@podverse/ui';

import { MainWrapper } from '../../components/Main/MainWrapper';
import { getCuratedStaticPageMetadata } from '../../lib/seo/curatedPageMetadata';

export async function generateMetadata() {
  return getCuratedStaticPageMetadata('mobileApp');
}

export default async function MobileAppPage() {
  const tSeo = await getTranslations('seo');
  const tPlayer = await getTranslations('media_player');

  return (
    <>
      <MainHeader title={tSeo('pages.mobileApp.title')} />
      <MainWrapper>
        <CenteredMessage live="status">{tPlayer('coming_soon')}</CenteredMessage>
      </MainWrapper>
    </>
  );
}
