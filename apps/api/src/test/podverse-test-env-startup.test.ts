import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  applyPodverseTestEnv,
  buildPodverseApiTestEnv,
  PODVERSE_STARTUP_VALIDATION_SILENT_ENV,
} from '@podverse/helpers-config';

import { validateStartupRequirements } from '../lib/startup/validation.js';

const snapshotProcessEnv = (): Record<string, string | undefined> => ({ ...process.env });

const restoreProcessEnv = (snapshot: Record<string, string | undefined>): void => {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describe('podverse test env startup validation', () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = snapshotProcessEnv();
    applyPodverseTestEnv(PODVERSE_STARTUP_VALIDATION_SILENT_ENV);
  });

  afterEach(() => {
    restoreProcessEnv(envSnapshot);
  });

  it('apiVitest profile passes API startup validation', () => {
    applyPodverseTestEnv(buildPodverseApiTestEnv({ profile: 'apiVitest' }));
    expect(() => validateStartupRequirements()).not.toThrow();
  });

  it('apiWebE2e profile passes API startup validation', () => {
    applyPodverseTestEnv(buildPodverseApiTestEnv({ profile: 'apiWebE2e' }));
    expect(() => validateStartupRequirements()).not.toThrow();
  });

  it('fails startup when STATS_ALL_TIME_RECOUNT_DAYS is greater than STATS_TRACK_EVENT_RETENTION_DAYS', () => {
    applyPodverseTestEnv(buildPodverseApiTestEnv({ profile: 'apiVitest' }));
    process.env.STATS_TRACK_EVENT_RETENTION_DAYS = '60';
    process.env.STATS_ALL_TIME_RECOUNT_DAYS = '61';
    expect(() => validateStartupRequirements()).toThrow();
  });

  it('fails startup when only the retention is lowered below the default recount period', () => {
    applyPodverseTestEnv(buildPodverseApiTestEnv({ profile: 'apiVitest' }));
    process.env.STATS_TRACK_EVENT_RETENTION_DAYS = '60';
    delete process.env.STATS_ALL_TIME_RECOUNT_DAYS;
    expect(() => validateStartupRequirements()).toThrow();
  });

  it('passes startup when STATS_ALL_TIME_RECOUNT_DAYS equals STATS_TRACK_EVENT_RETENTION_DAYS', () => {
    applyPodverseTestEnv(buildPodverseApiTestEnv({ profile: 'apiVitest' }));
    process.env.STATS_TRACK_EVENT_RETENTION_DAYS = '60';
    process.env.STATS_ALL_TIME_RECOUNT_DAYS = '60';
    expect(() => validateStartupRequirements()).not.toThrow();
  });

  it('turns off both botted-listener signals in the web and mobile E2E API profiles', () => {
    for (const profile of ['apiWebE2e', 'apiMobileE2e'] as const) {
      const env = buildPodverseApiTestEnv({ profile });
      expect(env.STATS_FLAG_TOO_SOON_MINUTES).toBe('0');
      expect(env.STATS_FLAG_STORED_CAP_WITHIN_HOURS).toBe('0');
    }
  });
});
