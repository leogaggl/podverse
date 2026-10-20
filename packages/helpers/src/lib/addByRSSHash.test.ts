import crypto from 'crypto';
import { describe, expect, it } from 'vitest';

import {
  extractAddByRSSHashInput,
  getAddByRSSHashId,
  getLegacyAddByRSSHashId,
  isDeviceLocalAddByRSSGuid,
} from './addByRSSHash.js';

const md5 = (s: string): string => crypto.createHash('md5').update(s).digest('hex');

const FEED_URL = 'https://feeds.example.com/show.xml';

describe('extractAddByRSSHashInput', () => {
  it('uses feed_url then guid when feed_url is present', () => {
    const input = extractAddByRSSHashInput({
      guid: 'ep-1',
      channel_id_text: 'chanAbc123',
      enclosure_url: 'https://cdn.example.com/1.mp3',
      feed_url: FEED_URL,
    });
    expect(JSON.stringify(input)).toBe(`{"feed_url":"${FEED_URL}","guid":"ep-1"}`);
  });

  it('falls back to enclosure_url when the guid is missing', () => {
    const input = extractAddByRSSHashInput({
      feed_url: FEED_URL,
      guid: '   ',
      enclosure_url: ' https://cdn.example.com/1.mp3 ',
    });
    expect(JSON.stringify(input)).toBe(
      `{"feed_url":"${FEED_URL}","enclosure_url":"https://cdn.example.com/1.mp3"}`
    );
  });

  it('treats a device-local guid as no guid in the feed form', () => {
    const input = extractAddByRSSHashInput({
      feed_url: FEED_URL,
      channel_id_text: 'chanAbc123',
      guid: 'chanAbc123-7',
      enclosure_url: 'https://cdn.example.com/7.mp3',
    });
    expect(JSON.stringify(input)).toBe(
      `{"feed_url":"${FEED_URL}","enclosure_url":"https://cdn.example.com/7.mp3"}`
    );
  });

  it('gives the same id for the same episode on two devices', () => {
    const deviceA = { feed_url: FEED_URL, channel_id_text: 'deviceAaaaa', guid: 'ep-1' };
    const deviceB = { feed_url: FEED_URL, channel_id_text: 'deviceBbbbb', guid: 'ep-1' };
    expect(getAddByRSSHashId(deviceA)).toBe(getAddByRSSHashId(deviceB));
  });

  it('keeps the legacy input byte for byte without feed_url', () => {
    expect(
      JSON.stringify(
        extractAddByRSSHashInput({ guid: ' ep-1 ', channel_id_text: ' chanAbc123 ', title: 'x' })
      )
    ).toBe('{"channel_id_text":"chanAbc123","guid":"ep-1"}');
    expect(
      JSON.stringify(
        extractAddByRSSHashInput({
          channel_id_text: 'chanAbc123',
          guid: 'chanAbc123-3',
          enclosure_url: 'https://cdn.example.com/3.mp3',
        })
      )
    ).toBe('{"channel_id_text":"chanAbc123","guid":"chanAbc123-3"}');
    expect(
      JSON.stringify(
        extractAddByRSSHashInput({
          channel_id_text: 'chanAbc123',
          enclosure_url: 'https://cdn.example.com/3.mp3',
        })
      )
    ).toBe('{"channel_id_text":"chanAbc123","enclosure_url":"https://cdn.example.com/3.mp3"}');
    expect(getAddByRSSHashId({ channel_id_text: 'chanAbc123', guid: 'ep-1' })).toBe(
      md5('{"channel_id_text":"chanAbc123","guid":"ep-1"}')
    );
  });

  it('returns an empty input for non-objects', () => {
    expect(extractAddByRSSHashInput(null)).toEqual({});
    expect(getAddByRSSHashId('nope')).toBe(md5('{}'));
  });
});

describe('getLegacyAddByRSSHashId', () => {
  it('hashes the payload as if it had no feed_url', () => {
    const data = { feed_url: FEED_URL, channel_id_text: 'chanAbc123', guid: 'ep-1' };
    expect(getLegacyAddByRSSHashId(data)).toBe(
      md5('{"channel_id_text":"chanAbc123","guid":"ep-1"}')
    );
    expect(getLegacyAddByRSSHashId(data)).not.toBe(getAddByRSSHashId(data));
  });
});

describe('isDeviceLocalAddByRSSGuid', () => {
  it('matches the channel id, a hyphen, and digits only', () => {
    expect(isDeviceLocalAddByRSSGuid('chanAbc123-0', 'chanAbc123')).toBe(true);
    expect(isDeviceLocalAddByRSSGuid('chanAbc123-42', ' chanAbc123 ')).toBe(true);
    expect(isDeviceLocalAddByRSSGuid('chanAbc123-', 'chanAbc123')).toBe(false);
    expect(isDeviceLocalAddByRSSGuid('chanAbc123-4a', 'chanAbc123')).toBe(false);
    expect(isDeviceLocalAddByRSSGuid('otherChan1-4', 'chanAbc123')).toBe(false);
    expect(isDeviceLocalAddByRSSGuid('chanAbc123-4', null)).toBe(false);
  });
});
