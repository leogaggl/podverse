import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getShuffleHash } from '@podverse/helpers-requests';
import type { PlaybackTarget } from '@podverse/playback-core';
import type { AutoQueueConfig, AutoQueueResourcesMap } from '@podverse/playback-core/autoQueue';
import {
  autoQueueSeedFromPlaybackTarget,
  hasAutoQueueRowAfter,
  toggleAutoQueueRepeat,
  toggleAutoQueueShuffle,
} from '@podverse/playback-core/autoQueue';
import type {
  AutoQueueFillResult,
  AutoQueuePreviousDecision,
} from '@podverse/playback-core/autoQueueWalk';
import {
  fillAutoQueueAhead,
  resolveAutoQueuePrevious,
} from '@podverse/playback-core/autoQueueWalk';

import { useAutoQueue } from '../contexts/AutoQueueProvider';
import type { MobileAuthRequestContext } from '../data';
import { autoQueueRepository } from '../data';
import { NATIVE_ADVANCE_WINDOW_AUTO_ROWS } from '../data/nativeCache/advanceWindow';
import type { AutoQueueDirective } from '../lib/autoQueue/autoQueue';
import { resolveAutoQueueConfigAfterDirective } from '../lib/autoQueue/autoQueue';
import { playbackTargetRowMediaId } from '../lib/playback/buildPlaybackTarget';
import { createAutoQueueFillGate } from './autoQueueFillGate';

/**
 * Rows kept loaded past the active row after each load: as many as the native advance window
 * carries, so Next and the native advance both have somewhere to go.
 */
export const AUTO_QUEUE_MIN_ROWS_AHEAD = NATIVE_ADVANCE_WINDOW_AUTO_ROWS;

export type AutoQueueRefillOutcome = {
  hasRowAhead: boolean;
  exhausted: boolean;
  failed: boolean;
};

export type AutoQueueStateWrite = {
  resources?: AutoQueueResourcesMap;
  config?: AutoQueueConfig;
  activeRow?: number;
};

/** Synchronous copies of the `AutoQueueProvider` state, current as soon as a write returns. */
export type AutoQueueRefs = {
  autoQueueActiveRowRef: RefObject<number>;
  autoQueueConfigRef: RefObject<AutoQueueConfig>;
  autoQueueResourcesRef: RefObject<AutoQueueResourcesMap>;
};

export type UseAutoQueueFillParams = {
  activeTargetRef: RefObject<PlaybackTarget | null>;
  /** Pass a stable function (one that reads a ref) so the returned callbacks stay stable. */
  buildContext: () => MobileAuthRequestContext;
};

export type UseAutoQueueFillResult = {
  autoQueueRefs: AutoQueueRefs;
  writeAutoQueueState: (write: AutoQueueStateWrite) => void;
  applyAutoQueueDirective: (directive: AutoQueueDirective) => void;
  refillAutoQueueAhead: () => Promise<AutoQueueRefillOutcome>;
  /**
   * Where Previous goes when it leaves the playing item: a loaded row before the active one, the
   * source's previous row, or a restart. Null when the item has no auto-queue seed, or when the
   * playing item or buffer changed while the walk was in flight.
   */
  resolvePreviousTrackStep: () => Promise<AutoQueuePreviousDecision | null>;
  /** Drop any fill in flight; its result will not be written. */
  invalidateAutoQueueFill: () => void;
  /** The source returned no more rows past the loaded buffer. */
  isAutoQueueExhausted: boolean;
  isAutoQueueExhaustedRef: RefObject<boolean>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
};

/**
 * Owns the auto-queue buffer for the playback provider. `writeAutoQueueState` is the only writer
 * of the resources, config, and active row, and keeps the refs and `AutoQueueProvider` state in
 * step. `refillAutoQueueAhead` fills through the shared `fillAutoQueueAhead` walk behind one
 * single-flight gate keyed by the playing target, so concurrent triggers share one fetch and a
 * fill for an item the listener has left is never written. Every returned callback is stable.
 */
