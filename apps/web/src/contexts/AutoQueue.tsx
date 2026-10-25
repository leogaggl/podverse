import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import { getShuffleHash } from '@podverse/helpers-requests';
import type { AutoQueueConfig, AutoQueueResourcesMap } from '@podverse/playback-core';
import { createDefaultAutoQueueConfig } from '@podverse/playback-core';

import type { LocalSettingsState } from '../utils/localSettings/localSettings';
import { useLocalSettings } from './LocalSettings';

export type {
  AutoQueueConfig,
  AutoQueueResourcesMap,
  AutoQueueResourcesMapRow,
} from '@podverse/playback-core';
export { autoQueueIncrementActiveRow, checkIsActiveRowHighestKey } from '@podverse/playback-core';

type AutoQueueContextType = {
  autoQueueResources: AutoQueueResourcesMap;
  setAutoQueueResources: (val: AutoQueueResourcesMap) => void;
  autoQueueConfig: AutoQueueConfig;
  setAutoQueueConfig: (val: AutoQueueConfig) => void;
  autoQueueActiveRow: number;
  setAutoQueueActiveRow: (val: number) => void;
};

const defaultAutoQueueConfig = createDefaultAutoQueueConfig(getShuffleHash);

export const AutoQueueContext = createContext<AutoQueueContextType>({
  autoQueueResources: {},
  setAutoQueueResources: () => {},
  autoQueueConfig: defaultAutoQueueConfig,
  setAutoQueueConfig: () => {},
  autoQueueActiveRow: 0,
  setAutoQueueActiveRow: () => {},
});

type AutoQueueProviderProps = {
  children: ReactNode;
  ssrLocalSettings: LocalSettingsState;
};

export const AutoQueueProvider = ({ children, ssrLocalSettings }: AutoQueueProviderProps) => {
  const { setLSAutoQueueConfig } = useLocalSettings();
  const initialAutoQueueConfig: AutoQueueConfig = {
    ...defaultAutoQueueConfig,
    ...(ssrLocalSettings?.aqc?.rd ? { random: true } : {}),
    ...(ssrLocalSettings?.aqc?.rp ? { repeat: true } : {}),
  };
  const [autoQueueResources, setAutoQueueResources] = useState<AutoQueueResourcesMap>({});
  const [autoQueueConfig, setAutoQueueConfig] = useState<AutoQueueConfig>(initialAutoQueueConfig);
  const [autoQueueActiveRow, setAutoQueueActiveRow] = useState<number>(0);

  useEffect(() => {
    setLSAutoQueueConfig((prev) => ({
      ...prev,
      rd: autoQueueConfig.random || false,
      rp: autoQueueConfig.repeat || false,
    }));
  }, [autoQueueConfig.random, autoQueueConfig.repeat, setLSAutoQueueConfig]);

  return (
    <AutoQueueContext.Provider
      value={{
        autoQueueResources,
        setAutoQueueResources,
        autoQueueConfig,
        setAutoQueueConfig,
        autoQueueActiveRow,
        setAutoQueueActiveRow,
      }}
    >
      {children}
    </AutoQueueContext.Provider>
  );
};

export function useAutoQueue() {
  const ctx = useContext(AutoQueueContext);
  if (!ctx) {
    throw new Error('useAutoQueue must be used within a AutoQueueProvider');
  }
  return ctx;
}
