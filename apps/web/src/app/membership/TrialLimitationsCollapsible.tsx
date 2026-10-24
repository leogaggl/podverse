'use client';

import type { DTOMembershipComparison } from '@podverse/helpers';
import { Accordion } from '@podverse/ui';

import styles from '../../styles/app/membership/Membership.module.scss';

type TrialLimitationsCollapsibleProps = {
  limitations: DTOMembershipComparison['trialLimitations'];
};

export function TrialLimitationsCollapsible({ limitations }: TrialLimitationsCollapsibleProps) {
  return (
    <section className={styles.trialLimitationsAccordion}>
      <Accordion
        className={styles.trialLimitationsShell}
        contentClassName={styles.trialLimitationsContent}
        header={limitations.title}
        headerClassName={styles.trialLimitationsHeader}
      >
        <p className={styles.trialLimitationsIntro}>{limitations.summary}</p>
        <ul className={styles.trialLimitationsList}>
          {limitations.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Accordion>
    </section>
  );
}
