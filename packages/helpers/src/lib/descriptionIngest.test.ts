import { describe, expect, it } from 'vitest';

import { readDescriptionDocument } from './descriptionDocument.js';
import {
  pickChannelDescriptionSource,
  pickItemDescriptionSource,
  prepareDescriptionForStorage,
} from './descriptionIngest.js';
import { DescriptionLengthTierEnum, suggestDescriptionLengthTier } from './descriptionLimits.js';
import { getDescriptionPreviewText, isDescriptionTruncated } from './descriptionPreview.js';

const buildLongShowNotes = (): string => {
  const items = Array.from({ length: 60 }, (_value, index) => {
    const itemNumber = index + 1;
    const repeated = `detail ${itemNumber} `.repeat(18);
    return `<li><a href="https://example.com/topic-${itemNumber}">Topic ${itemNumber}</a> ${repeated}</li>`;
  });

  return `<h2>Show Notes</h2><ul>${items.join('')}</ul>`;
};

describe('prepareDescriptionForStorage', () => {
  it('keeps rich markup and truncates long list notes at list-item boundaries', () => {
    const prepared = prepareDescriptionForStorage(
      buildLongShowNotes(),
      DescriptionLengthTierEnum.Standard
    );

    expect(prepared).not.toBeNull();
    expect(prepared?.is_truncated).toBe(true);
    expect(prepared?.value.includes('<ul>')).toBe(true);
    expect(prepared?.value.endsWith('</li></ul>')).toBe(true);
    expect(prepared?.value.includes('topic-60')).toBe(false);
    expect(readDescriptionDocument(prepared?.value).rich).not.toBeNull();
  });

  it('repairs old raw truncation that lands inside href markup', () => {
    const source = `<p>Start</p><a href="https://example.com/${'x'.repeat(2900)}">Read</a>`;
    const legacyTruncated = source.slice(0, 2500);
    const prepared = prepareDescriptionForStorage(
      legacyTruncated,
      DescriptionLengthTierEnum.Standard
    );

    expect(prepared).not.toBeNull();
    expect(readDescriptionDocument(prepared?.value).rich).not.toBeNull();
    expect(prepared?.value.includes('<a href="https://example.com/')).toBe(false);
  });

  it('handles implicit closes and stray close tags', () => {
    const prepared = prepareDescriptionForStorage(
      '<p>a<p>b</p><ul><li>x<li>y</ul></p></div>',
      DescriptionLengthTierEnum.Standard
    );

    expect(prepared?.value).toBe('<p>a</p><p>b</p><ul><li>x</li><li>y</li></ul>');
  });

  it('drops script/style payloads, including unclosed script tags', () => {
    const prepared = prepareDescriptionForStorage(
      '<p>Safe</p><script>bad()</script><style>.x{}</style><p>Also</p><script>tail',
      DescriptionLengthTierEnum.Standard
    );

    expect(prepared?.value).toBe('<p>Safe</p><p>Also</p>');
  });

  it('unwraps unsafe href protocols and keeps allowed links', () => {
    const prepared = prepareDescriptionForStorage(
      '<p><a href="javascript:alert(1)">bad</a> <a href="data:text/plain,abc">worse</a> ' +
        '<a href="mailto:test@example.com">mail</a> <a href="https://example.com">ok</a></p>',
      DescriptionLengthTierEnum.Standard
    );

    expect(prepared?.value.includes('javascript:')).toBe(false);
    expect(prepared?.value.includes('data:text/plain')).toBe(false);
    expect(prepared?.value.includes('<a href="mailto:test@example.com">mail</a>')).toBe(true);
    expect(prepared?.value.includes('<a href="https://example.com">ok</a>')).toBe(true);
  });

  it('maps plain text line breaks to paragraphs and br tags', () => {
    const prepared = prepareDescriptionForStorage(
      'Line one\nLine two\n\nLine three',
      DescriptionLengthTierEnum.Standard
    );

    expect(prepared?.value).toBe('<p>Line one<br>Line two</p><p>Line three</p>');
  });

  it('decodes entities in preview, escapes once in value, and is idempotent', () => {
    const prepared = prepareDescriptionForStorage(
      '<p>A &amp; B&nbsp;&#8217; C</p>',
      DescriptionLengthTierEnum.Standard
    );

    expect(prepared).not.toBeNull();
    expect(prepared?.preview).toBe('A & B ’ C');
    expect(prepared?.value.includes('&amp;')).toBe(true);
    expect(prepared?.value.includes('&nbsp;')).toBe(false);
    expect(prepared?.value.includes('&amp;amp;')).toBe(false);

    const reparsed = prepareDescriptionForStorage(
      prepared?.value ?? '',
      DescriptionLengthTierEnum.Standard
    );
    expect(reparsed?.value).toBe(prepared?.value);
    expect(reparsed?.preview).toBe(prepared?.preview);
    expect(reparsed?.is_truncated).toBe(false);
  });

  it('cuts a too-long first block at a word boundary with an ellipsis', () => {
    const giantParagraph = `<p>${'word '.repeat(2_400)}</p>`;
    const prepared = prepareDescriptionForStorage(
      giantParagraph,
      DescriptionLengthTierEnum.Standard
    );

    expect(prepared).not.toBeNull();
    expect(prepared?.is_truncated).toBe(true);
    expect(prepared?.value.endsWith('…</p>')).toBe(true);
  });

  it('removes empty formatting nodes and keeps stored length inside cap', () => {
    const prepared = prepareDescriptionForStorage(
      `<p>Intro</p>${'<b></b>'.repeat(100_000)}`,
      DescriptionLengthTierEnum.Standard
    );

    expect(prepared).not.toBeNull();
    expect(prepared?.value).toBe('<p>Intro</p>');
    expect(prepared?.value.length).toBeLessThanOrEqual(30_000);
  });

  it('truncates by tier and exposes tier suggestions at boundaries', () => {
    const input = `<p>${'word '.repeat(2_400)}</p>`;
    const standard = prepareDescriptionForStorage(input, DescriptionLengthTierEnum.Standard);
    const extended = prepareDescriptionForStorage(input, DescriptionLengthTierEnum.Extended);
    const maximum = prepareDescriptionForStorage(input, DescriptionLengthTierEnum.Maximum);

    expect(standard?.is_truncated).toBe(true);
    expect(extended?.is_truncated).toBe(false);
    expect(maximum?.is_truncated).toBe(false);

    expect(suggestDescriptionLengthTier(10_000)).toBe(DescriptionLengthTierEnum.Standard);
    expect(suggestDescriptionLengthTier(10_001)).toBe(DescriptionLengthTierEnum.Extended);
    expect(suggestDescriptionLengthTier(50_001)).toBeNull();
  });
});

