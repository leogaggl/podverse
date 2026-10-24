'use client';

import { useTranslations } from 'next-intl';

import type { DTOMembershipComparison } from '@podverse/helpers';

import { FeatureComparison } from '../../components/FeatureComparison/FeatureComparison';
import { TrialLimitationsCollapsible } from './TrialLimitationsCollapsible';
import { useMembershipComparison } from './useMembershipComparison';

import styles from '../../styles/app/membership/Membership.module.scss';

type MembershipComparisonProps = {
  initial: DTOMembershipComparison | null;
  showHeading?: boolean;
};

export function MembershipComparison({ initial, showHeading = false }: MembershipComparisonProps) {
  const t = useTranslations('membership');
  const document = useMembershipComparison(initial);

  const table = <FeatureComparison document={document} />;

  return (
    <>
      {showHeading ? (
        <section>
          <h2 className={styles.comparisonTitle}>{t('features')}</h2>
          {table}
        </section>
      ) : (
        table
      )}
      <TrialLimitationsCollapsible limitations={document.trialLimitations} />
    </>
  );
}
