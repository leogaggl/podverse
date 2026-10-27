---
name: time-format-local
description: Ensures client-side time displays use formatDateTimeAbbrev for localized, readable timestamps. Use when rendering dates/times in the UI or when the user mentions time formatting or local timezone display.
---

# Local Time Formatting

## Instructions

- For client-side UI that displays a **calendar or wall-clock** time to users, use
  `formatDateTimeAbbrev` from `@podverse/helpers`.
- Pass the active locale (typically from `useLocale()` / `next-intl`) to keep i18n consistent.
- The label is the local calendar date, `-`, then the local time (`Oct 26, 2026 - 11:16 PM`).
  Omit `timeZone` so the clock is the device timezone, and do not append a zone abbreviation or
  the word “at”.
- **Not this skill:** playhead, duration, clip, chapter, and transcript clocks. Those use
  `formatHHMMSS` — see **playback-timestamp-format**.

## Example

```ts
import { formatDateTimeAbbrev } from '@podverse/helpers';
import { useLocale } from 'next-intl';

const locale = useLocale();
const label = formatDateTimeAbbrev(lastParsedAt, locale);
```
