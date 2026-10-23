'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { AuthSessionEndedNotice } from '@podverse/helpers/authSessionNotice';

import type { CurrentUser } from '../lib/requests/auth';
import { getManagementAuthResult } from '../lib/requests/auth';
import { ROUTES } from '../lib/routes';

function redirectPathWithNotice(redirectPath: string, notice: AuthSessionEndedNotice): string {
  const separator = redirectPath.includes('?') ? '&' : '?';
  return `${redirectPath}${separator}notice=${notice}`;
}

export type UseManagementClientSessionGuardOptions = {
  /** When false, skip session verification (user stays `initialUser`). */
  enabled?: boolean;
  /** Called before redirect when the session is missing or verification throws. */
  onInvalid?: () => void;
  /** Called after a successful `/auth/me` response with a non-null user. */
  onValid?: (user: CurrentUser) => void;
  /** Next.js router `replace` target when unauthenticated; default login route. */
  redirectPath?: string;
};

/**
 * Client-side session re-check for management pages that already received a server-validated user.
 * Calls `/auth/me`, refreshes the user when the session is valid, and replaces to `redirectPath`
 * when it is not. A signed-out notice is appended to that path so the login page can show it.
 */
export function useManagementClientSessionGuard(
  initialUser: CurrentUser,
  options?: UseManagementClientSessionGuardOptions
): CurrentUser {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>(initialUser);

  const enabled = options?.enabled ?? true;
  const redirectPath = options?.redirectPath ?? ROUTES.HOME;

  const onValidRef = useRef(options?.onValid);
  const onInvalidRef = useRef(options?.onInvalid);
  onValidRef.current = options?.onValid;
  onInvalidRef.current = options?.onInvalid;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        const result = await getManagementAuthResult();
        if (cancelled) {
          return;
        }
        if (result.user === null) {
          onInvalidRef.current?.();
          const nextPath =
            result.notice === null
              ? redirectPath
              : redirectPathWithNotice(redirectPath, result.notice);
          router.replace(nextPath);
          return;
        }
        setUser(result.user);
        onValidRef.current?.(result.user);
      } catch {
        if (!cancelled) {
          onInvalidRef.current?.();
          router.replace(redirectPath);
        }
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [enabled, redirectPath, router]);

  return user;
}
