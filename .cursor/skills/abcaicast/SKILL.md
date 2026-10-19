---
name: abcaicast
description: Write a two-voice training conversation about a Podverse feature, for the operator to give to an AI audio service. Use when the operator says abcaicast.
---

# abcaicast

A cast is a script for an AI voice service. Two hosts talk through one feature so a contributor
can learn it by listening. It is training material, not a show.

## When the operator says abcaicast

1. **Get the subject.** If the command came without one, ask for a short description of what
   the cast should cover: the feature, plan set, or branch work, and anything to stress. Do not
   write until you have it.
2. **Check past casts.** List `misc/aicasts/` and read the header blocks. When a cast already
   covers the subject, update that file or add the next part of its series, and tell the
   operator which. Do not write a second cast on the same feature.
3. **Read the sources.** The plan set (`00-SUMMARY.md`, `00-EXECUTION-ORDER.md`, the numbered
   prompts) under `.llm/plans/active/` or `.llm/plans/completed/`, and the code when the work is
   built. For built work, check every number in the script against the code. Plans drift.
4. **Settle the scope.** One cast per feature or plan set. When a subject needs more than about
   1,500 words, split it into a series. If the scope is unclear or grows past what the operator
   described, ask before writing.
5. **Write** under `misc/aicasts/`.
6. **Check** the script's word count, the vocabulary search below, and the format template.
7. **Report** each path, its word count and minutes, and whether it describes built or planned
   work. Casts are committed, so include the paths in the operator's `git add`
   (**operator-only-git-operations**). A cast gets no release-notes scratchpad entry.

## Files

- Standalone: `misc/aicasts/<slug>.md`. Series: `misc/aicasts/<series-slug>-<n>-<slug>.md`,
  numbered from 1.
- Kebab-case slugs named for the feature, not a plan number.
- Casts are committed and kept, so later sessions can see what has been covered and answer
  questions about a past cast. Never save one under `docs/`, `.artifacts/`, or `temp/`.
- `misc/aicasts/MISC-AICASTS.md` describes the folder. Do not add a list of casts to it; the
  directory listing and each file's header block are the index.
- When a cast changes, overwrite the file. Git keeps the history.
- Plan sets are deleted after their work lands, so a plan path in **Sources** stops resolving.
  For built work, always list the key code paths too. They keep the cast traceable.

## Template

````markdown
# <Title>

- **Covers:** <one sentence>
- **Status:** Built | Planned | Partly built (<what is built>)
- **Series:** Standalone | <series name>, part <n> of <total>
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
````

## Hosts

- **Claire** leads. She explains the design and the reasons behind each rule.
- **Tom** is learning it. He asks what a new contributor would ask, pushes on edge cases, and
  restates key rules in his own words. He explains a part now and then so the cast does not
  become a lecture.
- Turns run one to five sentences. No turn over about 120 words.

## Shape

1. Opening, one or two turns: what the feature is, and whether it is built or planned.
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
- Follow **llm-safe-plan-vocabulary** and **no-third-party-media-player-style**. Run:

```bash
rg -n -i '\bcandidate|\bdead\b|\bchild' misc/aicasts
```

Word count of a script section:

```bash
sed -n '/^## Script/,$p' misc/aicasts/<file>.md | rg -v '^\(pause\)$|^## ' | sed 's/^[A-Z]*: //' | wc -w
```
