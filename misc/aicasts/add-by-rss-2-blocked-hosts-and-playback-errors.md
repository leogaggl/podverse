# Add by RSS 2: When a Host Blocks the Browser

- **Version:** 2026-10-20T09:36-05:00
- **Episode ID:** add-by-rss-blocked-hosts-and-playback-errors
- **Changed:** First version.
- **Description:** How the website finds the final address for media that a host blocks at a
  redirect, without relaying any audio, and how the web player explains a file it still cannot
  play instead of failing silently.
- **Status:** Built
- **Group:** Add by RSS, part 2
- **Sources:** `.llm/plans/completed/add-by-rss-cross-device/`;
  `apps/web/src/app/api/resolve-media-url/route.ts`,
  `apps/web/src/utils/media/resolveMediaRedirect.ts`,
  `apps/web/src/utils/media/resolveMediaUrl.ts`,
  `apps/web/src/utils/media/blockedHostPlayback.ts`,
  `apps/web/src/utils/media/playbackErrorCopy.ts`,
  `apps/web/src/components/MediaPlayer/Modal/PlaybackErrorModal.tsx`,
  `packages/ui/src/components/image/ImageRuntime/ImageRuntime.tsx`,
  `packages/ui/src/components/image/Image/Image.tsx`
- **Length:** about 9 minutes (1,372 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse". **Muse AI** "MYOOZ A-I". Spell out **RSS**, **URL**,
  **HTTP**, and **CDN** letter by letter. Say "four-oh-four" for 404, "four-ten" for 410,
  "four-oh-five" for 405, and "five-oh-one" for 501.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part two of Add by RSS. Part one covered how the phone and the website agree on one episode. This part covers what the website does when a host won't let a browser load the media, and how the web player explains a file it can't play. It's built.

TOM: What did people run into?

CLAIRE: A feed from one host, Muse AI, played fine on the phone. On the website, the artwork didn't load, and pressing play did nothing anyone could see. No message, no error. The player just sat there.

(pause)

TOM: Why would the phone work and the website not?

CLAIRE: Every artwork and audio URL from that host answers with a redirect. That redirect carries a header called Cross-Origin Resource Policy, set to same origin. Browsers enforce that header on images and audio requested from any other site. So the image fails, and the audio fails with media error four. Native players ignore the header, and so does our server.

TOM: Where does the redirect go?

CLAIRE: To a CDN URL that allows cross-origin loads. That final URL loads directly and plays fine. It's also signed, and it expires in about thirty-six hours.

TOM: So the block is only on the middle step.

CLAIRE: Exactly. And that shapes the whole design.

(pause)

TOM: What rules does the fix follow?

CLAIRE: Four. First, no audio relay. Media bytes never pass through Podverse servers. The server only finds the final address. Second, credentials stay on the device. The lookup never receives or forwards a username or password. Third, a file that still can't play stays loaded and says why. No toast, and the queue doesn't skip ahead. Fourth, the error experience matches the phone, which already had a dialog for this.

TOM: Why not just relay the audio? That would always work.

CLAIRE: It would put every byte of someone else's audio through our servers, at our cost, and it would hide the host from the browser. Relaying is out of scope. It comes back only if a host also blocks browsers at the final CDN step.

(pause)

TOM: So how does the website find the final address?

CLAIRE: A new server route on the website, called resolve media URL. You give it a URL. It follows the redirect chain itself and answers with the final URL and a reason. It never returns media.

TOM: A server that fetches any URL you hand it sounds risky.

CLAIRE: It is, so every step is checked before it's requested, the first one included. The check covers the URL's format and resolves the host name, rejecting addresses that aren't public. That's protection against server-side request forgery, on every hop. A URL with a username or password in it is refused. The route uses the same rate limit as the existing image proxy.

TOM: How does it walk the chain?

CLAIRE: It sends a HEAD request and doesn't let the fetch follow redirects on its own. If a host answers four-oh-five or five-oh-one to HEAD, it tries that step once more as a GET for just the first byte. A redirect gives it the next address, which gets checked again. It stops after five redirects.

TOM: And what can it answer?

CLAIRE: Resolved, with the final URL, when the final response succeeds, its policy header is missing or allows cross-origin, and the URL is different from the one you sent. Same URL, when there was no redirect, so resolving can't help. Blocked at the final step, when the last response says same origin or same site. HTTP error, with the status. Too many redirects. Invalid, when a check failed. And network, for a timeout or a dropped connection.

TOM: Does it remember answers?

CLAIRE: The response is cached privately for ten minutes. The browser side also remembers each answer for ten minutes and shares one request when two callers ask about the same URL at once. And when it logs a failure, it logs only the host name, never the full address, because signed URLs carry tokens.

(pause)

TOM: When does the player call it?

CLAIRE: After a failure that looks like a blocked host: media error four, or a play call rejected as not supported. Only for a plain web address with no credentials, never for an Add by RSS feed that has stored credentials, and only once per loaded item.

TOM: And if it resolves?

CLAIRE: The player switches the media element to the final URL, keeping the position and whether it was playing. The resolved URL is never written into resource data or sent to the server, since it's signed and expires. If that load fails too, the player shows the error.

TOM: If it doesn't resolve?

CLAIRE: The reason picks the message. Blocked at the final step means host blocked. A four-oh-four or four-ten means file not found. Any other HTTP error means a host error, with its status. Anything else falls back to host blocked.

TOM: And the artwork?

CLAIRE: The shared image components can't import website code, so the image runtime provider takes an optional resolver, and the website passes one in. When a remote image fails and the browser loaded it directly, the component asks once and tries the returned URL. Then it continues its normal fallbacks, ending at the placeholder.

TOM: Why only when the browser loaded it directly?

CLAIRE: The image proxy and image optimization fetch on the server, where the policy header doesn't apply. Resolving those would be wasted work. And the placeholder itself is never resolved.

TOM: Speaking of the placeholder, I heard it moved.

CLAIRE: It was off-center wherever a caller's style changed how the wrapper displayed, which responsive layouts do. Centering now lives on an inner element callers can't reach. The player draws the placeholder at the same eighty percent scale as lists.

(pause)

TOM: Now the error itself. What does someone see?

CLAIRE: This applies to all web playback, not only Add by RSS. The failed item stays loaded. On the mini player and the full player, the play button becomes an error icon, the same size, so nothing shifts. Its accessible name is Playback Error.

TOM: And pressing it?

CLAIRE: A dialog titled Playback Error. A sentence that explains the reason. For a blocked host it says, "This media's host does not allow playback on websites. It may still play in the Podverse app." Then a details line with the reason and code. Then the buttons: Cancel, Open Media Link, and Try Again.

TOM: What does each do?

CLAIRE: Try Again clears the error, reloads the source at the last position, and plays. It also forgets the earlier lookup, so the address can be resolved again. Open Media Link opens the file in a new tab, and appears only for a plain web address with no credentials. Cancel closes the dialog, and the error icon stays. The error is also announced once to screen readers, title and then reason.

TOM: Which failures count as errors?

CLAIRE: Media error two is network. Three is decode. Four starts as host blocked, and the lookup refines it. A play call blocked by the browser's autoplay policy isn't an error; the normal play button stays. A play call that was superseded is ignored. An item with no audio URL is an invalid source. For a password-protected Add by RSS feed, the credentials check runs first and its answer wins. It shows in this same error state, not as a toast.

TOM: When does the error go away?

CLAIRE: When a different item loads, when Try Again starts, or when the audio actually starts playing. An error never advances the queue and never loads another item.

TOM: Does the phone change?

CLAIRE: No. The playback error text moved to the shared catalog, so the website and the phone read the same words. The phone's dialog already covered its cases.

(pause)

TOM: To remember. One: some hosts block browsers at a redirect while the final file allows them. Two: the website asks a server route for the final address, and no media passes through Podverse. Three: that route checks every hop, refuses credentials, stops at five redirects, and logs only the host. Four: the player and the image components ask once per failure, and never store the resolved URL. Five: a file that can't play stays loaded, with an error icon and a dialog offering Try Again.

CLAIRE: The website finds a way around a blocked step when it can, and says so plainly when it can't.
