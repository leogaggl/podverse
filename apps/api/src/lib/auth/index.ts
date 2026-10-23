import { config } from '@api/config/index.js';
import { loggerService } from '@api/factories/loggerService.js';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import passport from 'passport';

import type { AccountEntitlementCapability, AuthSessionEndedNotice } from '@podverse/helpers';
import {
  APP_ROUTES,
  AUTH_SESSION_ENDED_CODE,
  AuthCookieName,
  BILLING_CLIENT_PLATFORM_HEADER,
  ERROR_MESSAGES,
  hasValidMembership,
} from '@podverse/helpers';
import type { AccountSessionRow, FindOptionsRelations } from '@podverse/orm';
import {
  Account,
  AccountService,
  BillingPriceCatalogService,
  findOptionsRelationsFromPaths,
  mergeFindOptionsRelations,
} from '@podverse/orm';

import { accountHasCapability, getAccountEntitlements } from '../accountEntitlements.js';
import {
  checkAccountSession,
  endAccountSession,
  renewAccountSession,
  rotateMobileRefreshToken,
  startAccountSession,
} from './accountSessionStore.js';
import { deviceLabelForMobile, deviceLabelFromUserAgent } from './deviceLabel.js';
import { verifyPassword } from './password.js';
import type { RequestToken } from './sessionTokens.js';
import {
  classifyAccessJwt,
  classifyRefreshJwt,
  readRequestToken,
  signMobileTokenPair,
  signWebSessionToken,
  verifySessionJwt,
} from './sessionTokens.js';

/**
 * Every login starts an `account_session` row, and every token names that row in its `sid` claim.
 * Web gets one token in the `jwt` cookie. Token clients (the mobile app) get a short access token
 * for requests and a refresh token that rotates on every refresh. Each authenticated request
 * checks the row, so ending a session takes effect on that session's next request; rotating
 * AUTH_JWT_SECRET ends every session at once.
 *
 * Use renews a session at most once per ACCOUNT_SESSION_RENEW_INTERVAL_MS, moving its idle expiry
 * AUTH_SESSION_IDLE_EXPIRATION past that use. A web cookie is re-signed when its row renews; a
 * mobile refresh renews the row and issues a refresh token with a fresh expiry.
 *
 * Login responses omit `token` unless AUTH_ALLOW_TOKEN_IN_RESPONSE_BODY=true and the client sends
 * includeTokenInResponseBody.
 */
const isProduction = config.nodeEnv === 'production';
const MEMBERSHIP_EXPIRED_I18N_KEY = 'membership.membership_expired';

type AuthenticatedRequestOptions = {
  skipMembershipStatus: boolean;
  skipTermsAcceptance?: boolean;
  requiredCapability?: AccountEntitlementCapability;
};

/** What a valid token naming an ended session gets: a 401, or (public routes) anonymous access. */
type EndedSessionHandling = 'reject' | 'anonymous';

type UnauthorizedBody =
  | { message: string }
  | { message: string; code: typeof AUTH_SESSION_ENDED_CODE; notice: AuthSessionEndedNotice };

/** The notice rides on the 401 only when the session was ended somewhere else. */
function unauthorizedBody(
  message: string,
  notice: AuthSessionEndedNotice | null
): UnauthorizedBody {
  if (notice === null) {
    return { message };
  }
  return { message, code: AUTH_SESSION_ENDED_CODE, notice };
}

/**
 * Repository accounts are entity instances and include the terms relation when this check runs.
 * A plain object that omits the relation is not a terms decision.
 */
function accountNeedsCurrentTerms(account: Account, configuredVersion: string): boolean {
  const isEntity = account instanceof Account;
  const includesAcceptance = Object.prototype.hasOwnProperty.call(
    account,
    'account_terms_acceptance'
  );
  if (!isEntity && !includesAcceptance) {
    return false;
  }
  return account.account_terms_acceptance?.terms_version !== configuredVersion;
}

type AccountCredentialAuthResult =
  | { id: number; id_text: string; kind: 'authenticated' }
  | { kind: 'not_verified' }
  | { kind: 'unauthorized' };

