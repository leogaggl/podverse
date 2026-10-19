import { describe, expect, it } from 'vitest';

import { DescriptionLengthTierEnum } from '@podverse/helpers';

import {
  LEGACY_DESCRIPTION_CUT_LENGTH,
  planDescriptionBackfill,
} from './planDescriptionBackfill.js';

const tier = DescriptionLengthTierEnum.Standard;

describe('planDescriptionBackfill', () => {
  it('marks a row cut at the legacy length as truncated with an unknown source length', () => {
    const legacy = 'word '
      .repeat(LEGACY_DESCRIPTION_CUT_LENGTH)
      .slice(0, LEGACY_DESCRIPTION_CUT_LENGTH);

    const plan = planDescriptionBackfill(legacy, tier);

    expect(plan.legacyCut).toBe(true);
    expect(plan.is_truncated).toBe(true);
    expect(plan.source_length).toBeNull();
    expect(plan.preview.length).toBeGreaterThan(0);
  });

  it('keeps a short row whole and records its length', () => {
    const plan = planDescriptionBackfill('<p>Short notes.</p>', tier);

    expect(plan).toEqual({
      value: '<p>Short notes.</p>',
      preview: 'Short notes.',
      is_truncated: false,
      source_length: 'Short notes.'.length,
      legacyCut: false,
    });
  });

  it('turns plain text into paragraphs', () => {
    const plan = planDescriptionBackfill('Line one\nLine two\n\nLine three', tier);

    expect(plan.value).toBe('<p>Line one<br>Line two</p><p>Line three</p>');
  });

  it('gives a blank row an empty preview so it is not picked up again', () => {
    const plan = planDescriptionBackfill('   ', tier);

    expect(plan).toEqual({
      value: '   ',
      preview: '',
      is_truncated: false,
      source_length: 0,
      legacyCut: false,
    });
  });

  it('returns the same row when run on its own output', () => {
    const first = planDescriptionBackfill(
      '<p>First <a href="https://example.com">link</a>.</p><ul><li>One</li><li>Two</li></ul>',
      tier
    );
    const second = planDescriptionBackfill(first.value, tier);

    expect(second).toEqual(first);
  });
});
