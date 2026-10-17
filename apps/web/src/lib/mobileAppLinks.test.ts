import { describe, expect, it } from 'vitest';

import { UNIVERSAL_LINK_PATH_PREFIXES } from '@podverse/helpers';

import {
  buildAndroidAssetLinks,
  buildAppleAppSiteAssociation,
  DEFAULT_ANDROID_APP_LINK_PACKAGE_NAME,
  parseDelimitedList,
} from './mobileAppLinks';

describe('parseDelimitedList', () => {
  it('splits on commas and whitespace and drops empty entries', () => {
    expect(parseDelimitedList(' DF9KG8H54B.com.podverse.app.next, com.example.app ')).toEqual([
      'DF9KG8H54B.com.podverse.app.next',
      'com.example.app',
    ]);
    expect(parseDelimitedList(undefined)).toEqual([]);
    expect(parseDelimitedList('   ')).toEqual([]);
  });
});

describe('buildAppleAppSiteAssociation', () => {
  it('returns null when no iOS app id is configured', () => {
    expect(buildAppleAppSiteAssociation([])).toBeNull();
  });

  it('lists each configured app id and the shared path prefixes', () => {
    const body = buildAppleAppSiteAssociation(['DF9KG8H54B.com.podverse.app.next']);
    expect(body).toEqual({
      applinks: {
        details: [
          {
            appIDs: ['DF9KG8H54B.com.podverse.app.next'],
            components: UNIVERSAL_LINK_PATH_PREFIXES.map((prefix) => ({ '/': `${prefix}*` })),
          },
        ],
      },
    });
  });
});

describe('buildAndroidAssetLinks', () => {
  it('returns null when no certificate fingerprint is configured', () => {
    expect(buildAndroidAssetLinks('com.podverse.app.next', [])).toBeNull();
    expect(buildAndroidAssetLinks(undefined, [])).toBeNull();
  });

  it('uses the default package when fingerprints are set and the package name is empty', () => {
    expect(buildAndroidAssetLinks(undefined, ['AA:BB'])).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: DEFAULT_ANDROID_APP_LINK_PACKAGE_NAME,
          sha256_cert_fingerprints: ['AA:BB'],
        },
      },
    ]);
  });

  it('keeps a configured package name and every fingerprint', () => {
    expect(buildAndroidAssetLinks('com.example.app', ['AA:BB', 'CC:DD'])).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.example.app',
          sha256_cert_fingerprints: ['AA:BB', 'CC:DD'],
        },
      },
    ]);
  });
});
