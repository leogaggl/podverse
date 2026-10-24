'use client';

import { useTranslations } from 'next-intl';

import type { MembershipState } from '@podverse/helpers';
import { membershipPurchaseAction, membershipPurchaseMessageKey } from '@podverse/helpers';
import { Button } from '@podverse/ui';

import { ROUTES } from '../../constants/routes';

import styles from '../../styles/app/membership/Membership.module.scss';

type MembershipCTAProps = {
  loggedIn: boolean;
  tier: MembershipState['tier'];
};

export function MembershipCTA({ loggedIn, tier }: MembershipCTAProps) {
  const t = useTranslations('membership');
  const tAuth = useTranslations('authentication');
  const purchaseLabel = t(
    membershipPurchaseMessageKey(membershipPurchaseAction({ isLoggedIn: loggedIn, tier }))
  );

  return (
    <section className={styles.ctaSection}>
      <div className={styles.cta}>
        {loggedIn ? (
          <Button href={ROUTES.CHECKOUT} variant="success">
            {purchaseLabel}
          </Button>
        ) : (
          <Button href={ROUTES.SIGN_UP} variant="primary">
            {tAuth('sign_up')}
          </Button>
        )}
      </div>
    </section>
  );
}
