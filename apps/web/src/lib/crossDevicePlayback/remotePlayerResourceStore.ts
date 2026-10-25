import type { DTOItemChapter, DTOPlaybackResourceRef } from '@podverse/helpers';
import type { AddByRSSResourceDataPayload } from '@podverse/parser-mapping';
import { buildAddByRSSResourceData, getAddByRSSHashId } from '@podverse/parser-mapping';

import { getApiRequestService } from '../../factories/apiRequestService';
import { resolveAddByRSSIndexItemFromResourceData } from '../../utils/addByRSS/playFromQueueResource';
import { findAddByRSSResourceDataForHash } from './addByRSSResourceDataForHash';
import type { PlaybackResourceDtos } from './fetchPlaybackResourceDtos';
import { fetchPlaybackResourceDtos } from './fetchPlaybackResourceDtos';

export type RemotePlayerResource =
  | ({ kind: 'database'; itemChapters: DTOItemChapter[] | null } & PlaybackResourceDtos)
  | {
      kind: 'add_by_rss';
      /** The index item's id text, for the Add by RSS item page. */
      idText: string;
      /**
       * `buildAddByRSSResourceData(indexItem)`: the shape rows pass to the playlist modal and
       * `usePlayAddByRSS` stores as `mpAddByRSS.resourceData`.
       */
      resourceData: AddByRSSResourceDataPayload;
      /** `getAddByRSSHashId(indexItem)`. */
      hashId: string | null;
    };

export type RemotePlayerResourceState =
  | { status: 'none'; key: null }
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; resource: RemotePlayerResource }
  | { status: 'missing'; key: string };

export type RemotePlayerResourceRequest = {
  ref: DTOPlaybackResourceRef | null;
  isLive: boolean;
  queueIdTexts: readonly string[];
};

type RemotePlayerResourceLoadRequest = RemotePlayerResourceRequest & {
  ref: DTOPlaybackResourceRef;
};

export function playbackResourceRefKey(ref: DTOPlaybackResourceRef): string {
  switch (ref.kind) {
    case 'item':
      return `item:${ref.item_id_text}`;
    case 'clip':
      return `clip:${ref.clip_id_text}`;
    case 'soundbite':
      return `soundbite:${ref.item_soundbite_id_text}`;
    case 'add_by_rss':
      return `add_by_rss:${ref.add_by_rss_hash_id}`;
    default: {
      const _unhandled: never = ref;
      return _unhandled;
    }
  }
}

async function fetchRemoteItemChapters(itemIdText: string): Promise<DTOItemChapter[] | null> {
  try {
    const chapters = (await getApiRequestService().reqItemParseAndGetChapters(itemIdText)).data;
    return chapters.length === 0 ? null : chapters;
  } catch {
    return null;
  }
}

async function loadDatabaseResource(
  ref: Extract<DTOPlaybackResourceRef, { kind: 'item' | 'clip' | 'soundbite' }>,
  isLive: boolean
): Promise<RemotePlayerResource | null> {
  const dtos = await fetchPlaybackResourceDtos(ref);
  if (dtos === null) {
    return null;
  }
  const itemChapters =
    ref.kind === 'item' && !isLive ? await fetchRemoteItemChapters(dtos.item.id_text) : null;
  return { kind: 'database', ...dtos, itemChapters };
}

export async function loadRemotePlayerResource(
  request: RemotePlayerResourceLoadRequest
): Promise<RemotePlayerResource | null> {
  const { ref, isLive, queueIdTexts } = request;
  switch (ref.kind) {
    case 'item':
    case 'clip':
    case 'soundbite':
      return loadDatabaseResource(ref, isLive);
    case 'add_by_rss': {
      const data = await findAddByRSSResourceDataForHash({
        queueIdTexts,
        hash: ref.add_by_rss_hash_id,
      });
      if (data === null) {
        return null;
      }
      const resolved = await resolveAddByRSSIndexItemFromResourceData(data);
      if (resolved === null) {
        return null;
      }
      const idText = resolved.indexItem.idText;
      if (typeof idText !== 'string' || idText === '') {
        return null;
      }
      return {
        kind: 'add_by_rss',
        idText,
        resourceData: buildAddByRSSResourceData(resolved.indexItem),
        hashId: getAddByRSSHashId(resolved.indexItem),
      };
    }
    default: {
      const _unhandled: never = ref;
      void _unhandled;
      return null;
    }
  }
}

/**
 * Records for the item another device is playing. One load per ref for the whole tab; a slower
 * load for an older ref cannot replace a newer one.
 */
export function createRemotePlayerResourceStore(deps: {
  load: (request: RemotePlayerResourceLoadRequest) => Promise<RemotePlayerResource | null>;
}): {
  getState(): RemotePlayerResourceState;
  subscribe(listener: () => void): () => void;
  /** Starts a load when the ref's key differs from the current one; same key does nothing. */
  ensure(request: RemotePlayerResourceRequest): void;
  /** Resolves with the state once it is not `loading` (at once when it already is not). */
  whenSettled(): Promise<RemotePlayerResourceState>;
} {
  let generation = 0;
  let state: RemotePlayerResourceState = { status: 'none', key: null };
  const listeners = new Set<() => void>();

  function setState(next: RemotePlayerResourceState): void {
    state = next;
    for (const listener of [...listeners]) {
      listener();
    }
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function ensure(request: RemotePlayerResourceRequest): void {
    const ref = request.ref;
    if (ref === null) {
      generation += 1;
      if (state.status !== 'none') {
        setState({ status: 'none', key: null });
      }
      return;
    }

    const key = playbackResourceRefKey(ref);
    if (key === state.key) {
      return;
    }

    generation += 1;
    const requestGeneration = generation;
    setState({ status: 'loading', key });
    if (requestGeneration !== generation) {
      return;
    }

    void deps
      .load({
        ref,
        isLive: request.isLive,
        queueIdTexts: request.queueIdTexts,
      })
      .then(
        (value) => {
          if (requestGeneration !== generation) {
            return;
          }
          if (value === null) {
            setState({ status: 'missing', key });
            return;
          }
          setState({ status: 'ready', key, resource: value });
        },
        () => {
          if (requestGeneration !== generation) {
            return;
          }
          setState({ status: 'missing', key });
        }
      );
  }

  function whenSettled(): Promise<RemotePlayerResourceState> {
    if (state.status !== 'loading') {
      return Promise.resolve(state);
    }
    return new Promise((resolve) => {
      const unsubscribe = subscribe(() => {
        if (state.status === 'loading') {
          return;
        }
        unsubscribe();
        resolve(state);
      });
    });
  }

  return {
    getState() {
      return state;
    },
    subscribe,
    ensure,
    whenSettled,
  };
}

export const remotePlayerResourceStore = createRemotePlayerResourceStore({
  load: loadRemotePlayerResource,
});
