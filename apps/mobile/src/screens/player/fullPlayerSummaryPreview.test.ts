import { describe, expect, it } from 'vitest';

import {
  FULL_PLAYER_PANE_TEXT_LINE_HEIGHT,
  FULL_PLAYER_SUMMARY_OVERFLOW_LINES,
  resolveFullPlayerSummaryPreview,
} from './fullPlayerSummaryPreview';

const phoneSheet = {
  contentWidth: 340,
  fontScale: 1,
  paddingTop: 12,
  scrollportHeight: 681,
};

const pastTheFold = (
  scrollportHeight: number,
  paddingTop: number,
  collapsedMaxLines: number,
  fontScale: number
): number => {
  const lineHeight = FULL_PLAYER_PANE_TEXT_LINE_HEIGHT * fontScale;
  return paddingTop + collapsedMaxLines * lineHeight - scrollportHeight;
};

describe('resolveFullPlayerSummaryPreview', () => {
  it('fills a phone sheet and keeps Show more a short scroll past the fold', () => {
    const preview = resolveFullPlayerSummaryPreview(phoneSheet);
    expect(preview).not.toBeNull();
    if (preview === null) {
      return;
    }

    const lineHeight = FULL_PLAYER_PANE_TEXT_LINE_HEIGHT;
    const pastFold = pastTheFold(
      phoneSheet.scrollportHeight,
      phoneSheet.paddingTop,
      preview.collapsedMaxLines,
      phoneSheet.fontScale
    );
    expect(pastFold).toBeGreaterThanOrEqual(lineHeight);
    expect(pastFold).toBeLessThanOrEqual(lineHeight * FULL_PLAYER_SUMMARY_OVERFLOW_LINES);
    // This sheet's text area holds more than 720 characters at body size.
    expect(preview.collapseLength).toBeGreaterThan(720);
  });

  it('uses fewer, larger lines when text size is raised', () => {
    const base = resolveFullPlayerSummaryPreview(phoneSheet);
    const large = resolveFullPlayerSummaryPreview({ ...phoneSheet, fontScale: 2 });
    expect(base).not.toBeNull();
    expect(large).not.toBeNull();
    if (base === null || large === null) {
      return;
    }
    expect(large.collapsedMaxLines).toBeLessThan(base.collapsedMaxLines);
    expect(large.collapseLength).toBeLessThan(base.collapseLength);
  });

  it('budgets more characters for a wider column', () => {
    const narrow = resolveFullPlayerSummaryPreview(phoneSheet);
    const wide = resolveFullPlayerSummaryPreview({ ...phoneSheet, contentWidth: 900 });
    expect(narrow).not.toBeNull();
    expect(wide).not.toBeNull();
    if (narrow === null || wide === null) {
      return;
    }
    expect(wide.collapsedMaxLines).toBe(narrow.collapsedMaxLines);
    expect(wide.collapseLength).toBeGreaterThan(narrow.collapseLength);
  });

  it('returns null when the sheet has no measurable text area', () => {
    expect(
      resolveFullPlayerSummaryPreview({
        ...phoneSheet,
        scrollportHeight: 0,
      })
    ).toBeNull();
    expect(
      resolveFullPlayerSummaryPreview({
        ...phoneSheet,
        contentWidth: 0,
      })
    ).toBeNull();
  });
});
