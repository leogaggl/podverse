import { beforeEach, describe, expect, it } from 'vitest';

import { getParsedLocalSettings } from './localSettings.js';

function clearLocalSettingsCookie(): void {
  document.cookie = 'local-settings=; path=/; max-age=0';
}

describe('local-settings background activity expanded (bae)', () => {
  beforeEach(() => {
    clearLocalSettingsCookie();
  });

  it('defaults bae to false when no cookie is present', () => {
    expect(getParsedLocalSettings().bae).toBe(false);
  });

  it('inherits the default bae for cookies that predate the field', () => {
    const legacy = {
      uit: 'light',
      vs: 'grid',
      seda: false,
      aqc: { rp: false, rd: false },
    };
    document.cookie = `local-settings=${encodeURIComponent(JSON.stringify(legacy))}; path=/`;

    expect(getParsedLocalSettings().bae).toBe(false);
  });

  it('reads bae true from the cookie', () => {
    const expanded = {
      uit: 'light',
      vs: 'grid',
      seda: false,
      aqc: { rp: false, rd: false },
      bae: true,
    };
    document.cookie = `local-settings=${encodeURIComponent(JSON.stringify(expanded))}; path=/`;

    expect(getParsedLocalSettings().bae).toBe(true);
  });

  it('falls back to defaults when bae is not a boolean', () => {
    const invalid = {
      uit: 'light',
      vs: 'grid',
      seda: false,
      aqc: { rp: false, rd: false },
      bae: 'yes',
    };
    document.cookie = `local-settings=${encodeURIComponent(JSON.stringify(invalid))}; path=/`;

    expect(getParsedLocalSettings().bae).toBe(false);
  });
});
