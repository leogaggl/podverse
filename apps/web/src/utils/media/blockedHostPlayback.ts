import type { WebPlaybackErrorKind } from './playbackErrorCopy';
import { openablePlaybackMediaUrl } from './playbackErrorCopy';
import type { ResolveMediaUrlBody } from './resolveMediaRedirect';
import { resolveMediaUrl } from './resolveMediaUrl';

const attemptedIdentities = new Set<string>();
const resolvedUrlByIdentity = new Map<string, string>();
const inflightByIdentity = new Map<string, Promise<BlockedHostPlaybackDecision>>();

export type BlockedHostPlaybackDecision =
  | { type: 'pass' }
  | { type: 'reload'; url: string }
  | {
      type: 'report';
      kind: WebPlaybackErrorKind;
      httpStatus?: number;
      detail: string;
    };

/** The final URL already chosen for this loaded item, if a redirect was resolved. */
export const resolvedPlaybackUrlForIdentity = (identity: string): string | null =>
  resolvedUrlByIdentity.get(identity) ?? null;

/** Try Again starts from the original URL and may resolve a redirect again. */
export const clearBlockedHostPlaybackAttempt = (identity: string): void => {
  attemptedIdentities.delete(identity);
  resolvedUrlByIdentity.delete(identity);
  inflightByIdentity.delete(identity);
};

const reportFor = (
  result: ResolveMediaUrlBody
): Extract<BlockedHostPlaybackDecision, { type: 'report' }> => {
  if (result.reason === 'http_error') {
    const httpStatus = result.httpStatus;
    if (httpStatus === 404 || httpStatus === 410) {
      return {
        type: 'report',
        kind: 'file-not-found',
        detail: result.reason,
        ...(httpStatus === undefined ? {} : { httpStatus }),
      };
    }
    return {
      type: 'report',
      kind: 'host-http',
      detail: result.reason,
      ...(httpStatus === undefined ? {} : { httpStatus }),
    };
  }
  return { type: 'report', kind: 'host-blocked', detail: result.reason };
};

const decideOnce = async (params: {
  kind: WebPlaybackErrorKind;
  mediaUrl: string | null;
  identity: string;
  credentialsProtected: boolean;
}): Promise<BlockedHostPlaybackDecision> => {
  if (params.kind !== 'host-blocked' || params.credentialsProtected) {
    return { type: 'pass' };
  }
  const openable = openablePlaybackMediaUrl(params.mediaUrl);
  if (openable === null) {
    return { type: 'pass' };
  }
  if (attemptedIdentities.has(params.identity)) {
    return { type: 'pass' };
  }
  attemptedIdentities.add(params.identity);
  const result = await resolveMediaUrl(openable);
  if (result.reason === 'resolved' && result.url !== null && result.url !== openable) {
    resolvedUrlByIdentity.set(params.identity, result.url);
    return { type: 'reload', url: result.url };
  }
  return reportFor(result);
};

/**
 * For a host-blocked load, ask once whether a redirect's final URL can be played directly.
 * A credentials-protected Add by RSS feed is left unchanged.
 */
export const decideBlockedHostPlayback = (params: {
  kind: WebPlaybackErrorKind;
  mediaUrl: string | null;
  identity: string;
  credentialsProtected: boolean;
}): Promise<BlockedHostPlaybackDecision> => {
  const pending = inflightByIdentity.get(params.identity);
  if (pending !== undefined && params.kind === 'host-blocked' && !params.credentialsProtected) {
    return pending;
  }
  const promise = decideOnce(params).finally(() => {
    if (inflightByIdentity.get(params.identity) === promise) {
      inflightByIdentity.delete(params.identity);
    }
  });
  if (params.kind === 'host-blocked' && !params.credentialsProtected) {
    inflightByIdentity.set(params.identity, promise);
  }
  return promise;
};
