import { APP_ROUTES } from './appRoutes.js';

export type CopyMarkdownSurface = 'web' | 'mobile';

export type CopyMarkdownImageKey = 'app_store' | 'google_play' | 'f_droid';

export type CopyMarkdownComponentKey = 'feature_comparison';

export type CopyMarkdownHeadingLevel = 1 | 2 | 3;

export type CopyMarkdownBlock =
  | { type: 'heading'; level: CopyMarkdownHeadingLevel; text: string }
  | { type: 'paragraph'; spans: CopyMarkdownInlineSpan[] }
  | { type: 'list'; items: CopyMarkdownInlineSpan[][] }
  | { type: 'image'; key: CopyMarkdownImageKey; href: string }
  | { type: 'component'; key: CopyMarkdownComponentKey }
  | {
      type: 'described_link';
      key: CopyMarkdownAppLinkKey;
      title: string;
      description: string;
    };

export const COPY_MARKDOWN_APP_LINK_KEYS = [
  'api_reference',
  'api_spec',
  'settings_developer',
] as const;

export type CopyMarkdownAppLinkKey = (typeof COPY_MARKDOWN_APP_LINK_KEYS)[number];

export type CopyMarkdownAppLinkTarget = {
  href: string;
  external: boolean;
};

export type CopyMarkdownInlineSpan =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'link'; text: string; href: string }
  | { type: 'app_link'; key: CopyMarkdownAppLinkKey; text: string };

export type ParseCopyMarkdownOptions = {
  surface?: CopyMarkdownSurface;
};

const INLINE_TOKEN_PATTERN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

const HEADING_PATTERN = /^(#{1,3}) (.+)$/;

const IMAGE_DIRECTIVE_PATTERN =
  /^\{\{image:(app_store|google_play|f_droid)\}\}\((https?:\/\/[^)]+)\)$/;

const SURFACE_OPEN_PATTERN = /^\{\{(web|mobile)\}\}$/;
const SURFACE_CLOSE_PATTERN = /^\{\{\/(web|mobile)\}\}$/;
const FEATURE_COMPARISON_DIRECTIVE = '{{feature_comparison}}';
const DIRECTIVE_LINE_PATTERN = /^\{\{[^}]+\}\}(?:\([^)]*\))?$/;
const DESCRIBED_LINK_OPEN_PATTERN = /^\{\{described_link:([a-z0-9_]+)\}\}$/;
const DESCRIBED_LINK_CLOSE = '{{/described_link}}';

function isCopyMarkdownImageKey(value: string): value is CopyMarkdownImageKey {
  return value === 'app_store' || value === 'google_play' || value === 'f_droid';
}

function isCopyMarkdownSurface(value: string): value is CopyMarkdownSurface {
  return value === 'web' || value === 'mobile';
}

function isCopyMarkdownHeadingLevel(value: number): value is CopyMarkdownHeadingLevel {
  return value === 1 || value === 2 || value === 3;
}

function isCopyMarkdownAppLinkKey(value: string): value is CopyMarkdownAppLinkKey {
  return COPY_MARKDOWN_APP_LINK_KEYS.some((key) => key === value);
}

const APP_LINK_HREF_PATTERN = /^\{\{([a-z0-9_]+)\}\}$/;

function appLinkKeyFromHref(href: string): CopyMarkdownAppLinkKey | null {
  const match = APP_LINK_HREF_PATTERN.exec(href.trim());
  const key = match?.[1];
  if (key === undefined || !isCopyMarkdownAppLinkKey(key)) {
    return null;
  }
  return key;
}

function isBareAppLinkToken(href: string): boolean {
  return /^\{\{[^}]+\}\}$/.test(href.trim());
}

function withoutOneTrailingSlash(apiBaseUrl: string): string {
  if (apiBaseUrl.endsWith('/')) {
    return apiBaseUrl.slice(0, -1);
  }
  return apiBaseUrl;
}

/** Interactive API reference. One trailing slash on the base is removed before `/docs`. */
export function apiDocsUrl(apiBaseUrl: string): string {
  return `${withoutOneTrailingSlash(apiBaseUrl)}/docs`;
}