/**
 * Password is checked before `verified`. A rejection that names an unverified account before
 * the password matches would tell the caller the address exists.
 */
const authenticateAccountCredentials = async (
  identifier: string,
  password: string
): Promise<AccountCredentialAuthResult> => {
  if (!password) {
    return { kind: 'unauthorized' };
  }

  const account = identifier.includes('@')
    ? await getAccountService().getByEmail(identifier, {
        relations: { account_credentials: true },
      })
    : await getAccountService().getByUsername(identifier, {
        relations: { account_credentials: true },
      });

  const passwordHash = account?.account_credentials?.password;
  if (!account || passwordHash === undefined || passwordHash === '') {
    return { kind: 'unauthorized' };
  }

  const isMatch = await verifyPassword(password, passwordHash);
  if (!isMatch) {
    return { kind: 'unauthorized' };
  }

  if (!account.verified) {
    return { kind: 'not_verified' };
  }

  if (!account.id_text) {
    return { kind: 'unauthorized' };
  }

  return {
    id: account.id,
    id_text: account.id_text,
    kind: 'authenticated',
  };
};

// AccountService is constructed per lookup so Vitest per-file vi.mock('@podverse/orm')
// stays effective (no stale cached instance from another test file).
function getAccountService(): AccountService {
  return new AccountService();
}

/**
 * Load the account for JWT identity claims and accept it only when `id_text` still matches.
 * Access-token verification and mobile refresh share this so a deleted or replaced account cannot
 * keep minting tokens while protected routes reject them.
 */
async function getAccountMatchingJwtIdentity(
  claims: { id: number; id_text: string },
  options?: { relations?: FindOptionsRelations<Account> }
): Promise<Account | null> {
  const account = await getAccountService().get(claims.id, options);
  if (!account) {
    return null;
  }

  const accountIdText =
    typeof account.id_text === 'string' && account.id_text !== '' ? account.id_text : undefined;
  if (accountIdText === undefined || accountIdText !== claims.id_text) {
    return null;
  }

  return account;
}

let billingPriceCatalogServiceSingleton: BillingPriceCatalogService | undefined;
function getBillingPriceCatalogService(): BillingPriceCatalogService {
  if (billingPriceCatalogServiceSingleton === undefined) {
    billingPriceCatalogServiceSingleton = new BillingPriceCatalogService();
  }
  return billingPriceCatalogServiceSingleton;
}

