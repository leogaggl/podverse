import type { BackgroundActivityKind, BackgroundActivitySnapshot } from './backgroundActivityStore';

/** Key under the `background_activity` catalog namespace for each kind's message. */
export const BACKGROUND_ACTIVITY_LABEL_KEYS: Record<BackgroundActivityKind, 'add_by_rss_refresh'> =
  {
    add_by_rss_refresh: 'add_by_rss_refresh',
  };

export type BackgroundActivityVisibilityContext = {
  /** How many Add by RSS feeds the signed-in account follows; 0 when signed out. */
  addByRSSFollowCount: number;
};

function isKindVisible(
  kind: BackgroundActivityKind,
  context: BackgroundActivityVisibilityContext
): boolean {
  switch (kind) {
    case 'add_by_rss_refresh':
      return context.addByRSSFollowCount > 0;
  }
}

/** The entries the overlay may show for this account. */
export function selectVisibleBackgroundActivity(
  entries: BackgroundActivitySnapshot,
  context: BackgroundActivityVisibilityContext
): BackgroundActivitySnapshot {
  const visible = entries.filter((entry) => isKindVisible(entry.kind, context));
  if (visible.length === entries.length) {
    return entries;
  }
  return visible;
}
