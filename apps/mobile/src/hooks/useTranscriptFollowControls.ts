import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TranscriptRow } from '@podverse/helpers';
import { filterTranscriptRowsByBody } from '@podverse/helpers/transcript';

/**
 * Visit-local transcript filter and Autoscroll toggle. Resets when `itemMediaId` changes.
 * Autoscroll defaults on. The filter term is not persisted.
 */
export function useTranscriptFollowControls(params: {
  itemMediaId: string | null;
  rows: readonly TranscriptRow[];
}): {
  autoScrollOn: boolean;
  filteredRows: TranscriptRow[];
  filterTerm: string;
  setFilterTerm: (term: string) => void;
  toggleAutoScroll: () => void;
} {
  const { itemMediaId, rows } = params;
  const [filterTerm, setFilterTerm] = useState('');
  const [autoScrollOn, setAutoScrollOn] = useState(true);

  useEffect(() => {
    setFilterTerm('');
    setAutoScrollOn(true);
  }, [itemMediaId]);

  const filteredRows = useMemo(
    () => filterTranscriptRowsByBody(rows, filterTerm),
    [filterTerm, rows]
  );

  const toggleAutoScroll = useCallback(() => {
    setAutoScrollOn((previous) => !previous);
  }, []);

  return {
    autoScrollOn,
    filteredRows,
    filterTerm,
    setFilterTerm,
    toggleAutoScroll,
  };
}
