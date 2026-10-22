import { beforeEach, describe, expect, it } from 'vitest';

import type { SidebarAccordionState } from './localSettings.js';
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

const allClosed: SidebarAccordionState = { library: false };

const allOpen: SidebarAccordionState = { library: true };

describe('local-settings sidebar accordion (sba)', () => {
  beforeEach(() => {
    clearLocalSettingsCookie();
  });

  it('starts the Library accordion open when no cookie is present', () => {
    expect(getParsedLocalSettings().sba).toEqual(allOpen);
  });

  it('starts the Library accordion open when the cookie has no accordion', () => {
    writeLocalSettings(baseSettings);

    expect(getParsedLocalSettings().sba).toEqual(allOpen);
  });

  it('keeps the Library accordion closed when the cookie saved that choice', () => {
    writeLocalSettings({ ...baseSettings, sba: allClosed });

    expect(getParsedLocalSettings().sba).toEqual(allClosed);
  });

  it('keeps a saved Library close from an older cookie and leaves other settings', () => {
    writeLocalSettings({
      ...baseSettings,
      sba: { podcasts: true, music: false, addByRSS: true, library: false },
    });

    const settings = getParsedLocalSettings();

    expect(settings.sba).toEqual({ library: false });
    expect(settings.vs).toBe('grid');
  });
});
