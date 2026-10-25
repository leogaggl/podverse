import type { AutoQueueConfig } from '@podverse/playback-core/autoQueue';
import { resolveAutoQueueConfigForExplicitPlay } from '@podverse/playback-core/autoQueue';

/**
 * Mobile auto-queue directives: what a load does to the auto-queue buffer, and the config that
 * follows. The buffer types, source choice, and fill walk live in `@podverse/playback-core`.
 * Kept framework-free so it is unit-testable.
 */

/**
 * Caller-declared auto-queue side effect for a load. `preserve` keeps the buffer (auto-queue and
 * manual-queue advances); `clear` resets it for an explicit play; `seed-playlist` resets it and
 * points the source at a playlist; `clear-buffer` empties the rows but keeps the config, so a
 * Previous that loads the item before row 0 stays on the same playlist or channel source.
 */
export type AutoQueueDirective =
  | { mode: 'clear' }
  | { mode: 'clear-buffer' }
  | { mode: 'preserve' }
  | { mode: 'seed-playlist'; playlistIdText: string };

/**
 * Next config after a directive that empties the buffer. `clear-buffer` keeps the current config.
 * An explicit play (`clear`) or playlist row play (`seed-playlist`) mints a new shuffle hash so the
 * next shuffle sequence does not repeat, restarts paging, and re-enables the auto-queue. `random`
 * and `repeat` stay as the user left them. Callers must not use this for `preserve`.
 */
export function resolveAutoQueueConfigAfterDirective(
  current: AutoQueueConfig,
  directive: Exclude<AutoQueueDirective, { mode: 'preserve' }>,
  nextShuffleHash: () => string
): AutoQueueConfig {
  if (directive.mode === 'clear-buffer') {
    return current;
  }
  const playlistIdText = directive.mode === 'seed-playlist' ? directive.playlistIdText : null;
  return resolveAutoQueueConfigForExplicitPlay(current, playlistIdText, nextShuffleHash);
}
