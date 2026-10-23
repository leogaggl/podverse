import { describe, expect, it } from 'vitest';

import { apiDocsUrl, apiDocsYamlUrl } from './apiDocsUrl';

const LOCAL_BASE = 'http://localhost:4230/api/v2';
const EXAMPLE_BASE = 'https://example.com/api/v2';

describe('api docs URLs', () => {
  it('appends /docs and drops one trailing slash without removing /api/v2', () => {
    expect(apiDocsUrl(LOCAL_BASE)).toBe(`${LOCAL_BASE}/docs`);
    expect(apiDocsUrl(`${LOCAL_BASE}/`)).toBe(`${LOCAL_BASE}/docs`);
    expect(apiDocsUrl(EXAMPLE_BASE)).toBe(`${EXAMPLE_BASE}/docs`);
  });

  it('appends /docs.yaml the same way', () => {
    expect(apiDocsYamlUrl(LOCAL_BASE)).toBe(`${LOCAL_BASE}/docs.yaml`);
    expect(apiDocsYamlUrl(`${LOCAL_BASE}/`)).toBe(`${LOCAL_BASE}/docs.yaml`);
    expect(apiDocsYamlUrl(EXAMPLE_BASE)).toBe(`${EXAMPLE_BASE}/docs.yaml`);
  });

  it('returns null when the app has no server address', () => {
    expect(apiDocsUrl(null)).toBeNull();
    expect(apiDocsUrl('')).toBeNull();
    expect(apiDocsYamlUrl(null)).toBeNull();
    expect(apiDocsYamlUrl('')).toBeNull();
  });
});
