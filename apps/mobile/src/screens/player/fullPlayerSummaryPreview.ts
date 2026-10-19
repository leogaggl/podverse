/**
 * Collapsed Summary preview for the full-player sheet.
 *
 * The sheet is a tall, height-locked card. A short character cut leaves that card partly empty
 * and puts Show more on screen immediately. The preview is plain text long enough to fill the
 * scrollport and continue a couple of lines past it, so the card reads as full and Show more is
 * reached by a short scroll. `collapsedMaxLines` places that control. `collapseLength` is the
 * plain-text budget, so a very long description is not mounted until the listener expands it.
 */

/** Body size of full-player pane prose. The Summary preview math and `paneText` both read these. */
export const FULL_PLAYER_PANE_TEXT_FONT_SIZE = 16;
export const FULL_PLAYER_PANE_TEXT_LINE_HEIGHT = 24;

/** Preview lines kept below the fold so Show more is not on screen until the listener scrolls. */
export const FULL_PLAYER_SUMMARY_OVERFLOW_LINES = 2;

/**
 * Advance of a narrow proportional glyph, as a fraction of font size. The budget uses a narrow
 * glyph so the mounted plain text still fills `collapsedMaxLines` when the run is mostly thin
 * letters. Lines past that cap have no height.
 */
const NARROW_GLYPH_EM = 0.25;

/** Upper bound on mounted collapsed plain text. The line cap still places Show more. */
const COLLAPSE_LENGTH_CAP = 12000;

export type FullPlayerSummaryPreviewInput = {
  /** Width of the summary text column, after the sheet and pane insets. */
  contentWidth: number;
  fontScale: number;
  /** Top inset of the summary block inside the scrollport. */
  paddingTop: number;
  /** Inner scroller height: the sheet slot minus the sheet's own vertical chrome. */
  scrollportHeight: number;
};

export type FullPlayerSummaryPreview = {
  collapseLength: number;
  collapsedMaxLines: number;
};

const positiveOr = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
};

export const resolveFullPlayerSummaryPreview = (
  input: FullPlayerSummaryPreviewInput
): FullPlayerSummaryPreview | null => {
  const contentWidth = input.contentWidth;
  const scrollportHeight = input.scrollportHeight;
  if (!Number.isFinite(contentWidth) || contentWidth <= 0) {
    return null;
  }
  if (!Number.isFinite(scrollportHeight) || scrollportHeight <= 0) {
    return null;
  }

  const fontScale = positiveOr(input.fontScale, 1);
  const paddingTop = Number.isFinite(input.paddingTop) ? Math.max(0, input.paddingTop) : 0;
  const lineHeight = FULL_PLAYER_PANE_TEXT_LINE_HEIGHT * fontScale;
  const textArea = Math.max(0, scrollportHeight - paddingTop);
  const visibleLines = Math.floor(textArea / lineHeight);
  const collapsedMaxLines = Math.max(1, visibleLines) + FULL_PLAYER_SUMMARY_OVERFLOW_LINES;
  const glyphWidth = FULL_PLAYER_PANE_TEXT_FONT_SIZE * fontScale * NARROW_GLYPH_EM;
  const charsPerLine = Math.max(1, Math.floor(contentWidth / glyphWidth));
  const collapseLength = Math.min(COLLAPSE_LENGTH_CAP, collapsedMaxLines * charsPerLine);

  return {
    collapseLength,
    collapsedMaxLines,
  };
};
