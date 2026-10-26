**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 23 — Livestream training script matches the settled order

## Rows

R19

## Runs after

20

## Contract this script must say

From plan 20, kept in `00-REQUEST.md` (D3–D7). Say it in the two Claire turns below. Do not
reopen the window length.

- Live items: latest start first. They stay listed, with no time window.
- Scheduled items: soonest start first, on the upcoming routes and on a channel's livestream
  list.
- A scheduled item whose start is more than a day in the past is hidden. The instant one day
  past is still listed, same as the ended window's "more than a day".
- A scheduled Add by RSS item with no start time stays. It sorts last among scheduled items.
  On a channel list that also has ended items, it does not sort after those ended items.
  Say "among scheduled items" so the line is not heard that way. Directory rows always have a
  start time; only Add by RSS can lack one.

One day is the kept 24-hour window. The episode already says "a day" and "one-day". Keep that
diction. Write numbers as words. No code identifiers in the spoken lines.

## Changes

One file. Follow `.cursor/skills/abcaicast/SKILL.md` § Versions and identity for the header.
Do not edit any other file under `misc/aicasts/`. Do not edit plans 20, 21, or 22.

### Header

- **Version:** run `date '+%Y-%m-%dT%H:%M%z'` and insert a colon in the offset, so `-0500`
  becomes `-05:00`.
- **Changed:** replace the current sentence with: `Spoken order is now live items latest start
  first and scheduled items soonest start first. A scheduled item more than a day past its start
  is hidden, and a scheduled Add by RSS item with no start time stays. Regenerate the audio.`
- **Length:** after the edits, run the word-count command under Checks and set this line from
  that count. Minutes are the count divided by 150, rounded to the nearest minute. Expect about
  10 minutes and about 1430 words.
- Leave **Episode ID**, the title, **Description**, **Status**, **Group**, **Sources**, and the
  directions block as they are.

### Upcoming routes (Claire, the "Two new API routes" turn)

This turn says both groups use the earliest start. That contradicts live items latest start
first. Replace the whole turn with:

```markdown
CLAIRE: Two new API routes. One lists upcoming livestreams across public channels. The other lists them from the channels a signed-in person follows. Both take a medium and a page, and nothing else. They return only live and scheduled items. Live items come first, latest start first, then scheduled items, soonest start first, then by item id, so page boundaries stay stable. A page holds sixty items. A scheduled item whose start is more than a day in the past is hidden. A live item stays listed with no time window. Ended items never appear, however recent.
```

The turn is 96 words.

### Channel livestream list (Claire, the "On the phone, an Add by RSS feed's page" turn)

This turn says "Live and scheduled show the latest start first." Replace the whole turn with:

```markdown
CLAIRE: On the phone, an Add by RSS feed's page now lists its livestreams above Episodes or Tracks, the way a directory podcast page does. Inside a channel the order differs from the chip. Live first, latest start first, then scheduled, soonest start first, then ended, latest end first. An ended item more than a day old is hidden, and a scheduled item is hidden once its start is more than a day past. Live items have no time window. A scheduled Add by RSS item with no start time stays and sorts last among scheduled items. The website's Add by RSS pages use that same order and the same one-day rules. The episode sort chip doesn't reorder the livestream block.
```

The turn is 120 words. "differs" is only there so the turn stays within about 120 words. Do not
add a new exchange to make room.

"Inside a channel" is the directory channel list on the phone. The last sentences keep the
website Add by RSS pages on that same order, and the episode sort chip still does not reorder
the livestream block.

### To remember (Tom)

Leave this turn unchanged. It does not say that channel live and scheduled items show the latest
start first.

- Point three still says the Livestreams chip shows live first, then scheduled, never ended.
  That group order is still true. It does not state a start direction.
- Point four still says that inside a channel, ended items stay for one day. That is still true.
  The new scheduled window and the split start order are in the two Claire turns above.

### Leave the rest of the episode

Do not edit any other spoken line. These stay because they do not state the old start order:
the four design rules, "Every place drops ended items and sorts live first, then scheduled",
the chip locations, playback, and the closing Claire line.

## Files

misc/aicasts/livestreams-1-a-flag-not-a-kind-of-show.md

## Tests

none

## Release scratchpad

none

## Checks

The implementer runs these while editing. They are not operator verification.

Word count of the script section. Put that count in **Length**.

```bash
sed -n '/^## Script/,$p' misc/aicasts/livestreams-1-a-flag-not-a-kind-of-show.md | rg -v '^\(pause\)$|^## ' | sed 's/^[A-Z]*: //' | wc -w
```

Run the vocabulary search from `.cursor/skills/abcaicast/SKILL.md` § Accuracy and safety
against this file. It must not match.

Confirm the spoken script no longer contains `earliest first` or
`Live and scheduled show the latest start first`.
