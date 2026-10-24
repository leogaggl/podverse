import { describe, expect, it } from 'vitest';

import { deviceLabelForMobile, deviceLabelFromUserAgent } from './deviceLabel.js';

const USER_AGENTS = {
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  operaWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  samsungAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  chromeIpad:
    'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1',
  firefoxIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15',
  chromeChromeOs:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

describe('deviceLabelFromUserAgent', () => {
  it('names the browser and the OS', () => {
    expect(deviceLabelFromUserAgent(USER_AGENTS.chromeMac)).toBe('Chrome · macOS');
    expect(deviceLabelFromUserAgent(USER_AGENTS.safariMac)).toBe('Safari · macOS');
    expect(deviceLabelFromUserAgent(USER_AGENTS.edgeWindows)).toBe('Edge · Windows');
    expect(deviceLabelFromUserAgent(USER_AGENTS.operaWindows)).toBe('Opera · Windows');
    expect(deviceLabelFromUserAgent(USER_AGENTS.firefoxLinux)).toBe('Firefox · Linux');
    expect(deviceLabelFromUserAgent(USER_AGENTS.samsungAndroid)).toBe('Samsung Internet · Android');
    expect(deviceLabelFromUserAgent(USER_AGENTS.chromeAndroid)).toBe('Chrome · Android');
    expect(deviceLabelFromUserAgent(USER_AGENTS.safariIphone)).toBe('Safari · iOS');
    expect(deviceLabelFromUserAgent(USER_AGENTS.chromeIpad)).toBe('Chrome · iOS');
    expect(deviceLabelFromUserAgent(USER_AGENTS.firefoxIphone)).toBe('Firefox · iOS');
    expect(deviceLabelFromUserAgent(USER_AGENTS.chromeChromeOs)).toBe('Chrome · ChromeOS');
  });

  it('returns whichever half it recognizes', () => {
    expect(deviceLabelFromUserAgent('SomeClient/1.0 (Windows NT 10.0)')).toBe('Windows');
    expect(deviceLabelFromUserAgent('Firefox/125.0')).toBe('Firefox');
  });

  it('returns null for an unknown, empty, or missing agent', () => {
    expect(deviceLabelFromUserAgent('curl/8.4.0')).toBeNull();
    expect(deviceLabelFromUserAgent('')).toBeNull();
    expect(deviceLabelFromUserAgent(undefined)).toBeNull();
  });
});

describe('deviceLabelForMobile', () => {
  it('uses the label the app sends', () => {
    expect(deviceLabelForMobile({ bodyLabel: 'Pixel 8', platformHeader: 'android' })).toBe(
      'Pixel 8'
    );
  });

  it('falls back to the platform header when the label is missing, blank, or not a string', () => {
    expect(deviceLabelForMobile({ bodyLabel: undefined, platformHeader: 'ios' })).toBe('iOS');
    expect(deviceLabelForMobile({ bodyLabel: '   ', platformHeader: 'android' })).toBe('Android');
    expect(deviceLabelForMobile({ bodyLabel: 42, platformHeader: 'iOS' })).toBe('iOS');
  });

  it('returns null with no label and an unknown or missing platform', () => {
    expect(deviceLabelForMobile({ bodyLabel: undefined, platformHeader: 'web' })).toBeNull();
    expect(deviceLabelForMobile({ bodyLabel: null, platformHeader: undefined })).toBeNull();
    expect(
      deviceLabelForMobile({ bodyLabel: undefined, platformHeader: 'constructor' })
    ).toBeNull();
  });
});
