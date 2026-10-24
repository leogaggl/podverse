import type { DTOVerifiedPublisher } from '../dtos/channel/verifiedPublisher.js';

type VerifiedPublisherHolder = {
  verified_publishers?: DTOVerifiedPublisher[];
};

function titledPublisher(publisher: DTOVerifiedPublisher): boolean {
  const title = publisher.title?.trim() ?? '';
  return title !== '';
}

/**
 * Publishers to show for a channel, or for an item on that channel: channel-wide first, then
 * item-only credits, each once, primary first. Untitled publishers are left out.
 */
export const resolveVerifiedPublishers = (args: {
  channel?: VerifiedPublisherHolder | null;
  item?: VerifiedPublisherHolder | null;
}): DTOVerifiedPublisher[] => {
  const seen = new Set<string>();
  const resolved: DTOVerifiedPublisher[] = [];
  const lists = [args.channel?.verified_publishers ?? [], args.item?.verified_publishers ?? []];
  for (const list of lists) {
    for (const publisher of list) {
      if (seen.has(publisher.id_text) || !titledPublisher(publisher)) {
        continue;
      }
      seen.add(publisher.id_text);
      resolved.push(publisher);
    }
  }
  return resolved;
};

/** "A, B" for a publisher list. Empty string for an empty list. */
export const joinVerifiedPublisherTitles = (
  publishers: readonly DTOVerifiedPublisher[]
): string => {
  return publishers
    .map((publisher) => publisher.title?.trim() ?? '')
    .filter((title) => title !== '')
    .join(', ');
};
