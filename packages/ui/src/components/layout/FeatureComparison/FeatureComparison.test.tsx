import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FeatureComparison } from './FeatureComparison';

const labels = {
  available: 'Available',
  comingSoon: 'Coming Soon',
  feature: 'Feature',
  legends: [] as { mark: string; text: string }[],
};

afterEach(() => {
  cleanup();
});

describe('FeatureComparison', () => {
  it('renders one header column per tier and one row per feature', () => {
    render(
      <FeatureComparison
        tiers={[
          { id: 'a', name: 'Tier A' },
          { id: 'b', name: 'Tier B' },
        ]}
        features={[
          { name: 'First', available: { a: true, b: false } },
          { name: 'Second', available: { a: false, b: true } },
        ]}
        labels={labels}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Feature' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Tier A' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Tier B' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'First' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Second' })).toBeTruthy();
  });

  it('renders checkmarks only where available[tier.id] is true', () => {
    render(
      <FeatureComparison
        tiers={[{ id: 'free', name: 'Free' }]}
        features={[{ name: 'One', available: { free: true } }]}
        labels={labels}
      />
    );

    expect(screen.getByLabelText('Available')).toBeTruthy();
  });

  it('does not render checkmarks when available is false', () => {
    render(
      <FeatureComparison
        tiers={[{ id: 'free', name: 'Free' }]}
        features={[{ name: 'One', available: { free: false } }]}
        labels={labels}
      />
    );

    expect(screen.queryByLabelText('Available')).toBeNull();
  });

  it('joins tier columns into one Coming soon cell', () => {
    render(
      <FeatureComparison
        tiers={[
          { id: 'free', name: 'Free' },
          { id: 'premium', name: 'Premium' },
        ]}
        features={[
          { name: 'Comments', available: { free: false, premium: false }, comingSoon: true },
        ]}
        labels={labels}
      />
    );

    expect(screen.getByRole('cell', { name: 'Comments: Coming Soon' })).toBeTruthy();
    expect(screen.queryByLabelText('Available')).toBeNull();
  });

  it('keeps a name mark in the feature cell and lists each legend once', () => {
    render(
      <FeatureComparison
        tiers={[
          { id: 'free', name: 'Free' },
          { id: 'premium', name: 'Premium' },
        ]}
        features={[
          {
            name: 'Subscribe to Podcasts *',
            available: { free: true, premium: true },
          },
          {
            name: 'CarPlay',
            available: { free: true, premium: true },
          },
        ]}
        labels={{
          ...labels,
          legends: [
            {
              mark: '*',
              text: 'Free tier is available on the mobile app only. Premium includes the website.',
            },
          ],
        }}
      />
    );

    expect(screen.getByRole('cell', { name: 'Subscribe to Podcasts *' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'CarPlay' })).toBeTruthy();
    expect(screen.getAllByLabelText('Available')).toHaveLength(4);
    expect(
      screen.getByText(
        '* Free tier is available on the mobile app only. Premium includes the website.'
      )
    ).toBeTruthy();
  });
});
