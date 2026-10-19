---
name: abcaicast
description: Write or update two-voice training episodes about Podverse features, for an AI audio service that publishes them as an RSS course. Use when the operator says abcaicast.
---

# abcaicast

A cast is a script for an AI voice service. Two hosts talk through one feature so a contributor
can learn it by listening. It is training material, not a show.

The casts form one **course** that grows over time. Another agent turns each script into audio
and publishes it as an episode in an RSS feed. When a script changes, the operator hands that
agent the new file, and it replaces the episode it published before. Keeping the existing
episodes accurate matters as much as adding new ones.

## When the operator says abcaicast

A COPY-PASTA final section may end with an optional checkbox that only asks whether this work
should get a cast. That checkbox does not start one. Write a cast when the operator says
**abcaicast**.

1. **Get the subject.** If the command came without one, ask for a short description of what
   the cast should cover. When the operator asks whether the session needs a cast, decide
   from the session's work.
2. **Audit the course first.** List `misc/aicasts/` and read every header block. For each cast
   whose subject the session's work touched, check its claims against the current code and
   plans. Plans drift, and planned work gets built. Update any cast that is now wrong, or that
   is missing something a listener needs to understand.
3. **Prefer updating to adding.** Write a new cast only when the session's work needs one: no
   existing episode covers it, and adding it to one would push that episode past about 1,500
   words. Never write a second cast on a subject an episode already covers.
4. **Read the sources.** The plan set (`00-SUMMARY.md`, `00-EXECUTION-ORDER.md`, the numbered
   prompts) under `.llm/plans/active/` or `.llm/plans/completed/`, and the code when the work is
   built. For built work, check every number in the script against the code.
5. **Settle the scope.** When a subject needs more than about 1,500 words, split it across
   episodes in its group. If the scope is unclear or grows past what the operator described,
   ask before writing.
6. **Reorganize when it helps.** A cast may move into a group, and a group may be renumbered
   so the listening order makes sense. Rename the file to match. Keep its **Episode ID**.
7. **Write** under `misc/aicasts/`. Set a new **Version** and **Changed** line on every file
   you touch.
8. **Check** each script's word count, the vocabulary search below, and the template.
9. **Report** a table of every cast you added or changed: Episode ID, RSS title, version,
   whether the audio must be regenerated (the script changed) or only the title or
   description, and built or planned. Casts are committed, so include the paths in the
   operator's `git add` (**operator-only-git-operations**). A cast gets no release-notes
   scratchpad entry.

## Groups, numbers, and titles

- Every cast belongs to a group. A group is a course unit: related episodes, in a listening
  order. A cast that stands alone starts a new group as number 1.
- Every cast has a number in its group, even when order does not matter. Number in the order a
  listener should hear them. Put earlier parts first when a later part builds on them.
- The **RSS title** is `<Group Title> <n>: <Episode Title>`, for example
  `Content Lifecycle 4: One Show, Not Two`. The file's top heading is that same title. A
  listener scanning the feed sees which episodes belong together and in what order.
- The script names the group and its part number in the opening line. It never says how many
  parts the group has, so adding a part does not force earlier audio to be redone.
- The last line of an episode may point to the next part by subject, not by number.

## Versions and identity

- **Episode ID** is the stable key the publishing agent uses to find the published episode. It
  never changes, even when the title, number, group, or file name changes. Set it once, from the
  first file slug. A renamed cast keeps its old ID.
- **Version** is the date and time the file last changed, in ISO 8601 with the offset:
  `2026-10-19T00:13-05:00`. Take it from `date '+%Y-%m-%dT%H:%M%z'` and add the colon in the
  offset. Any change to the file sets a new version.
- **Changed** says what this version changed, in one sentence, and whether the audio changed:
  `Script and title updated; regenerate the audio.` or `Title and description only; the audio is
unchanged.` The first version says `First version.` When the title changed, name the previous
  title so the publisher can match an episode it published before Episode IDs existed.

## Files

- `misc/aicasts/<group-slug>-<n>-<slug>.md`. Kebab-case slugs named for the feature, not a plan
  number.
- Casts are committed and kept, so later sessions can see what has been covered and answer
  questions about a past cast. Never save one under `docs/`, `.artifacts/`, or `temp/`.
- `misc/aicasts/MISC-AICASTS.md` describes the folder and the header fields. Do not list casts
  in it; the directory listing and each file's header block are the index.
- When a cast changes, overwrite the file. Git keeps the history.
- Plan sets are deleted after their work lands, so a plan path in **Sources** stops resolving.
  For built work, always list the key code paths too. They keep the cast traceable.

## Template

```markdown
# <Group Title> <n>: <Episode Title>

- **Version:** <YYYY-MM-DDTHH:MM-05:00>
- **Episode ID:** <stable-id>
- **Changed:** <what this version changed, and whether the audio changed>
- **Description:** <one or two plain sentences; this is the RSS episode description>
- **Status:** Built | Planned | Partly built (<what is built>)
- **Group:** <Group Title>, part <n>
- **Sources:** <plan set paths, key code paths>
- **Length:** about <n> minutes (<word count> words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: <per cast; always include Podverse "POD-verse" and spell out acronyms>.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: ...

TOM: ...
```

## Hosts

- **Claire** leads. She explains the design and the reasons behind each rule.
- **Tom** is learning it. He asks what a new contributor would ask, pushes on edge cases, and
  restates key rules in his own words. He explains a part now and then so the cast does not
  become a lecture.
- Turns run one to five sentences. No turn over about 120 words.

## Shape

1. Opening, one or two turns: the group and part, what the feature is, and whether it is built
   or planned.
2. The problem, and who it hurts.
3. The rules the design holds to.
4. How it works, in the order data moves.
5. What users see, and the edge cases.
6. Rollout or operator steps, when there are any.
7. Recap: Tom states the three to five points to remember. Claire adds one closing line. No
   sign-off.

Put a `(pause)` line between sections.

## Embellishment

Add it only when it teaches.

- **Allowed:** Tom restating a rule, a concrete example, a "why not the simpler way?" question
  that sets up a decision, repeating a key number once, the closing recap.
- **Not allowed:** welcomes, show names, banter, jokes, praise ("great question"), invented
  anecdotes, sponsor-style lines, cliffhangers.

## Spoken style

- Write numbers as words ("ten thousand characters", "four-ten" for HTTP 410).
- Say identifiers in plain words ("the channel merge table"). Name a code identifier only when
  the listener will need to search for it.
- No markdown, lists, URLs, or code inside the script.
- UI labels exactly as shipped, in title case (**ui-copy-casing**): "Read Full Show Notes".
- Built work is described as it is; planned work as what the plan does.

## Accuracy and safety

- Say only what the plans or code say. Do not fill a gap with a guess; ask.
- The file goes to a third-party service and is committed to the repo. No secrets, credentials,
  account ids, customer data, or private hostnames (**public-repo-no-secrets**).
- Follow **llm-safe-plan-vocabulary** and **no-third-party-media-player-style**. Say "the
  retired-feeds list" for the Podcast Index file. Run:

```bash
rg -n -i '\bcandidate|\bdead\b|\bchild' misc/aicasts
```

Word count of a script section:

```bash
sed -n '/^## Script/,$p' misc/aicasts/<file>.md | rg -v '^\(pause\)$|^## ' | sed 's/^[A-Z]*: //' | wc -w
```
