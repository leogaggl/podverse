import { describe, expect, it } from 'vitest';

import type { DTOVerifiedPublisher } from '../dtos/channel/verifiedPublisher.js';
import { joinVerifiedPublisherTitles, resolveVerifiedPublishers } from './verifiedPublishers.js';

const publisher = (
  id_text: string,
  title: string | null,
  medium_id: number
): DTOVerifiedPublisher => ({
  id_text,
  title,
  medium_id,
});

describe('resolveVerifiedPublishers', () => {
  const artist = publisher('artist', 'Artist', 22);
  const guest = publisher('guest', 'Guest', 22);
  const channelGuest = publisher('guest', 'Channel Guest', 22);
  const itemGuest = publisher('guest', 'Item Guest', 22);

  it('lists channel-wide publishers first, then item-only ones', () => {
    expect(
      resolveVerifiedPublishers({
        channel: { verified_publishers: [artist] },
        item: { verified_publishers: [guest] },
      })
    ).toEqual([artist, guest]);
  });

  it('keeps a publisher that is on both lists once, at its channel-wide place', () => {
    expect(
      resolveVerifiedPublishers({
        channel: { verified_publishers: [artist, channelGuest] },
        item: { verified_publishers: [itemGuest] },
      })
    ).toEqual([artist, channelGuest]);
  });

  it('leaves out an entry whose title is null or blank', () => {
    expect(
      resolveVerifiedPublishers({
        channel: {
          verified_publishers: [
            publisher('blank', '   ', 1),
            publisher('empty', '', 1),
            publisher('missing', null, 1),
            publisher('kept', ' Kept ', 1),
          ],
        },
      })
    ).toEqual([publisher('kept', ' Kept ', 1)]);
  });

  it('returns an empty list when both sides omit the field', () => {
    expect(resolveVerifiedPublishers({})).toEqual([]);
    expect(resolveVerifiedPublishers({ channel: null, item: null })).toEqual([]);
    expect(resolveVerifiedPublishers({ channel: {}, item: {} })).toEqual([]);
  });
});

describe('joinVerifiedPublisherTitles', () => {
  it("joins titles as 'A, B' and returns an empty string for an empty list", () => {
    expect(
      joinVerifiedPublisherTitles([
        publisher('a', 'A', 22),
        publisher('blank', '  ', 22),
        publisher('b', ' B ', 22),
      ])
    ).toBe('A, B');
    expect(joinVerifiedPublisherTitles([])).toBe('');
  });
});