export function useAutoQueueFill({
  activeTargetRef,
  buildContext,
}: UseAutoQueueFillParams): UseAutoQueueFillResult {
  const {
    autoQueueActiveRow,
    autoQueueConfig,
    autoQueueResources,
    setAutoQueueActiveRow,
    setAutoQueueConfig,
    setAutoQueueResources,
  } = useAutoQueue();

  const autoQueueActiveRowRef = useRef(autoQueueActiveRow);
  useEffect(() => {
    autoQueueActiveRowRef.current = autoQueueActiveRow;
  }, [autoQueueActiveRow]);
  const autoQueueConfigRef = useRef(autoQueueConfig);
  useEffect(() => {
    autoQueueConfigRef.current = autoQueueConfig;
  }, [autoQueueConfig]);
  const autoQueueResourcesRef = useRef(autoQueueResources);
  useEffect(() => {
    autoQueueResourcesRef.current = autoQueueResources;
  }, [autoQueueResources]);

  const [isAutoQueueExhausted, setIsAutoQueueExhaustedState] = useState(false);
  const isAutoQueueExhaustedRef = useRef(false);
  const setIsAutoQueueExhausted = useCallback((value: boolean): void => {
    isAutoQueueExhaustedRef.current = value;
    setIsAutoQueueExhaustedState(value);
  }, []);

  const [gate] = useState(() => createAutoQueueFillGate<AutoQueueFillResult>());

  const writeAutoQueueState = useCallback(
    (write: AutoQueueStateWrite): void => {
      if (write.resources !== undefined) {
        autoQueueResourcesRef.current = write.resources;
        setAutoQueueResources(write.resources);
      }
      if (write.config !== undefined) {
        autoQueueConfigRef.current = write.config;
        setAutoQueueConfig(write.config);
      }
      if (write.activeRow !== undefined) {
        autoQueueActiveRowRef.current = write.activeRow;
        setAutoQueueActiveRow(write.activeRow);
      }
    },
    [setAutoQueueActiveRow, setAutoQueueConfig, setAutoQueueResources]
  );

  /** Empty the buffer for a different play; the next fill seeds row 0 with the playing item. */
  const resetAutoQueueBuffer = useCallback(
    (config: AutoQueueConfig): void => {
      gate.bump();
      setIsAutoQueueExhausted(false);
      writeAutoQueueState({ activeRow: 0, config, resources: {} });
    },
    [gate, setIsAutoQueueExhausted, writeAutoQueueState]
  );

  const applyAutoQueueDirective = useCallback(
    (directive: AutoQueueDirective): void => {
      if (directive.mode === 'preserve') {
        return;
      }
      resetAutoQueueBuffer(
        resolveAutoQueueConfigAfterDirective(autoQueueConfigRef.current, directive, getShuffleHash)
      );
    },
    [resetAutoQueueBuffer]
  );

  const refillAutoQueueAhead = useCallback(async (): Promise<AutoQueueRefillOutcome> => {
    const target = activeTargetRef.current;
    const seed = autoQueueSeedFromPlaybackTarget(target);
    if (target === null || seed === null) {
      return { exhausted: true, failed: false, hasRowAhead: false };
    }
    const hasRowAheadNow = (): boolean =>
      hasAutoQueueRowAfter(autoQueueResourcesRef.current, autoQueueActiveRowRef.current);
    const matchesCurrentPrefs = (config: AutoQueueConfig): boolean =>
      config.random === autoQueueConfigRef.current.random &&
      config.repeat === autoQueueConfigRef.current.repeat;
    const runFill = () =>
      gate.run(playbackTargetRowMediaId(target) ?? seed.item.id_text, () =>
        fillAutoQueueAhead({
          activeRow: autoQueueActiveRowRef.current,
          config: autoQueueConfigRef.current,
          fetchers: autoQueueRepository.createSourceFetchers(buildContext()),
          minRowsAhead: AUTO_QUEUE_MIN_ROWS_AHEAD,
          resources: autoQueueResourcesRef.current,
          seed,
        })
      );
    try {
      let result = await runFill();
      // Stored Shuffle and Repeat prefs can hydrate mid-fill on launch. Writing that result back
      // would also overwrite the stored prefs, so refetch once under the current ones.
      if (!result.stale && !matchesCurrentPrefs(result.value.config)) {
        result = await runFill();
      }
      if (!result.stale && matchesCurrentPrefs(result.value.config)) {
        writeAutoQueueState({ config: result.value.config, resources: result.value.resources });
        setIsAutoQueueExhausted(result.value.exhausted && !hasRowAheadNow());
      }
      return {
        exhausted: isAutoQueueExhaustedRef.current,
        failed: false,
        hasRowAhead: hasRowAheadNow(),
      };
    } catch (error) {
      if (__DEV__) {
        console.warn('[playback] auto-queue fill failed', error);
      }
      return { exhausted: false, failed: true, hasRowAhead: hasRowAheadNow() };
    }
  }, [activeTargetRef, buildContext, gate, setIsAutoQueueExhausted, writeAutoQueueState]);

  const resolvePreviousTrackStep =
    useCallback(async (): Promise<AutoQueuePreviousDecision | null> => {
      const target = activeTargetRef.current;
      const seed = autoQueueSeedFromPlaybackTarget(target);
      if (target === null || seed === null) {
        return null;
      }
      const rowMediaId = playbackTargetRowMediaId(target);
      const startedGeneration = gate.generation();
      const isStillCurrent = (): boolean => {
        const current = activeTargetRef.current;
        return (
          current !== null &&
          playbackTargetRowMediaId(current) === rowMediaId &&
          gate.generation() === startedGeneration
        );
      };
      // Not a fill, so it does not join the gate; a walk for an item already left is dropped.
      let decision: AutoQueuePreviousDecision;
      try {
        decision = await resolveAutoQueuePrevious({
          activeRow: autoQueueActiveRowRef.current,
          config: autoQueueConfigRef.current,
          fetchers: autoQueueRepository.createSourceFetchers(buildContext()),
          seed,
        });
      } catch (error) {
        if (__DEV__) {
          console.warn('[playback] auto-queue previous walk failed', error);
        }
        decision = { kind: 'restart' };
      }
      return isStillCurrent() ? decision : null;
    }, [activeTargetRef, buildContext, gate]);

  const invalidateAutoQueueFill = useCallback((): void => {
    gate.bump();
  }, [gate]);

  const toggleShuffle = useCallback((): void => {
    resetAutoQueueBuffer(toggleAutoQueueShuffle(autoQueueConfigRef.current, getShuffleHash));
    void refillAutoQueueAhead();
  }, [refillAutoQueueAhead, resetAutoQueueBuffer]);

  const toggleRepeat = useCallback((): void => {
    resetAutoQueueBuffer(toggleAutoQueueRepeat(autoQueueConfigRef.current));
    void refillAutoQueueAhead();
  }, [refillAutoQueueAhead, resetAutoQueueBuffer]);

  const autoQueueRefs = useMemo<AutoQueueRefs>(
    () => ({ autoQueueActiveRowRef, autoQueueConfigRef, autoQueueResourcesRef }),
    []
  );

  return {
    applyAutoQueueDirective,
    autoQueueRefs,
    invalidateAutoQueueFill,
    isAutoQueueExhausted,
    isAutoQueueExhaustedRef,
    refillAutoQueueAhead,
    resolvePreviousTrackStep,
    toggleRepeat,
    toggleShuffle,
    writeAutoQueueState,
  };
}
