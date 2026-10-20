'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

export type ImageRuntimeValue = {
  imageProxyEnabled: boolean;
  /** When false, shared `Image` uses Next.js `unoptimized` (no `/_next/image`). */
  nextImageOptimizationEnabled: boolean;
  proxyPathPrefix: string;
  placeholderSrc: string;
  /** Width/height used for fluid list-grid artwork slots (placeholder layout). */
  listGridSlotSize: number;
  /**
   * After a browser-direct image load fails, returns a final URL to try once.
   * Absent when the host app has no resolver.
   */
  resolveBlockedImageUrl?: (url: string) => Promise<string | null>;
};

const ImageRuntimeContext = createContext<ImageRuntimeValue | null>(null);

export type ImageRuntimeProviderProps = ImageRuntimeValue & {
  children: ReactNode;
};

/** An absolute http(s) URL with no userinfo that is not this page's origin or the placeholder. */
export function isResolvableRemoteImageUrl(url: string, placeholderSrc: string): boolean {
  if (url === placeholderSrc) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.username !== '' || parsed.password !== '') {
      return false;
    }
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function ImageRuntimeProvider({
  children,
  imageProxyEnabled,
  nextImageOptimizationEnabled,
  proxyPathPrefix,
  placeholderSrc,
  listGridSlotSize,
  resolveBlockedImageUrl,
}: ImageRuntimeProviderProps) {
  const value = useMemo(() => {
    const base = {
      imageProxyEnabled,
      nextImageOptimizationEnabled,
      proxyPathPrefix,
      placeholderSrc,
      listGridSlotSize,
    };
    if (resolveBlockedImageUrl === undefined) {
      return base;
    }
    return { ...base, resolveBlockedImageUrl };
  }, [
    imageProxyEnabled,
    listGridSlotSize,
    nextImageOptimizationEnabled,
    placeholderSrc,
    proxyPathPrefix,
    resolveBlockedImageUrl,
  ]);

  return <ImageRuntimeContext.Provider value={value}>{children}</ImageRuntimeContext.Provider>;
}

export function useImageRuntime(): ImageRuntimeValue {
  const ctx = useContext(ImageRuntimeContext);
  if (ctx === null) {
    throw new Error('useImageRuntime must be used within ImageRuntimeProvider');
  }
  return ctx;
}
