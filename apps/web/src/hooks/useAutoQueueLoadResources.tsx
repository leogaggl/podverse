import { useCallback, useEffect, useRef } from 'react';

import type { AutoQueueConfig, AutoQueueResourcesMap } from '@podverse/playback-core';
import { fillAutoQueueForward } from '@podverse/playback-core';

import { useAutoQueue } from '../contexts/AutoQueue';
import { useMediaPlayer } from '../contexts/MediaPlayer';
import { getApiRequestService } from '../factories/apiRequestService';
import { createWebAutoQueueSourceFetchers } from '../lib/autoQueue/webAutoQueueSourceFetchers';

export function useAutoQueueLoadResources() {
  const { mpChannel, mpItem, mpClip, mpItemSoundbite } = useMediaPlayer();
  const { autoQueueResources, setAutoQueueResources, autoQueueConfig, setAutoQueueConfig } =
    useAutoQueue();

  const mpItemRef = useRef(mpItem);
  useEffect(() => {
    mpItemRef.current = mpItem;
  }, [mpItem]);

  const mpChannelRef = useRef(mpChannel);
  useEffect(() => {
    mpChannelRef.current = mpChannel;
  }, [mpChannel]);

  const mpClipRef = useRef(mpClip);
  useEffect(() => {
    mpClipRef.current = mpClip;
  }, [mpClip]);

  const mpItemSoundbiteRef = useRef(mpItemSoundbite);
  useEffect(() => {
    mpItemSoundbiteRef.current = mpItemSoundbite;
  }, [mpItemSoundbite]);

  const autoQueueResourcesRef = useRef(autoQueueResources);
  useEffect(() => {
    autoQueueResourcesRef.current = autoQueueResources;
  }, [autoQueueResources]);

  const autoQueueConfigRef = useRef(autoQueueConfig);
  useEffect(() => {
    autoQueueConfigRef.current = autoQueueConfig;
  }, [autoQueueConfig]);

  return useCallback(
    async (options?: { config?: AutoQueueConfig; resources?: AutoQueueResourcesMap }) => {
      const stored = options?.config ?? autoQueueConfigRef.current;
      const resources = options?.resources ?? autoQueueResourcesRef.current;

      if (mpItemRef.current === null || mpChannelRef.current === null) {
        setAutoQueueResources({});
        return;
      }

      const seed = {
        item: mpItemRef.current,
        channel: mpChannelRef.current,
        clip: mpClipRef.current,
        item_soundbite: mpItemSoundbiteRef.current,
      };
      // A stored disabled flag fills anyway. The walk treats disabled as no source.
      const configForWalk = { ...stored, disabled: false };
      const result = await fillAutoQueueForward({
        config: configForWalk,
        seed,
        resources,
        fetchers: createWebAutoQueueSourceFetchers(getApiRequestService()),
      });

      setAutoQueueResources(result.resources);

      const nextConfig = { ...result.config, disabled: stored.disabled };
      if (
        nextConfig.nextPage !== stored.nextPage ||
        nextConfig.shuffleHash !== stored.shuffleHash
      ) {
        setAutoQueueConfig(nextConfig);
      }
    },
    []
  );
}
