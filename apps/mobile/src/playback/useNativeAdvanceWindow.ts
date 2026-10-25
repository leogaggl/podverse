import { useEffect, useRef } from 'react';

import type { PlaybackTarget } from '@podverse/playback-core';
import type { AutoQueueConfig, AutoQueueResourcesMap } from '@podverse/playback-core/autoQueue';

import { useAutoQueue } from '../contexts/AutoQueueProvider';
import { composeAdvanceWindow } from '../data/nativeCache/advanceWindow';
import { projectAdvanceWindowToNativeCache } from '../data/nativeCache/projection';
import { nativeAdvanceSourceRepository } from '../data/repositories/nativeAdvanceSourceRepository';
import { useQueueDataRevision } from '../hooks/useQueueDataRevision';
import { buildNativeAdvanceSource } from '../lib/playback/nativeAdvanceSource';
import type { AddByRssFeedWalkState } from './useAddByRssFeedWalk';

type AdvanceWindowInputs = {
  target: PlaybackTarget | null;
  addByRssFeedWalk: AddByRssFeedWalkState | null;
  resources: AutoQueueResourcesMap;
  activeRow: number;
  config: AutoQueueConfig;
};

/**
 * Keeps the native advance window in step with the play order: the playing target, the manual
 * queue, the auto-queue rows and active row, and the Add by RSS feed walk. Each write also saves
 * the source the window came from, so JS can continue it after adopting an item the engine
 * reached on its own. Writes are single-flight and latest-wins. Nothing is written until a target
 * has been set once in this JS run, so launch never empties a window the engine may still be
 * walking or the source saved beside it; after that a cleared player writes the empty window and
 * deletes the saved source.
 */
export function useNativeAdvanceWindow({
  activeTarget,
  addByRssFeedWalk,
}: {
  activeTarget: PlaybackTarget | null;
  addByRssFeedWalk: AddByRssFeedWalkState | null;
}): void {
  const { autoQueueActiveRow, autoQueueConfig, autoQueueResources } = useAutoQueue();
  const revision = useQueueDataRevision();
  const inputsRef = useRef<AdvanceWindowInputs | null>(null);
  const hasSeenTargetRef = useRef(false);
  const writingRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    inputsRef.current = {
      activeRow: autoQueueActiveRow,
      addByRssFeedWalk,
      config: autoQueueConfig,
      resources: autoQueueResources,
      target: activeTarget,
    };
    if (activeTarget !== null) {
      hasSeenTargetRef.current = true;
    }
    if (!hasSeenTargetRef.current) {
      return;
    }
    if (writingRef.current) {
      pendingRef.current = true;
      return;
    }

    const writeLatest = async (): Promise<void> => {
      writingRef.current = true;
      try {
        do {
          pendingRef.current = false;
          const inputs = inputsRef.current;
          if (inputs === null) {
            break;
          }
          try {
            const composition = await composeAdvanceWindow({
              addByRssFeedWalk: inputs.addByRssFeedWalk,
              autoQueue: {
                activeRow: inputs.activeRow,
                disabled: inputs.config.disabled,
                resources: inputs.resources,
              },
              target: inputs.target,
            });
            await projectAdvanceWindowToNativeCache(composition.projection);
            await nativeAdvanceSourceRepository.write(
              buildNativeAdvanceSource({
                activeRow: inputs.activeRow,
                addByRssFeedUrls: composition.addByRssFeedUrls,
                config: inputs.config,
                nowMs: Date.now(),
                resources: inputs.resources,
                target: inputs.target,
              })
            );
          } catch (error) {
            if (__DEV__) {
              console.warn('[native-cache] advance-window soft-fail', error);
            }
          }
        } while (pendingRef.current);
      } finally {
        writingRef.current = false;
      }
    };
    void writeLatest();
  }, [
    activeTarget,
    addByRssFeedWalk,
    autoQueueActiveRow,
    autoQueueConfig,
    autoQueueResources,
    revision,
  ]);
}
