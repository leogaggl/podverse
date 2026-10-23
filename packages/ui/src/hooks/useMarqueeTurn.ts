'use client';

import { useCallback, useEffect, useId, useSyncExternalStore } from 'react';

import { createMarqueeTurnRegistry } from '@podverse/helpers/marquee';

/** One registry per page, so labels in the same group hand off wherever they are mounted. */
const marqueeTurns = createMarqueeTurnRegistry();

/** Token the ungrouped path uses: it always holds its own turn. */
const UNGROUPED_TURN = 0;

/**
 * Joins `group` while mounted and reports whether this label may scroll now. Returns a turn
 * token while it holds the turn and null while it waits. Without a group it always returns
 * `UNGROUPED_TURN`. `finish` ends the current pass.
 */
export const useMarqueeTurn = ({
  group,
  order,
  scrolls,
}: {
  group: string | undefined;
  order: number;
  scrolls: boolean;
}): { finish: () => void; turn: number | null } => {
  const id = useId();

  useEffect(() => {
    if (group === undefined) {
      return;
    }
    marqueeTurns.join(group, id, order);
    return () => {
      marqueeTurns.leave(group, id);
    };
  }, [group, id, order]);

  useEffect(() => {
    if (group === undefined) {
      return;
    }
    marqueeTurns.setScrolls(group, id, scrolls);
  }, [group, id, scrolls]);

  const turn = useSyncExternalStore(
    marqueeTurns.subscribe,
    () => (group === undefined ? UNGROUPED_TURN : marqueeTurns.getTurn(group, id)),
    // Nothing scrolls during the server render; a grouped label waits for the client registry.
    () => (group === undefined ? UNGROUPED_TURN : null)
  );

  const finish = useCallback(() => {
    if (group === undefined) {
      return;
    }
    marqueeTurns.finishTurn(group, id);
  }, [group, id]);

  return { finish, turn };
};
