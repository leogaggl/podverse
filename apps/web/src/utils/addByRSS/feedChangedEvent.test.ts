import { describe, expect, it, vi } from 'vitest';

import { canonicalAddByRSSFeedUrl } from '@podverse/helpers-validation/client';

import { emitAddByRSSFeedChanged, onAddByRSSFeedChanged } from './feedChangedEvent';

describe('Add by RSS feed changed event', () => {
  it('delivers the canonical feed URL, without credentials, until unsubscribed', () => {
    const handler = vi.fn();
    const unsubscribe = onAddByRSSFeedChanged(handler);

    emitAddByRSSFeedChanged('https://user:secret@Example.com/feed.xml');
    unsubscribe();
    emitAddByRSSFeedChanged('https://example.com/feed.xml');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(canonicalAddByRSSFeedUrl('https://example.com/feed.xml'));
    expect(JSON.stringify(handler.mock.calls)).not.toContain('secret');
  });
});
