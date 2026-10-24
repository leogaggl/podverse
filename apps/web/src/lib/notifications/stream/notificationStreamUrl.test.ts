import { describe, expect, it, vi } from 'vitest';

import { getClientApiBaseUrl } from '../../../factories/apiRequestService';
import { buildNotificationStreamUrl, readSseLastEventId } from './notificationStreamUrl';

const mockApiConfig = vi.hoisted(() => ({
  client: { protocol: 'http', host: 'localhost', port: '4030' },
  prefix: '/api',
  version: '/v2',
}));

vi.mock('../../../config', () => ({
  getConfig: () => ({ public: { api: mockApiConfig } }),
}));

describe('buildNotificationStreamUrl', () => {
  it('returns the bare stream path when there is no last event id', () => {
    expect(buildNotificationStreamUrl('http://localhost:4030/api/v2', null)).toBe(
      'http://localhost:4030/api/v2/account/events'
    );
  });

  it('adds last_event_id when the id is a positive integer', () => {
    expect(buildNotificationStreamUrl('http://localhost:4030/api/v2', 42)).toBe(
      'http://localhost:4030/api/v2/account/events?last_event_id=42'
    );
  });
});

describe('readSseLastEventId', () => {
  it('accepts a positive integer string and rejects everything else', () => {
    expect(readSseLastEventId('42')).toBe(42);
    for (const value of ['', '0', '-1', '4.2', 'abc']) {
      expect(readSseLastEventId(value)).toBeNull();
    }
  });
});

describe('getClientApiBaseUrl', () => {
  it('composes the browser-facing API base from config', () => {
    mockApiConfig.prefix = '/api';
    expect(getClientApiBaseUrl()).toBe('http://localhost:4030/api/v2');
  });

  it('drops a trailing slash on the prefix', () => {
    mockApiConfig.prefix = '/api/';
    expect(getClientApiBaseUrl()).toBe('http://localhost:4030/api/v2');
  });
});
