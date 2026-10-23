import { createMarqueeTurnRegistry } from '@podverse/helpers/marquee';

export type MarqueeTurnGroup = 'full-player' | 'mini-player';

/** Process-wide registry for player chrome. */
export const marqueeTurns = createMarqueeTurnRegistry<MarqueeTurnGroup>();
