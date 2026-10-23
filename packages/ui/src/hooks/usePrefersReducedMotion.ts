'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const getReducedMotionQuery = (): MediaQueryList | null => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY);
};

const subscribe = (onChange: () => void): (() => void) => {
  const query = getReducedMotionQuery();
  if (query === null) {
    return () => {};
  }
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
};

const getSnapshot = (): boolean => getReducedMotionQuery()?.matches ?? false;

/** The server cannot read the media query, so it renders as if motion is allowed. */
const getServerSnapshot = (): boolean => false;

/** Whether the user asked for reduced motion, following live changes to the media query. */
export const usePrefersReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
