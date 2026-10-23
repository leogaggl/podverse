import { useSyncExternalStore } from 'react';

import {
  getAddByRssArtistIndexVersion,
  subscribeAddByRssArtistIndex,
} from '../lib/addByRss/addByRssArtistIndex';

/** Re-renders when Add by RSS artist relations change; use the value as a memo dependency. */
export const useAddByRssArtistIndexVersion = (): number =>
  useSyncExternalStore(subscribeAddByRssArtistIndex, getAddByRssArtistIndexVersion);
