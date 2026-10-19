import { useCallback, useEffect, useId, useSyncExternalStore } from 'react';

import type { MarqueeTurnGroup } from '../lib/text/marqueeTurns';
import { marqueeTurns } from '../lib/text/marqueeTurns';

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
  group: MarqueeTurnGroup | undefined;
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

  const turn = useSyncExternalStore(marqueeTurns.subscribe, () =>
    group === undefined ? UNGROUPED_TURN : marqueeTurns.getTurn(group, id)
  );

  const finish = useCallback(() => {
    if (group === undefined) {
      return;
    }
    marqueeTurns.finishTurn(group, id);
  }, [group, id]);

  return { finish, turn };
};
