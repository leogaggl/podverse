export type DescriptionTextPart =
  | { kind: 'text'; text: string }
  | { kind: 'clock'; text: string; seconds: number };

const CLOCK_SOURCE = '(?:(\\d+):([0-5]\\d):([0-5]\\d)|(\\d+):([0-5]\\d))';
const MERIDIEM = /^\s*(?:a\.?m\.?|p\.?m\.?)(?![a-z])/i;

const isDigitCode = (code: number): boolean => code >= 48 && code <= 57;

const isDigitAt = (text: string, index: number): boolean => {
  if (index < 0 || index >= text.length) {
    return false;
  }
  return isDigitCode(text.charCodeAt(index));
};

const isInsideUrlToken = (text: string, index: number): boolean => {
  let start = index;
  while (start > 0 && !/\s/.test(text.charAt(start - 1))) {
    start -= 1;
  }
  const token = text.slice(start, index);
  return token.includes('://') || /^www\./i.test(token);
};

const clockSeconds = (match: RegExpExecArray): number | null => {
  const hours = match[1];
  const hourMinutes = match[2];
  const hourSeconds = match[3];
  if (hours !== undefined && hourMinutes !== undefined && hourSeconds !== undefined) {
    return Number(hours) * 3600 + Number(hourMinutes) * 60 + Number(hourSeconds);
  }

  const minutesOnly = match[4];
  const minuteSeconds = match[5];
  if (minutesOnly !== undefined && minuteSeconds !== undefined) {
    return Number(minutesOnly) * 60 + Number(minuteSeconds);
  }

  return null;
};

/**
 * Split show-note prose into plain runs and clock tokens.
 *
 * A clock is `h:mm:ss` or `m:ss` (seconds `00`–`59`). Hours, when present, keep minutes in
 * `00`–`59`. A minutes-only clock may run past 59 minutes. The token must not sit against another
 * digit, a colon, a following am/pm, or the path of a URL. `0:00` is a clock at the start of the item.
 */
export function splitDescriptionClocks(text: string): DescriptionTextPart[] {
  if (text.length === 0) {
    return [];
  }

  const pattern = new RegExp(CLOCK_SOURCE, 'g');
  const parts: DescriptionTextPart[] = [];
  let cursor = 0;

  let match = pattern.exec(text);
  while (match !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const seconds = clockSeconds(match);
    const previous = start > 0 ? text.charAt(start - 1) : '';
    const rejected =
      seconds === null ||
      isDigitAt(text, start - 1) ||
      previous === ':' ||
      isDigitAt(text, end) ||
      MERIDIEM.test(text.slice(end)) ||
      isInsideUrlToken(text, start);

    if (rejected) {
      pattern.lastIndex = start + 1;
      match = pattern.exec(text);
      continue;
    }

    if (start > cursor) {
      parts.push({ kind: 'text', text: text.slice(cursor, start) });
    }

    parts.push({ kind: 'clock', text: match[0], seconds });
    cursor = end;
    match = pattern.exec(text);
  }

  if (parts.length === 0) {
    return [{ kind: 'text', text }];
  }

  if (cursor < text.length) {
    parts.push({ kind: 'text', text: text.slice(cursor) });
  }

  return parts;
}
