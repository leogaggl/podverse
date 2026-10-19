import { useEffect, useMemo, useState } from 'react';

import type { ItemDescriptionSourceItem } from '../lib/content/itemDescriptionAccess';
import { itemDescriptionSubject, loadItemDescription } from '../lib/content/itemDescriptionAccess';
import type { ResolvedItemDescription } from '../lib/content/resolveItemDescription';
import { initialItemDescription } from '../lib/content/resolveItemDescription';

/**
 * An item's show notes for a Summary. Returns the payload's notes or preview on the first render,
 * then the full notes once the device cache or the server answers. Nothing here blocks paint, and
 * a failed read keeps the preview.
 */
export const useItemDescription = (
  item: ItemDescriptionSourceItem | null,
  options: { addByRss?: boolean } = {}
): ResolvedItemDescription | null => {
  const addByRss = options.addByRss === true;
  const subject = useMemo(
    () => (item === null ? null : itemDescriptionSubject(item, addByRss)),
    [addByRss, item]
  );
  const initial = useMemo(
    () => (subject === null ? null : initialItemDescription(subject)),
    [subject]
  );
  const [loaded, setLoaded] = useState<{
    itemIdText: string;
    resolved: ResolvedItemDescription;
  } | null>(null);

  useEffect(() => {
    if (subject === null || subject.itemIdText === null || initial?.source === 'payload') {
      return;
    }
    const itemIdText = subject.itemIdText;
    let cancelled = false;
    void loadItemDescription(subject).then((resolved) => {
      if (!cancelled) {
        setLoaded({ itemIdText, resolved });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initial, subject]);

  if (subject === null || initial === null) {
    return null;
  }
  if (initial.source !== 'payload' && loaded !== null && loaded.itemIdText === subject.itemIdText) {
    return loaded.resolved;
  }
  return initial;
};