describe('description source pickers and preview reader', () => {
  it('picks item description source in content -> descriptionRaw -> description -> summary order', () => {
    expect(
      pickItemDescriptionSource({
        content: '  ',
        descriptionRaw: '<p>raw</p>',
        description: '<p>description</p>',
        summary: '<p>summary</p>',
      })
    ).toBe('<p>raw</p>');

    expect(
      pickItemDescriptionSource({
        content: '<p>content</p>',
        descriptionRaw: '<p>raw</p>',
      })
    ).toBe('<p>content</p>');

    expect(
      pickItemDescriptionSource({
        content: '   ',
        descriptionRaw: ' ',
        description: '',
        summary: '<p>summary</p>',
      })
    ).toBe('<p>summary</p>');
  });

  it('picks channel description source in descriptionRaw -> description order', () => {
    expect(
      pickChannelDescriptionSource({
        descriptionRaw: ' ',
        description: '<p>description</p>',
      })
    ).toBe('<p>description</p>');

    expect(
      pickChannelDescriptionSource({
        descriptionRaw: '<p>raw</p>',
        description: '<p>description</p>',
      })
    ).toBe('<p>raw</p>');
  });

  it('prefers preview text and falls back to value text when preview is missing', () => {
    expect(getDescriptionPreviewText({ preview: 'Saved Preview', value: '<p>Ignored</p>' })).toBe(
      'Saved Preview'
    );

    const fallback = getDescriptionPreviewText({
      preview: '',
      value: '<p>Fallback from value text for older payloads</p>',
    });
    expect(fallback.startsWith('Fallback from value text')).toBe(true);
    expect(isDescriptionTruncated({ is_truncated: true })).toBe(true);
    expect(isDescriptionTruncated({ is_truncated: false })).toBe(false);
  });
});
