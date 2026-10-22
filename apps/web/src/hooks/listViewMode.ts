import type { ViewSelectedOption } from '../components/ViewSelector/ViewSelector';

export function isListViewMode(value: string | undefined): value is ViewSelectedOption {
  return value === 'grid' || value === 'rows';
}

/**
 * Scoped `viewMode` wins. Otherwise rows. The cookie's global `vs` is not consulted — Home and
 * directory channel lists each keep their own list/grid.
 */
export function resolveListViewMode(storedViewMode: string | undefined): ViewSelectedOption {
  if (isListViewMode(storedViewMode)) {
    return storedViewMode;
  }
  return 'rows';
}
