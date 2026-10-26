'use client';

import classNames from 'classnames';
import NextImage from 'next/image';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { resolveImageCandidates } from '@podverse/helpers';

import { isResolvableRemoteImageUrl, useImageRuntime } from '../ImageRuntime/ImageRuntime';

import styles from './Image.module.scss';

export type ImageFallbackControl = {
  chain: string[];
  attemptIndex: number;
  onAttemptFailed: () => void;
};

export interface ImageProps {
  src?: string | null;
  /** When set, tried in order on load failure (shrunken first, then native fallbacks). Overrides single `src`. */
  candidates?: string[];
  /**
   * Paired desktop/mobile artwork: shared chain + index so both viewports stay aligned.
   * When set, `src` / `candidates` are ignored.
   */
  fallbackControl?: ImageFallbackControl;
  alt: string;
  width: number;
  height?: number;
  className?: string;
  skipProxy?: boolean;
  /**
   * Without it, the image loads lazily and decodes asynchronously, so remote artwork never holds
   * up input or the frame that paints it. Set it only for above-the-fold branding.
   */
  priority?: boolean;
  /**
   * Brief skeleton tint behind the image box until load (see SkeletonFlashImage).
   * Off by default so transparent branding assets show true transparency.
   */
  enableSkeletonFlash?: boolean;
  onLoad?: () => void;
}

export const Image: React.FC<ImageProps> = ({
  src,
  candidates,
  fallbackControl,
  alt,
  width,
  height,
  className,
  skipProxy,
  priority,
  enableSkeletonFlash = false,
  onLoad,
}) => {
  const {
    imageProxyEnabled,
    listGridSlotSize,
    nextImageOptimizationEnabled,
    placeholderSrc,
    proxyPathPrefix,
    resolveBlockedImageUrl,
  } = useImageRuntime();

  const nextImageUnoptimized = !nextImageOptimizationEnabled;

  const resolvedChain =
    fallbackControl !== undefined ? fallbackControl.chain : resolveImageCandidates(candidates, src);

  const chainId = useMemo(() => JSON.stringify(resolvedChain), [resolvedChain]);

  const [internalAttemptIndex, setInternalAttemptIndex] = useState(0);
  const [directResolvedSrc, setDirectResolvedSrc] = useState<string | null>(null);
  const askedDirectRef = useRef(new Set<string>());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    askedDirectRef.current.clear();
    setDirectResolvedSrc(null);
    setInternalAttemptIndex(0);
  }, [chainId, skipProxy]);

  const attemptIndex =
    fallbackControl !== undefined ? fallbackControl.attemptIndex : internalAttemptIndex;
  const attemptRef = useRef(attemptIndex);
  attemptRef.current = attemptIndex;

  useEffect(() => {
    setDirectResolvedSrc(null);
  }, [attemptIndex]);

  useEffect(() => {
    setLoaded(false);
  }, [chainId, attemptIndex]);

  const rawSrc = resolvedChain[attemptIndex];
  const useProxy = imageProxyEnabled && !skipProxy;
  const loadedDirectly = !useProxy && nextImageUnoptimized;

  const advanceAttempt = () => {
    if (fallbackControl !== undefined) {
      fallbackControl.onAttemptFailed();
    } else {
      setInternalAttemptIndex((i) => i + 1);
    }
  };

  const onLoadFailure = () => {
    if (
      loadedDirectly &&
      rawSrc !== undefined &&
      resolveBlockedImageUrl !== undefined &&
      isResolvableRemoteImageUrl(rawSrc, placeholderSrc) &&
      !askedDirectRef.current.has(rawSrc)
    ) {
      askedDirectRef.current.add(rawSrc);
      const failedSrc = rawSrc;
      const failedAttempt = attemptRef.current;
      void resolveBlockedImageUrl(failedSrc).then((next) => {
        if (attemptRef.current !== failedAttempt) {
          return;
        }
        if (next !== null && next !== failedSrc) {
          setDirectResolvedSrc(next);
          return;
        }
        advanceAttempt();
      });
      return;
    }
    advanceAttempt();
  };

  const handleLoad = () => {
    if (enableSkeletonFlash) {
      setLoaded(true);
    }
    onLoad?.();
  };

  const omitFixedHeight = height === undefined;
  const renderedHeight = height ?? 1;
  const fixedWidthAutoHeightStyle = omitFixedHeight
    ? ({ width: `${width}px`, height: 'auto' } as React.CSSProperties)
    : undefined;
  const isFluidGridSlot =
    height !== undefined && width === listGridSlotSize && height === listGridSlotSize;
  const placeholderWidth = Math.round((width * 2) / 2.5);
  const placeholderHeight = Math.round((renderedHeight * 2) / 2.5);
  const showPlaceholder =
    resolvedChain.length === 0 || attemptIndex >= resolvedChain.length || rawSrc === undefined;

  if (showPlaceholder) {
    return (
      <div
        className={classNames(
          styles.placeholderOuter,
          isFluidGridSlot && styles.placeholderOuterFluid,
          className
        )}
        style={
          isFluidGridSlot
            ? undefined
            : omitFixedHeight
              ? { width }
              : { width, height: renderedHeight }
        }
      >
        <div className={styles.placeholderInner}>
          <NextImage
            src={placeholderSrc}
            alt={alt}
            width={placeholderWidth}
            height={placeholderHeight}
            className={classNames(
              styles.imagePlaceholder,
              isFluidGridSlot && styles.imagePlaceholderFluid
            )}
            priority={priority}
            unoptimized={nextImageUnoptimized}
          />
        </div>
      </div>
    );
  }

  const finalSrc =
    directResolvedSrc ?? (useProxy ? proxyPathPrefix + encodeURIComponent(rawSrc) : rawSrc);

  const skeletonClass = enableSkeletonFlash && !loaded ? styles.skeletonBg : undefined;

  return (
    <NextImage
      key={`${chainId}-${attemptIndex}-${directResolvedSrc ?? ''}`}
      src={finalSrc}
      alt={alt}
      width={width}
      height={renderedHeight}
      style={fixedWidthAutoHeightStyle}
      className={classNames(skeletonClass, className)}
      onError={onLoadFailure}
      onLoad={handleLoad}
      priority={priority}
      loading={priority === true ? undefined : 'lazy'}
      decoding="async"
      unoptimized={nextImageUnoptimized}
    />
  );
};
