import { UNIVERSAL_LINK_PATH_PREFIXES } from '@podverse/helpers';

/** Android package used when fingerprints are set and no package name is configured. */
export const DEFAULT_ANDROID_APP_LINK_PACKAGE_NAME = 'com.podverse.app.next';

const APP_LINK_RELATION = 'delegate_permission/common.handle_all_urls';

export type AppleAppLinkComponent = {
  '/': string;
};

export type AppleAppSiteAssociation = {
  applinks: {
    details: Array<{
      appIDs: string[];
      components: AppleAppLinkComponent[];
    }>;
  };
};

export type AndroidAssetLinksStatement = {
  relation: [typeof APP_LINK_RELATION];
  target: {
    namespace: 'android_app';
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
};

/** Split a comma- or whitespace-delimited env value. Empty and whitespace-only entries are dropped. */
export const parseDelimitedList = (raw: string | undefined): string[] => {
  return (raw ?? '')
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

/**
 * Apple app site association for the configured iOS app ids. Returns null when no app id is set
 * so the route can answer 404 instead of publishing an empty file.
 */
export const buildAppleAppSiteAssociation = (
  appIds: readonly string[]
): AppleAppSiteAssociation | null => {
  if (appIds.length === 0) {
    return null;
  }
  const components: AppleAppLinkComponent[] = UNIVERSAL_LINK_PATH_PREFIXES.map((prefix) => {
    return { '/': `${prefix}*` };
  });
  return {
    applinks: {
      details: [
        {
          appIDs: [...appIds],
          components,
        },
      ],
    },
  };
};

/**
 * Digital Asset Links statement for the configured Android signing certificates. Returns null
 * when no fingerprint is set. An empty package name uses {@link DEFAULT_ANDROID_APP_LINK_PACKAGE_NAME}.
 */
export const buildAndroidAssetLinks = (
  packageName: string | undefined,
  fingerprints: readonly string[]
): AndroidAssetLinksStatement[] | null => {
  if (fingerprints.length === 0) {
    return null;
  }
  const resolvedPackage =
    packageName !== undefined && packageName.trim() !== ''
      ? packageName.trim()
      : DEFAULT_ANDROID_APP_LINK_PACKAGE_NAME;
  return [
    {
      relation: [APP_LINK_RELATION],
      target: {
        namespace: 'android_app',
        package_name: resolvedPackage,
        sha256_cert_fingerprints: [...fingerprints],
      },
    },
  ];
};