/** The cookie's max-age is the idle limit; renewal re-sets it. */
export const setAuthCookie = (res: Response, token: string) => {
  const maxAge = config.auth.sessionCookieMaxAgeMs;
  if (isProduction) {
    const prodCookieOptions: CookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      domain: config.api.cookie.domain,
      path: '/',
      maxAge,
    };
    res.cookie(AuthCookieName, token, prodCookieOptions);
  } else {
    res.cookie(AuthCookieName, token, {
      httpOnly: true,
      secure: false, // dev only
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
  }
};

export const clearAuthCookie = (res: Response) => {
  // Clear cookie without Domain (covers host-only cookies without a trailing dot domain).
  res.clearCookie(AuthCookieName, {
    path: '/',
  });

  // In production also clear the cookie scoped to COOKIE_DOMAIN (cross-subdomain auth).
  if (isProduction) {
    res.clearCookie(AuthCookieName, {
      path: '/',
      domain: config.api.cookie.domain, // e.g. '.podverse.fm'
    });
  }
};

export const initializePassport = () => passport.initialize();

/**
 * One browser holds one session: a login made while the browser still carries a validly signed
 * session cookie ends that earlier session first.
 */
async function endSessionInPresentedCookie(req: Request): Promise<void> {
  const requestToken = readRequestToken(req);
  if (requestToken?.source !== 'cookie') {
    return;
  }
  const classified = classifyAccessJwt(verifySessionJwt(requestToken.token));
  if (classified.kind !== 'session') {
    return;
  }
  try {
    await endAccountSession({
      accountId: classified.claims.id,
      sessionIdText: classified.claims.sid,
      reason: 'signed_out',
    });
  } catch (error) {
    loggerService.logError('Failed to end the session replaced by a new web login', error);
  }
}

async function completeWebLogin(
  req: Request,
  res: Response,
  account: { id: number; id_text: string }
): Promise<void> {
  await endSessionInPresentedCookie(req);

  const { sessionIdText } = await startAccountSession({
    accountId: account.id,
    clientType: 'web',
    deviceLabel: deviceLabelFromUserAgent(req.get('user-agent')),
    withRefreshToken: false,
  });
  const token = signWebSessionToken({
    accountId: account.id,
    accountIdText: account.id_text,
    sessionIdText,
  });

  setAuthCookie(res, token);

  const response: { message: string; token?: string } = {
    message: 'Authenticated successfully',
  };
  const body = req.body as { includeTokenInResponseBody?: unknown } | undefined;
  if (config.auth.allowTokenInResponseBody && Boolean(body?.includeTokenInResponseBody)) {
    response.token = token;
  }

  res.json(response);
}

/** Web login: the same credential check as mobile, then a web session in the `jwt` cookie. */
export const authenticate = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { email?: unknown; password?: unknown } | undefined;
  const identifier = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (identifier === '' || password === '') {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const authResult = await authenticateAccountCredentials(identifier, password);
  if (authResult.kind === 'not_verified') {
    res.status(403).json({ message: ERROR_MESSAGES.ACCOUNT.NOT_VERIFIED });
    return;
  }
  if (authResult.kind !== 'authenticated') {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  await completeWebLogin(req, res, { id: authResult.id, id_text: authResult.id_text });
};

/**
 * Renewal never fails the request. A web session presented through its cookie gets a re-signed
 * cookie; a web token sent as a bearer renews only its row and ends at its own JWT expiry.
 */
async function renewSessionOnUse(
  res: Response,
  requestToken: RequestToken,
  session: AccountSessionRow,
  claims: { id: number; id_text: string; sid: string }
): Promise<void> {
  try {
    const renewed = await renewAccountSession(session);
    if (renewed && session.client_type === 'web' && requestToken.source === 'cookie') {
      setAuthCookie(
        res,
        signWebSessionToken({
          accountId: claims.id,
          accountIdText: claims.id_text,
          sessionIdText: claims.sid,
        })
      );
    }
  } catch (error) {
    loggerService.logError('Account session renewal failed', error);
  }
}

const verifyTokenAndMembership = async (
  req: Request,
  res: Response,
  next: NextFunction,
  requestToken: RequestToken,
  options: AuthenticatedRequestOptions,
  endedSessionHandling: EndedSessionHandling
): Promise<void> => {
  const rejectUnauthorized = (notice: AuthSessionEndedNotice | null) => {
    if (requestToken.source === 'cookie') {
      clearAuthCookie(res);
    }
    res.status(401).json(unauthorizedBody('Unauthorized', notice));
  };

  const classified = classifyAccessJwt(verifySessionJwt(requestToken.token));
  if (classified.kind === 'rejected') {
    rejectUnauthorized(null);
    return;
  }
  const { claims } = classified;

  let relations: FindOptionsRelations<Account> = findOptionsRelationsFromPaths<Account>([
    'account_credentials',
  ]);
  if (!options.skipMembershipStatus) {
    relations = mergeFindOptionsRelations<Account>(relations, [
      'account_membership_status',
      'account_membership_status.account_membership',
    ]);
  }
  const enforceTerms = options.skipTermsAcceptance !== true && config.terms.version !== '';
  if (enforceTerms) {
    relations = mergeFindOptionsRelations<Account>(relations, ['account_terms_acceptance']);
  }
  const [account, sessionCheck] = await Promise.all([
    getAccountMatchingJwtIdentity({ id: claims.id, id_text: claims.id_text }, { relations }),
    checkAccountSession({ accountId: claims.id, sessionIdText: claims.sid }),
  ]);
  if (!account) {
    rejectUnauthorized(null);
    return;
  }
  if (sessionCheck.kind === 'ended') {
    if (endedSessionHandling === 'anonymous') {
      next();
      return;
    }
    rejectUnauthorized(sessionCheck.notice);
    return;
  }

  req.user = {
    id: account.id,
    id_text: typeof account.id_text === 'string' && account.id_text !== '' ? account.id_text : '',
    verified: typeof account.verified === 'boolean' ? account.verified : true,
    session_id_text: claims.sid,
  };

  if (sessionCheck.renewDue) {
    await renewSessionOnUse(res, requestToken, sessionCheck.session, claims);
  }

  if (enforceTerms && accountNeedsCurrentTerms(account, config.terms.version)) {
    res.status(403).json({
      message: 'Terms of service acceptance is required.',
      code: 'terms_acceptance_required',
    });
    return;
  }

  if (!options.skipMembershipStatus) {
    const membershipStatus = account.account_membership_status;

    if (!hasValidMembership(membershipStatus)) {
      console.warn(
        '[verifyTokenAndMembership] Membership expired or missing for user id:',
        req.user.id
      );
      res.status(403).json({
        message: 'Your membership has expired. Renew to use this feature.',
        code: 'membership_expired',
        i18nKey: MEMBERSHIP_EXPIRED_I18N_KEY,
        renewPath: APP_ROUTES.MEMBERSHIP_RENEW,
      });
      return;
    }

    const capDefaults = await getBillingPriceCatalogService().resolveProductMembershipCapDefaults();
    const entitlements = getAccountEntitlements(membershipStatus, capDefaults);
    req.user.entitlements = entitlements;

    if (
      options.requiredCapability &&
      !accountHasCapability(entitlements, options.requiredCapability)
    ) {
      res.status(403).json({
        message: 'Your account does not currently have access to this feature.',
        code: 'feature_not_available_for_account_type',
        i18nKey: 'membership.feature_not_available_for_account_type',
        renewPath: APP_ROUTES.MEMBERSHIP_RENEW,
      });
      return;
    }
  }

  next();
};

/** A failed account or session lookup answers 500 rather than leaving the request open. */
function runAuthCheck(check: Promise<void>, res: Response): void {
  check.catch((error: unknown) => {
    loggerService.logError('Authentication check failed', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
}

export const ensureAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
  options: AuthenticatedRequestOptions
): void => {
  const requestToken = readRequestToken(req);
  if (!requestToken) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  runAuthCheck(verifyTokenAndMembership(req, res, next, requestToken, options, 'reject'), res);
};

/**
 * A valid token whose session has ended continues as anonymous and keeps its cookie, so the next
 * signed-in route can answer with the reason and clear the cookie in the same response.
 */
export const optionalEnsureAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
  options: AuthenticatedRequestOptions
): void => {
  const requestToken = readRequestToken(req);
  if (!requestToken) {
    next();
    return;
  }
  runAuthCheck(verifyTokenAndMembership(req, res, next, requestToken, options, 'anonymous'), res);
};

/**
 * The account id of an active session on the request, or null. Reads only: no renewal and no
 * cookie writes, for handlers that vary a public response by viewer.
 */
export async function getActiveSessionAccountId(req: Request): Promise<number | null> {
  const requestToken = readRequestToken(req);
  if (!requestToken) {
    return null;
  }
  const classified = classifyAccessJwt(verifySessionJwt(requestToken.token));
  if (classified.kind !== 'session') {
    return null;
  }
  const sessionCheck = await checkAccountSession({
    accountId: classified.claims.id,
    sessionIdText: classified.claims.sid,
  });
  return sessionCheck.kind === 'active' ? classified.claims.id : null;
}

/**
 * Extracts the authenticated user from the request.
 * Call this only inside ensureAuthenticated callbacks where user is guaranteed.
 * @throws Error if user is not present (should never happen in auth context)
 */
export const getAuthenticatedUser = (req: Request): Express.User => {
  if (!req.user) {
    throw new Error('User not authenticated');
  }
  return req.user;
};

/** Ends the calling session when the request names one. Always clears the cookie and answers 200. */
export const logout = async (req: Request, res: Response): Promise<void> => {
  const requestToken = readRequestToken(req);
  if (requestToken) {
    const classified = classifyAccessJwt(verifySessionJwt(requestToken.token));
    if (classified.kind === 'session') {
      try {
        await endAccountSession({
          accountId: classified.claims.id,
          sessionIdText: classified.claims.sid,
          reason: 'signed_out',
        });
      } catch (error) {
        loggerService.logError('Failed to end the session on logout', error);
      }
    }
  }

  clearAuthCookie(res);
  res.json({ message: 'Logged out successfully' });
};

export const issueMobileToken = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as
    { email?: string; password?: string; device_label?: unknown } | undefined;
  const identifier = body?.email?.trim() ?? '';
  const password = body?.password ?? '';
  if (identifier === '' || password === '') {
    res.status(400).json({ message: 'email and password are required' });
    return;
  }

  const authResult = await authenticateAccountCredentials(identifier, password);
  if (authResult.kind === 'not_verified') {
    res.status(403).json({ message: ERROR_MESSAGES.ACCOUNT.NOT_VERIFIED });
    return;
  }
  if (authResult.kind !== 'authenticated') {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { sessionIdText, refreshTokenId } = await startAccountSession({
    accountId: authResult.id,
    clientType: 'mobile',
    deviceLabel: deviceLabelForMobile({
      bodyLabel: body?.device_label,
      platformHeader: req.get(BILLING_CLIENT_PLATFORM_HEADER),
    }),
    withRefreshToken: true,
  });
  if (refreshTokenId === null) {
    throw new Error('Mobile session started without a refresh token id');
  }

  res.json(
    signMobileTokenPair({
      accountId: authResult.id,
      accountIdText: authResult.id_text,
      sessionIdText,
      refreshTokenId,
    })
  );
};

export const refreshMobileToken = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { refresh_token?: string } | undefined;
  const refreshToken = body?.refresh_token ?? '';
  if (refreshToken === '') {
    res.status(400).json({ message: 'refresh_token is required' });
    return;
  }

  const classified = classifyRefreshJwt(verifySessionJwt(refreshToken));
  if (classified.kind === 'rejected') {
    res.status(401).json({ message: 'Invalid refresh token' });
    return;
  }
  const { claims } = classified;

  const account = await getAccountMatchingJwtIdentity({ id: claims.id, id_text: claims.id_text });
  if (!account || account.id_text === undefined || account.id_text === '') {
    res.status(401).json({ message: 'Invalid refresh token' });
    return;
  }

  const rotation = await rotateMobileRefreshToken({
    accountId: account.id,
    sessionIdText: claims.sid,
    presentedTokenId: claims.rid,
  });
  if (rotation.kind === 'ended') {
    res.status(401).json(unauthorizedBody('Invalid refresh token', rotation.notice));
    return;
  }

  res.json(
    signMobileTokenPair({
      accountId: account.id,
      accountIdText: account.id_text,
      sessionIdText: claims.sid,
      refreshTokenId: rotation.refreshTokenId,
    })
  );
};

/**
 * Ends the session named by a validly signed refresh token. Ending your own session needs no proof
 * beyond the signature, so the current-or-previous check does not apply. Always answers 200 so a
 * device's sign-out never fails on this call.
 */
export const revokeMobileToken = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { refresh_token?: unknown } | undefined;
  const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token : '';
  if (refreshToken !== '') {
    const classified = classifyRefreshJwt(verifySessionJwt(refreshToken));
    if (classified.kind === 'session') {
      try {
        await endAccountSession({
          accountId: classified.claims.id,
          sessionIdText: classified.claims.sid,
          reason: 'signed_out',
        });
      } catch (error) {
        loggerService.logError('Failed to end the session on mobile revoke', error);
      }
    }
  }

  res.json({ message: 'Mobile session revoked' });
};
