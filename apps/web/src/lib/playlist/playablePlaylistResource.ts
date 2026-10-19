import type { DTOPlaylistResource } from '@podverse/helpers';
import { isRemovedSource } from '@podverse/helpers';

/** A playlist row can be queued only when its episode is still in the directory. */
export function isPlayablePlaylistResource(resource: DTOPlaylistResource): boolean {
  if (isRemovedSource(resource)) {
    return false;
  }
  if (resource.clip) {
    return !isRemovedSource(resource.clip) && resource.clip.item != null;
  }
  if (resource.item_soundbite) {
    return resource.item_soundbite.item != null;
  }
  return resource.item != null;
}
