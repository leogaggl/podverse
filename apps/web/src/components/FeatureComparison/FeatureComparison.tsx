'use client';

import type { FC } from 'react';

import type { DTOMembershipComparison } from '@podverse/helpers';
import type { FeatureComparisonRow } from '@podverse/ui';
import { FeatureComparison as SharedFeatureComparison } from '@podverse/ui';

type FeatureComparisonProps = {
  document: DTOMembershipComparison;
};

export const FeatureComparison: FC<FeatureComparisonProps> = ({ document }) => {
  const rows: FeatureComparisonRow[] = document.features.map((feature) => ({
    available: { free: feature.free, premium: feature.premium },
    comingSoon: feature.comingSoon,
    name: feature.name,
  }));

  return (
    <SharedFeatureComparison
      features={rows}
      labels={{
        available: document.availableLabel,
        comingSoon: document.comingSoonLabel,
        feature: document.featureColumnLabel,
        legends: document.legends,
      }}
      tiers={document.tiers.map((tier) => ({ id: tier.id, name: tier.label }))}
    />
  );
};
