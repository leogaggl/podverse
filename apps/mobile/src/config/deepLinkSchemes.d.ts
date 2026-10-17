import type { UNIVERSAL_LINK_PATH_PREFIXES } from '@podverse/helpers';

export declare const DEFAULT_MOBILE_DEEP_LINK_SCHEMES: readonly ['podverse-next', 'podverse'];

export declare function parseMobileDeepLinkSchemes(raw: string | undefined): string[];

export declare function buildMobileLinkPrefixes(
  schemes: string[],
  webBaseUrl: string | null
): string[];

export declare const MOBILE_UNIVERSAL_LINK_PATH_PREFIXES: typeof UNIVERSAL_LINK_PATH_PREFIXES;
