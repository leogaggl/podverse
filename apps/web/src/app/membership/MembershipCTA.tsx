'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { membershipPurchaseAction, membershipPurchaseMessageKey } from '@podverse/helpers';
import { Button } from '@podverse/ui';

import { ROUTES } from '../../constants/routes';

import styles from '../../styles/app/membership/Membership.module.scss';

type MembershipCTAProps = {
  ssrLoggedInAccount: boolean;
  isMembershipExpired: boolean;
  isFreeTrial: boolean;
  isPaidPremium: boolean;
  membershipExpiresAt: Date | string | null | undefined;
};

export function MembershipCTA({
  ssrLoggedInAccount,
  isMembershipExpired,
  isFreeTrial,
  isPaidPremium,
  membershipExpiresAt,
}: MembershipCTAProps) {
  const t = useTranslations('membership');
  const tAuth = useTranslations('authentication');
  const router = useRouter();
  const loggedInPurchaseLabel = t(
    membershipPurchaseMessageKey(
      membershipPurchaseAction({
        isLoggedIn: true,
        tier: isPaidPremium ? 'premium' : isFreeTrial ? 'trial' : null,
      })
    )
  );

  return (
    <section className={styles.ctaSection}>
      {!ssrLoggedInAccount && (
        <div className={styles.cta}>
          <Button variant="primary" onClick={() => router.push(ROUTES.SIGN_UP)}>
            {tAuth('sign_up')}
          </Button>
        </div>
      )}
      {ssrLoggedInAccount && isMembershipExpired && (
        <div className={styles.cta}>
          <Button variant="primary" onClick={() => router.push(ROUTES.CHECKOUT)}>
            {loggedInPurchaseLabel}
          </Button>
        </div>
      )}
      {ssrLoggedInAccount && !isMembershipExpired && isFreeTrial && (
        <div className={styles.cta}>
          <Button variant="primary" onClick={() => router.push(ROUTES.CHECKOUT)}>
            {loggedInPurchaseLabel}
          </Button>
        </div>
      )}
      {ssrLoggedInAccount && !isMembershipExpired && isPaidPremium && membershipExpiresAt && (
        <div className={styles.cta}>
          <Button variant="primary" onClick={() => router.push(ROUTES.CHECKOUT)}>
            {loggedInPurchaseLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
