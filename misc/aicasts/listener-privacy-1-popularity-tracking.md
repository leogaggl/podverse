# Listener Privacy 1: What Popularity Tracking Counts

- **Version:** 2026-10-20T09:36-05:00
- **Episode ID:** listener-privacy-popularity-tracking
- **Changed:** First version.
- **Description:** What Popularity Tracking records when a listener turns it on, what it never
  records, how long it keeps rows, and how the version check decides when to ask again. Also how
  the explanation and the terms of service split the job.
- **Status:** Built
- **Group:** Listener Privacy, part 1
- **Sources:** `.llm/plans/completed/popularity-tracking-how-it-works/`;
  `apps/api/legal/popularity-tracking/en-US.md`, `apps/api/legal/terms/en-US.md`,
  `apps/api/src/lib/legal/popularityTrackingContent.ts`, `apps/api/src/lib/legal/listenStats.ts`,
  `apps/api/src/routes/stats.ts`, `packages/helpers/src/lib/popularityTracking.ts`,
  `packages/helpers/src/lib/accountTrust.ts`, `apps/web/src/utils/statsTracking/statsTracking.ts`,
  `apps/mobile/src/data/repositories/statsRepository.ts`
- **Length:** about 8 minutes (1,152 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse". Say "four-oh-three" for 403. Say **id** as the word
  "id", rhyming with "kid".
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part one of Listener Privacy. It covers Popularity Tracking, the optional feature that counts listeners for the public popularity lists. What it records hasn't changed. What changed is how Podverse explains it, so the words now match the code. It's built.

TOM: What was wrong with the old words?

CLAIRE: Two things. The choice screen read like a legal agreement. And the terms called the records pseudonymous, without saying the parts that matter. The company can connect the random id back to the account. Calling that anonymous is the gap. The terms also didn't say that a second play doesn't count twice, that the website records a few extra things, or that public counts stay after rows are deleted.

TOM: Who does that hurt?

CLAIRE: The listener deciding whether to say yes. They should know what they're agreeing to, in plain words.

(pause)

TOM: What rules does it hold to now?

CLAIRE: First, the choice screen explains a feature. It isn't a legal agreement, a policy, or a consent form. The legal notice lives in the terms of service. Second, never say anonymous or anonymized. Third, it's opt-in. Tracking runs only when the account said yes to the current version. Fourth, a no sticks. A later version never asks again.

TOM: Anything contributors must not touch?

CLAIRE: The stored field names, like the listen stats agreement version. Phones keep account snapshots on disk, so renaming a field rewrites data already stored on devices. The names stay, even though the screen says Popularity Tracking.

(pause)

TOM: Walk me through a listen.

CLAIRE: Someone plays an episode from the catalog. The app sends a stats event for the episode or track, for the clip when it was a clip, and for the show it belongs to. That's on the website and on the phone.

TOM: Anything only one surface sends?

CLAIRE: The website sends two more: opening someone else's profile, and opening a playlist. Opening your own profile isn't recorded. The phone doesn't send those two.

TOM: What does the server check?

CLAIRE: The stats routes require a signed-in account, so signed-out listening isn't counted as a listener. The account needs a current membership, and its entitlements must allow tracking stats. Trial and Premium each have a default for that, set per deployment, and one account can carry its own override. Then the opt-in check: the account said yes, and the version it said yes to equals the server's current version. If not, the route answers four-oh-three and nothing is written.

TOM: And what's in a row?

CLAIRE: A random id for the account, the thing that was played or opened, and the time. Not the person's name, email, or username. That random id isn't shown on their public profile.

TOM: But it's linked.

CLAIRE: Yes. The random id is stored next to the account id. That's how turning the feature off, and deleting the account, can apply to that person. It's also why it isn't anonymous. The company doesn't give the id to anyone else, doesn't sell the rows, and doesn't use them to advertise to the listener.

TOM: Play the same episode twice?

CLAIRE: One row per account per thing, while that row exists. Playing it again doesn't add another. After the row is deleted, a later play can record it again.

(pause)

TOM: How long are rows kept?

CLAIRE: Raw rows are deleted after a retention period. It's a server setting, and the default is thirty days. Public lists can keep the counts after a row is gone. Those counts are numbers, not a list of listeners.

TOM: And deleting an account?

CLAIRE: Deletes the random id and every row tied to it. The database cascades from the account, to the random id, to the event tables.

TOM: Does the explanation say thirty?

CLAIRE: It says whatever the server is set to. The text holds a placeholder for the retention days, and the server fills it with the configured number, or the default when the setting isn't a positive whole number. The brand name is a placeholder too.

(pause)

TOM: What does a listener see?

CLAIRE: A short block above two buttons, Yes, Track Me, and No Thanks. It says the feature is optional, that it helps listeners find shows and helps creators see their work reaching people, and that their name isn't part of the count. The rest opens under How It Works. Below that is View Terms of Service.

TOM: Where does that text come from?

CLAIRE: The server, for signed-in accounts, so the explanation can change without an app release. It's written in English, Spanish, French, and Greek.

TOM: And to change their mind?

CLAIRE: Settings. Turning it off stops new rows. Rows already stored are deleted when they reach the retention age.

(pause)

TOM: Now versions. You said a no sticks. What about a yes?

CLAIRE: There are two separate version ids. One for Popularity Tracking, one for the terms. If the Popularity Tracking version is bumped, everyone who said yes is turned off until they confirm again. The screen says, "How Popularity Tracking works has changed. It stays off until you turn it on again." People who said no aren't asked.

TOM: When should someone bump it?

CLAIRE: Only when what's recorded, how long it's kept, or who can see it changes. This rewrite changed words, not behavior, so it didn't bump either version.

TOM: And the terms version?

CLAIRE: Bumping that blocks the app until every account accepts again. So it's a bigger hammer. Counsel reviews the terms before any bump.

(pause)

TOM: What do the terms say now?

CLAIRE: A Popularity Tracking section. It's off until you turn it on, and turning it off doesn't limit playback, the account, or a membership. It states what a record holds, that the company can connect the id back to the account, the one-row rule, the website's extra events, that signed-out listening isn't recorded this way, the retention period, that published counts can remain, and that deleting the account deletes the id and the rows.

TOM: Can someone ask for their data?

CLAIRE: Yes. They can email to ask for a copy, a correction, or deletion sooner. If the company refuses, replying to that email asks for another review.

TOM: Which law applies?

CLAIRE: The terms say the company operates from the United States, and that the laws of the state where it's organized apply, with federal law. The text doesn't name a state. The legal name and address are placeholders, so a move doesn't need a terms rewrite.

(pause)

TOM: To remember. One: Popularity Tracking is opt-in, a no sticks, and the explanation isn't the legal notice. Two: a row holds a random id, the thing, and the time, and the company can connect that id to the account, so never call it anonymous. Three: one row per account per thing, and the website also records profile and playlist opens. Four: rows are deleted after the retention period, thirty days by default, while public counts remain. Five: bump the Popularity Tracking version only when what's recorded, kept, or shown changes, because a bump turns everyone's yes off.

CLAIRE: Say what's counted, plainly, and let the listener decide.
