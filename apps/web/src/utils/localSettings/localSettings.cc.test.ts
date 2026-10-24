import { beforeEach, describe, expect, it } from 'vitest';

import { COOKIE_CONSENT_MODEL_VERSION } from '../../lib/cookieConsent/cookieConsentPolicy.js';
import { getParsedLocalSettings } from './localSettings.js';

function clearLocalSettingsCookie(): void {
  document.cookie = 'local-settings=; path=/; max-age=0';
}

function writeLocalSettings(value: Record<string, unknown>): void {
  document.cookie = `local-settings=${encodeURIComponent(JSON.stringify(value))}; path=/`;
}

const baseSettings = {
  uit: 'light',
  vs: 'grid',
  seda: false,
  aqc: { rp: false, rd: false },
};

const at = '2026-01-01T00:00:00.000Z';

describe('local-settings cookie consent (cc)', () => {
  beforeEach(() => {
    clearLocalSettingsCookie();
  });

  it('keeps other fields when cc is an older features choice', () => {
    writeLocalSettings({
      ...baseSettings,
      cc: { choice: 'features', at },
    });

    const settings = getParsedLocalSettings();
    expect(settings.uit).toBe('light');
    expect(settings.cc).toBeUndefined();
  });

  it('round-trips a v2 essential choice', () => {
    writeLocalSettings({
      ...baseSettings,
      cc: { choice: 'essential', at, v: COOKIE_CONSENT_MODEL_VERSION },
    });

    expect(getParsedLocalSettings().cc).toEqual({
      choice: 'essential',
      at,
      v: COOKIE_CONSENT_MODEL_VERSION,
    });
  });

  it('drops an unversioned essential choice and keeps uit', () => {
    writeLocalSettings({
      ...baseSettings,
      cc: { choice: 'essential', at },
    });

    const settings = getParsedLocalSettings();
    expect(settings.cc).toBeUndefined();
    expect(settings.uit).toBe('light');
  });
});
