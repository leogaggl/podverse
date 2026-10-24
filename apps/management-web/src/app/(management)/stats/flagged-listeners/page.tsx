import { redirect } from 'next/navigation';

import { getManagementSessionUser } from '../../../../lib/auth/serverManagementSession';
import { ROUTES } from '../../../../lib/routes';
import { FlaggedListenersPageClient } from './FlaggedListenersPageClient';

export default async function FlaggedListenersPage() {
  const user = await getManagementSessionUser();
  if (!user) {
    redirect(ROUTES.HOME);
  }

  return <FlaggedListenersPageClient user={user} />;
}
