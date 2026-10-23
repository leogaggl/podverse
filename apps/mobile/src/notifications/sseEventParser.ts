export type SseParsedItem =
  | { kind: 'event'; event: string; data: string; id: string | null }
  | { kind: 'comment' }
  | { kind: 'retry'; ms: number };

export type SseEventParser = {
  /** Feeds decoded text and returns every item completed by it. Partial lines wait for more. */
  push: (chunk: string) => SseParsedItem[];
};

const DEFAULT_EVENT_NAME = 'message';

/**
 * Incremental parser for the server-sent events wire format. Accepts `\n`, `\r\n`, and `\r`
 * line endings, including a `\r\n` split across two chunks. Unknown fields are ignored, and an
 * `id` applies only to the event it appears in.
 */
export function createSseEventParser(): SseEventParser {
  let buffer = '';
  let skipLeadingLineFeed = false;
  let eventName: string | null = null;
  let dataLines: string[] = [];
  let eventId: string | null = null;

  const resetPendingEvent = (): void => {
    eventName = null;
    dataLines = [];
    eventId = null;
  };

  const processLine = (line: string, items: SseParsedItem[]): void => {
    if (line === '') {
      if (dataLines.length > 0) {
        items.push({
          kind: 'event',
          event: eventName ?? DEFAULT_EVENT_NAME,
          data: dataLines.join('\n'),
          id: eventId,
        });
      }
      resetPendingEvent();
      return;
    }

    if (line.startsWith(':')) {
      items.push({ kind: 'comment' });
      return;
    }

    const colonIndex = line.indexOf(':');
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    let value = colonIndex === -1 ? '' : line.slice(colonIndex + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    switch (field) {
      case 'event':
        eventName = value;
        return;
      case 'data':
        dataLines.push(value);
        return;
      case 'id':
        eventId = value;
        return;
      case 'retry':
        if (/^\d+$/.test(value)) {
          items.push({ kind: 'retry', ms: Number(value) });
        }
        return;
      default:
        return;
    }
  };

  return {
    push(chunk: string): SseParsedItem[] {
      const items: SseParsedItem[] = [];
      if (chunk === '') {
        return items;
      }

      let text = chunk;
      if (skipLeadingLineFeed) {
        skipLeadingLineFeed = false;
        if (text.startsWith('\n')) {
          text = text.slice(1);
        }
      }

      buffer += text;
      let lineStart = 0;
      let index = 0;
      while (index < buffer.length) {
        const char = buffer[index];
        if (char !== '\n' && char !== '\r') {
          index += 1;
          continue;
        }

        processLine(buffer.slice(lineStart, index), items);
        if (char === '\r') {
          if (index + 1 === buffer.length) {
            skipLeadingLineFeed = true;
          } else if (buffer[index + 1] === '\n') {
            index += 1;
          }
        }
        index += 1;
        lineStart = index;
      }

      buffer = buffer.slice(lineStart);
      return items;
    },
  };
}
