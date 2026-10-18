import { describe, expect, it } from 'vitest';

import { splitFaqLevel1Sections } from './faqSections';

describe('splitFaqLevel1Sections', () => {
  it('keeps text before the first level-1 heading as the preamble', () => {
    const split = splitFaqLevel1Sections(
      'Intro line.\n\n# First\nAnswer one.\n# Second\nAnswer two.'
    );

    expect(split.preamble).toBe('Intro line.');
    expect(split.sections).toEqual([
      { body: 'Answer one.', title: 'First' },
      { body: 'Answer two.', title: 'Second' },
    ]);
  });

  it('leaves deeper headings inside the section body', () => {
    const split = splitFaqLevel1Sections('# Topic\n## Detail\nStill the answer.');

    expect(split.preamble).toBe('');
    expect(split.sections).toEqual([{ body: '## Detail\nStill the answer.', title: 'Topic' }]);
  });

  it('returns the whole document as preamble when there is no level-1 heading', () => {
    const split = splitFaqLevel1Sections('## Only a subheading\n\nA paragraph.');

    expect(split.sections).toEqual([]);
    expect(split.preamble).toBe('## Only a subheading\n\nA paragraph.');
  });
});
