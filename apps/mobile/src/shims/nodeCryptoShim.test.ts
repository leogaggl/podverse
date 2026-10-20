import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { getAddByRSSHashId } from '@podverse/helpers';

type HashShim = {
  createHash: (algorithm: string) => {
    update: (data: string) => { digest: (encoding: 'hex') => string };
  };
};

const require = createRequire(import.meta.url);

const isHashShim = (value: unknown): value is HashShim =>
  typeof value === 'object' &&
  value !== null &&
  'createHash' in value &&
  typeof value.createHash === 'function';

const loadShim = (): HashShim => {
  const loaded: unknown = require('./node-crypto.js');
  if (!isHashShim(loaded)) {
    throw new Error('node-crypto shim does not export createHash');
  }
  return loaded;
};

describe('node-crypto shim', () => {
  const shim = loadShim();

  it('hashes non-ASCII strings as UTF-8, matching Node', () => {
    const input = 'Épisode 3 — café ü 🎧 日本語';

    expect(shim.createHash('md5').update(input).digest('hex')).toBe(
      createHash('md5').update(input, 'utf8').digest('hex')
    );
    expect(shim.createHash('sha256').update(input).digest('hex')).toBe(
      createHash('sha256').update(input, 'utf8').digest('hex')
    );
  });

  it('gives an Add by RSS episode with a non-ASCII guid the same id the API computes', () => {
    const minimal = { feed_url: 'https://example.com/feed.xml', guid: 'épisode-ü-🎧' };

    expect(shim.createHash('md5').update(JSON.stringify(minimal)).digest('hex')).toBe(
      getAddByRSSHashId({ ...minimal, title: 'ignored' })
    );
  });
});
