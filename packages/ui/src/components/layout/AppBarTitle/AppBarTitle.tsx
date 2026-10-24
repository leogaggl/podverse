'use client';

import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type AppBarTitleEntry = { id: number; title: string };

type AppBarTitleContextValue = {
  publish: (title: string) => () => void;
  title: string | null;
};

const AppBarTitleContext = createContext<AppBarTitleContextValue>({
  publish: () => () => {},
  title: null,
});

export type AppBarTitleProviderProps = {
  children: ReactNode;
};

/**
 * Holds the page title shown in the app bar. Pages publish through `MainHeader`; the app's
 * NavBar reads it with `useAppBarTitle`.
 */
export function AppBarTitleProvider({ children }: AppBarTitleProviderProps) {
  const [entry, setEntry] = useState<AppBarTitleEntry | null>(null);
  const nextIdRef = useRef(0);

  // A cleanup clears only its own entry, so an unmounting page cannot clear the title the next
  // page already published, whatever order React runs the effects in.
  const publish = useCallback((title: string) => {
    nextIdRef.current += 1;
    const id = nextIdRef.current;
    setEntry({ id, title });
    return () => {
      setEntry((current) => (current !== null && current.id === id ? null : current));
    };
  }, []);

  const value = useMemo(() => ({ publish, title: entry?.title ?? null }), [entry, publish]);

  return <AppBarTitleContext.Provider value={value}>{children}</AppBarTitleContext.Provider>;
}

/** The current app bar title, or null when no page has published one. */
export function useAppBarTitle(): string | null {
  return useContext(AppBarTitleContext).title;
}

/** Publishes `title` to the app bar while the calling component is mounted. */
export function usePublishAppBarTitle(title: string): void {
  const { publish } = useContext(AppBarTitleContext);

  useLayoutEffect(() => publish(title), [publish, title]);
}
