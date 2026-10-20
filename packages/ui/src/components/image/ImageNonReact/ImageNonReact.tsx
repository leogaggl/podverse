'use client';

import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { LoadingSpinner } from '../../layout/LoadingSpinner/index';
import { isResolvableRemoteImageUrl, useImageRuntime } from '../ImageRuntime/ImageRuntime';

import styles from './ImageNonReact.module.scss';

type LoadPhase = 'loading' | 'loaded' | 'exhausted';

const candidatesId = (c: string[]) => JSON.stringify(c);

interface ImageNonReactProps {
  /** Tried in order: first that loads is shown; on error, the next is used until the list is exhausted. */
  candidates: string[];
  alt: string;
  className?: string;
  skipProxy?: boolean;
}

export const ImageNonReact: React.FC<ImageNonReactProps> = ({
  candidates,
  alt,
  className,
  skipProxy,
}) => {
  const { imageProxyEnabled, placeholderSrc, proxyPathPrefix, resolveBlockedImageUrl } =
    useImageRuntime();
  const previousIdRef = useRef<string | null>(null);
  const askedDirectRef = useRef(new Set<string>());

  const [index, setIndex] = useState(0);
  const [directResolvedSrc, setDirectResolvedSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<LoadPhase>(() =>
    candidates.length > 0 ? 'loading' : 'exhausted'
  );
  const id = candidatesId(candidates);
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    askedDirectRef.current.clear();
    setDirectResolvedSrc(null);
  }, [id]);

  useEffect(() => {
    setDirectResolvedSrc(null);
  }, [index]);

  useEffect(() => {
    if (id === '[]') {
      setIndex(0);
      setPhase('exhausted');
      previousIdRef.current = id;
      return;
    }

    const previousId = previousIdRef.current;
    previousIdRef.current = id;
    setIndex(0);
    if (previousId !== null && previousId !== id) {
      setPhase('loading');
    }
    // `id` is JSON.stringify(candidates) — do not list `candidates` in deps, or a new array ref
    // each parent render would reset the load every frame.
  }, [id]);

  const onLoadSuccess = () => {
    setPhase('loaded');
  };

  const syncLoadedFromImageElement = useCallback((img: HTMLImageElement | null) => {
    if (img === null) {
      return;
    }

    const alreadyLoaded = img.complete && img.naturalWidth > 0;

    if (alreadyLoaded) {
      setPhase('loaded');
    }
  }, []);

  const currentUrl = candidates[index];
  const useProxy = imageProxyEnabled && !skipProxy;

  const advanceAttempt = () => {
    if (index < candidates.length - 1) {
      setIndex((i) => i + 1);
      setPhase('loading');
    } else {
      setPhase('exhausted');
    }
  };

  const onImageError = () => {
    if (
      !useProxy &&
      currentUrl !== undefined &&
      currentUrl !== '' &&
      resolveBlockedImageUrl !== undefined &&
      isResolvableRemoteImageUrl(currentUrl, placeholderSrc) &&
      !askedDirectRef.current.has(currentUrl)
    ) {
      askedDirectRef.current.add(currentUrl);
      const failedSrc = currentUrl;
      const failedIndex = indexRef.current;
      void resolveBlockedImageUrl(failedSrc).then((next) => {
        if (indexRef.current !== failedIndex) {
          return;
        }
        if (next !== null && next !== failedSrc) {
          setDirectResolvedSrc(next);
          setPhase('loading');
          return;
        }
        advanceAttempt();
      });
      return;
    }
    advanceAttempt();
  };

  if (candidates.length === 0) {
    return (
      <div className={classNames(styles.wrapper, className)}>
        <img src={placeholderSrc} alt={alt} className={styles.placeholder} />
      </div>
    );
  }

  const atEnd = phase === 'exhausted';
  const showHeadphone = atEnd;
  const showAttempt =
    !showHeadphone && currentUrl
      ? (directResolvedSrc ??
        (useProxy ? proxyPathPrefix + encodeURIComponent(currentUrl) : currentUrl))
      : null;
  const showSpinner = !showHeadphone && phase === 'loading' && Boolean(showAttempt);

  return (
    <div
      className={classNames(styles.wrapper, className)}
      aria-busy={phase === 'loading' || undefined}
    >
      {showHeadphone && <img src={placeholderSrc} alt={alt} className={styles.placeholder} />}

      {showAttempt && (
        <img
          key={`${id}-${index}-${showAttempt}`}
          ref={syncLoadedFromImageElement}
          src={showAttempt}
          alt={alt}
          onLoad={onLoadSuccess}
          onError={onImageError}
          className={classNames(styles.art, phase === 'loading' && styles.artHidden)}
        />
      )}

      {showSpinner && (
        <div className={styles.loadingOverlay} aria-hidden>
          <LoadingSpinner decorative size="medium" />
        </div>
      )}
    </div>
  );
};