/** Raw OpenAPI document. One trailing slash on the base is removed before `/docs.yaml`. */
export function apiDocsYamlUrl(apiBaseUrl: string): string {
  return `${withoutOneTrailingSlash(apiBaseUrl)}/docs.yaml`;
}

/** Destination for an allowlisted app link token. Docs leave the site. Settings stays on it. */
export function copyMarkdownAppLinkTarget(
  key: CopyMarkdownAppLinkKey,
  apiBaseUrl: string
): CopyMarkdownAppLinkTarget {
  switch (key) {
    case 'api_reference':
      return { href: apiDocsUrl(apiBaseUrl), external: true };
    case 'api_spec':
      return { href: apiDocsYamlUrl(apiBaseUrl), external: true };
    case 'settings_developer':
      return { href: `${APP_ROUTES.SETTINGS}?tab=developer`, external: false };
    default: {
      const unexpected: never = key;
      throw new Error(`Unknown copy markdown app link: ${String(unexpected)}`);
    }
  }
}

/**
 * A described link is a title line, then a description, closed by `{{/described_link}}`.
 * The key names the destination. The surface supplies the href.
 */
function readDescribedLink(
  lines: string[],
  openIndex: number
): { nextIndex: number; block: CopyMarkdownBlock | null } {
  const openLine = lines[openIndex]?.trim() ?? '';
  const open = DESCRIBED_LINK_OPEN_PATTERN.exec(openLine);
  const keyRaw = open?.[1];
  const content: string[] = [];
  let index = openIndex + 1;
  while (index < lines.length) {
    const line = lines[index]?.trim() ?? '';
    if (line === DESCRIBED_LINK_CLOSE) {
      index += 1;
      break;
    }
    if (line !== '') {
      content.push(line);
    }
    index += 1;
  }

  const title = content[0];
  const description = content.slice(1).join(' ').trim();
  if (
    keyRaw === undefined ||
    !isCopyMarkdownAppLinkKey(keyRaw) ||
    title === undefined ||
    title === '' ||
    description === ''
  ) {
    return { nextIndex: index, block: null };
  }

  return {
    nextIndex: index,
    block: { type: 'described_link', key: keyRaw, title, description },
  };
}

function normalizedCopyMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n');
}

function firstHeadingIndex(normalized: string): number | null {
  const headingMatch = /(?:^|\n)# /.exec(normalized);
  if (headingMatch === null || headingMatch.index === undefined) {
    return null;
  }
  return headingMatch.index;
}

/** Prose before the first heading. The whole document when it has no leading prose. */
export function getCopyMarkdownIntro(markdown: string): string {
  const normalized = normalizedCopyMarkdown(markdown);
  const headingIndex = firstHeadingIndex(normalized);
  if (headingIndex === null) {
    return normalized.trim();
  }
  const prefix = normalized.slice(0, headingIndex).trim();
  if (prefix === '') {
    return normalized.trim();
  }
  return prefix;
}

/**
 * The document from the first heading onward, when leading prose is shown separately.
 * Empty when there is no heading, or when the document starts at a heading (the intro
 * already is the whole document).
 */
export function getCopyMarkdownDetails(markdown: string): string {
  const normalized = normalizedCopyMarkdown(markdown);
  const headingIndex = firstHeadingIndex(normalized);
  if (headingIndex === null) {
    return '';
  }
  const prefix = normalized.slice(0, headingIndex).trim();
  if (prefix === '') {
    return '';
  }
  return normalized.slice(headingIndex).trim();
}

