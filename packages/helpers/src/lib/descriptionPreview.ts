import { DESCRIPTION_PREVIEW_MAX_LENGTH } from './descriptionLimits.js';
import { escapeHtml, htmlToPlainTextPreview } from './html.js';

type DescriptionPreviewSource =
  | { preview?: string | null; value?: string | null; is_truncated?: boolean }
  | null
  | undefined;

export function getDescriptionPreviewText(description: DescriptionPreviewSource): string {
  const preview = description?.preview;
  if (typeof preview === 'string' && preview.length > 0) {
    return preview;
  }

  const value = description?.value;
  if (typeof value === 'string' && value.length > 0) {
    return htmlToPlainTextPreview(value, DESCRIPTION_PREVIEW_MAX_LENGTH);
  }

  return '';
}

export function isDescriptionTruncated(description: DescriptionPreviewSource): boolean {
  return description?.is_truncated === true;
}

/** Stored description left on an archived episode or show: the preview, as one paragraph. */
export function buildArchivedDescriptionValue(preview: string): string {
  if (preview.length === 0) {
    return '';
  }
  return `<p>${escapeHtml(preview)}</p>`;
}
