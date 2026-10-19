import { redirect } from 'next/navigation';

import { getManagementSessionUser } from '../../../../lib/auth/serverManagementSession';
import { canReadFeeds } from '../../../../lib/managementPermissions';
import { ROUTES } from '../../../../lib/routes';
import { MergeReviewPageClient } from './MergeReviewPageClient';

export default async function FeedMergeReviewPage() {
  const user = await getManagementSessionUser();
  if (!user) {
    redirect(ROUTES.HOME);
  }
  if (!canReadFeeds(user)) {
    redirect(ROUTES.DASHBOARD);
  }
  return <MergeReviewPageClient user={user} />;
}
