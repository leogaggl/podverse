'use client';

import { useSyncExternalStore } from 'react';

import type {
  BackgroundActivitySnapshot,
} from '../utils/backgroundActivity/backgroundActivityStore';
import {
  getBackgroundActivitySnapshot,
  getServerBackgroundActivitySnapshot,
  subscribeBackgroundActivity,
} from '../utils/backgroundActivity/backgroundActivityStore';

/** Running background work in this page, for the background activity overlay. */
export function useBackgroundActivity(): BackgroundActivitySnapshot {
  return useSyncExternalStore(
    subscribeBackgroundActivity,
    getBackgroundActivitySnapshot,
    getServerBackgroundActivitySnapshot
  );
}
