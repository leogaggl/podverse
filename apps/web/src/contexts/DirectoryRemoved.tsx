'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

const DirectoryRemovedContext = createContext(false);

type DirectoryRemovedProviderProps = {
  removed: boolean;
  children: ReactNode;
};

export function DirectoryRemovedProvider({ removed, children }: DirectoryRemovedProviderProps) {
  return (
    <DirectoryRemovedContext.Provider value={removed}>{children}</DirectoryRemovedContext.Provider>
  );
}

export function useDirectoryRemoved(): boolean {
  return useContext(DirectoryRemovedContext);
}