export function parseCopyMarkdown(
  markdown: string,
  options: ParseCopyMarkdownOptions = {}
): CopyMarkdownBlock[] {
  const trimmed = markdown.replace(/\r\n/g, '\n').trim();
  if (trimmed === '') {
    return [];
  }

  const lines = trimmed.split('\n');
  const blocks: CopyMarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let skipSurface: CopyMarkdownSurface | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }
    const text = paragraphLines.join(' ').trim();
    paragraphLines = [];
    if (text === '') {
      return;
    }
    blocks.push({ type: 'paragraph', spans: parseInlineSpans(text) });
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    blocks.push({
      type: 'list',
      items: listItems.map((item) => parseInlineSpans(item)),
    });
    listItems = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? '';

    if (DESCRIBED_LINK_OPEN_PATTERN.test(line)) {
      flushParagraph();
      flushList();
      const read = readDescribedLink(lines, index);
      if (skipSurface === null && read.block !== null) {
        blocks.push(read.block);
      }
      index = read.nextIndex - 1;
      continue;
    }

    const surfaceOpen = SURFACE_OPEN_PATTERN.exec(line);
    if (surfaceOpen !== null) {
      flushParagraph();
      flushList();
      const regionSurface = surfaceOpen[1];
      if (
        regionSurface !== undefined &&
        isCopyMarkdownSurface(regionSurface) &&
        options.surface !== undefined &&
        options.surface !== regionSurface
      ) {
        skipSurface = regionSurface;
      }
      continue;
    }

    const surfaceClose = SURFACE_CLOSE_PATTERN.exec(line);
    if (surfaceClose !== null) {
      flushParagraph();
      flushList();
      const closedSurface = surfaceClose[1];
      if (
        closedSurface !== undefined &&
        isCopyMarkdownSurface(closedSurface) &&
        skipSurface === closedSurface
      ) {
        skipSurface = null;
      }
      continue;
    }

    if (skipSurface !== null) {
      continue;
    }

    if (line === '') {
      flushParagraph();
      flushList();
      continue;
    }

    if (line === FEATURE_COMPARISON_DIRECTIVE) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'component', key: 'feature_comparison' });
      continue;
    }

    const imageMatch = IMAGE_DIRECTIVE_PATTERN.exec(line);
    if (imageMatch !== null) {
      flushParagraph();
      flushList();
      const key = imageMatch[1];
      const href = imageMatch[2];
      if (key !== undefined && href !== undefined && isCopyMarkdownImageKey(key)) {
        blocks.push({
          type: 'image',
          key,
          href,
        });
      }
      continue;
    }

    if (DIRECTIVE_LINE_PATTERN.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = HEADING_PATTERN.exec(line);
    if (headingMatch !== null) {
      const hashes = headingMatch[1];
      const headingText = headingMatch[2];
      if (hashes !== undefined && headingText !== undefined) {
        const level = hashes.length;
        if (isCopyMarkdownHeadingLevel(level)) {
          flushParagraph();
          flushList();
          blocks.push({ type: 'heading', level, text: headingText.trim() });
          continue;
        }
      }
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      listItems.push(line.slice(2).trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function parseInlineSpans(text: string): CopyMarkdownInlineSpan[] {
  const spans: CopyMarkdownInlineSpan[] = [];
  let cursor = 0;
  INLINE_TOKEN_PATTERN.lastIndex = 0;
  let match = INLINE_TOKEN_PATTERN.exec(text);
  while (match !== null) {
    const matchIndex = match.index;
    if (matchIndex > cursor) {
      spans.push({ type: 'text', text: text.slice(cursor, matchIndex) });
    }
    const strongText = match[1];
    const linkText = match[2];
    const linkHref = match[3];
    if (strongText !== undefined) {
      spans.push({ type: 'strong', text: strongText });
    } else if (linkText !== undefined && linkHref !== undefined) {
      const appLinkKey = appLinkKeyFromHref(linkHref);
      if (appLinkKey !== null) {
        spans.push({ type: 'app_link', key: appLinkKey, text: linkText });
      } else if (isBareAppLinkToken(linkHref)) {
        spans.push({ type: 'text', text: linkText });
      } else {
        spans.push({ type: 'link', text: linkText, href: linkHref });
      }
    }
    cursor = INLINE_TOKEN_PATTERN.lastIndex;
    match = INLINE_TOKEN_PATTERN.exec(text);
  }
  if (cursor < text.length) {
    spans.push({ type: 'text', text: text.slice(cursor) });
  }
  if (spans.length === 0) {
    return [{ type: 'text', text }];
  }
  return spans;
}
