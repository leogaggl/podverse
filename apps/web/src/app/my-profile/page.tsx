import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { buildNoindexMetadata } from '../../lib/seo/buildNoindexMetadata';
import { getSSRAuthService } from '../../utils/auth/ssrAuth';
import { MyProfileLoginRequired } from './MyProfileLoginRequired';
import { MyProfilePageClient } from './MyProfilePageClient';

type MyProfileSearchParams = {
  tab?: string | string[];
};

type MyProfilePageProps = {
  searchParams: Promise<MyProfileSearchParams>;
};

export async function generateMetadata() {
  return buildNoindexMetadata();
}

function isClipsTab(tab: string | string[] | undefined): boolean {
  if (Array.isArray(tab)) {
    return tab.includes('clips');
  }
  return tab === 'clips';
}

export default async function MyProfilePage({ searchParams }: MyProfilePageProps) {
  const { isValidAuthSession, ssrApiRequestService } = await getSSRAuthService();

  if (!isValidAuthSession) {
    const params = await searchParams;
    const tFeatures = await getTranslations('features');
    const title = isClipsTab(params.tab) ? tFeatures('my_clips') : tFeatures('my_profile');
    return <MyProfileLoginRequired title={title} />;
  }

  try {
    const ssrAccount = await ssrApiRequestService.reqAuthMe();

    if (!ssrAccount) {
      redirect('/');
      return;
    }

    return <MyProfilePageClient ssrAccount={ssrAccount} />;
  } catch {
    redirect('/');
  }
}
