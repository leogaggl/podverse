import { describe, expect, it } from 'vitest';

import { readDescriptionDocument } from './descriptionDocument.js';
import { buildArchivedDescriptionValue } from './descriptionPreview.js';

describe('buildArchivedDescriptionValue', () => {
  it('returns an empty string for an empty preview', () => {
    expect(buildArchivedDescriptionValue('')).toBe('');
  });

  it('wraps the escaped preview in a paragraph that strict parsing accepts', () => {
    const preview = `Tom & Jerry <3 "quotes" and 'apostrophes'`;
    const value = buildArchivedDescriptionValue(preview);

    expect(value).toBe('<p>Tom &amp; Jerry &lt;3 &quot;quotes&quot; and &#39;apostrophes&#39;</p>');
    expect(readDescriptionDocument(value).rich).toEqual([
      { kind: 'p', children: [{ kind: 'text', text: preview }] },
    ]);
  });
});
