# Add-by-RSS

Add-by-RSS lets users follow RSS feeds (podcasts, music) that are not in the main directory. Feeds are parsed by workers and kept in each device's add-by-RSS library; the account's follow list syncs which feeds a user follows across devices. On mobile, that library is My Library → Add by RSS (chips for podcasts, episodes, artists, albums, and tracks; plus to add). Mobile Home lists those feeds beside directory follows. Home shows no Needs username and password section; feeds still waiting on a username and password stay in the Add by RSS library. Web Subscribed (`/`) does the same with this browser's feeds, and the web library is one page, `/add-by-rss`, with the same chips. CarPlay and Android Auto keep add-by-RSS follows in the native library index.

## Basic Auth (private feeds)

Feeds behind HTTP Basic Auth are supported. **The server never stores the username or password.** Each device keeps them in its own secure storage and sends them only with the requests that need them. The follow row (`account_following_add_by_rss_channel`) carries a `requires_credentials` flag instead, so another device knows to ask the user before it can refresh the feed.

The durable constraints live in [`add-by-rss-client-held-credentials`](/.cursor/rules/add-by-rss-client-held-credentials.mdc).

### Where credentials live

| Surface | Store                                                                                                                                                                         | Scope                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Web     | IndexedDB database `add-by-rss-credentials`, values AES-GCM encrypted with a non-extractable per-account WebCrypto key (`apps/web/src/utils/addByRSS/credentialStore.ts`)     | Account + canonical feed URL |
| Mobile  | SecureStore, with an `add_by_rss_credential_index` table listing which feeds have an entry (`apps/mobile/src/data/repositories/addByRssCredentialStore.ts`)                   | Account + canonical feed URL |
| Server  | Nothing. Postgres keeps `requires_credentials` only; Valkey parse-cache entries keep `failureReason`, `httpStatus`, `authChallenge`, and `credentialsState`, never the secret | —                            |

Signing out (and deleting the account) clears that account's credentials on the device. The feeds themselves stay; they are device data.

A `user:pass@` pasted into a feed URL is split into the username and password fields on the client and again in the API. Stored feed URLs never carry userinfo, and credentials are keyed by the canonical URL (`canonicalAddByRSSFeedUrl` in `@podverse/helpers-validation`).

The Add control stays disabled until the URL is a valid http(s) feed URL. When the username and password toggle is on, it also requires both fields non-empty (`canSubmitAddByRssFeed` in `@podverse/helpers-validation`). The credentials save screen uses the same length rules (`canSubmitAddByRssCredentials`).

### Parse path (transit envelope)

1. The client sends `basic_auth_username` / `basic_auth_password` with `POST /account/add-by-rss/parse`, or `credentials_by_url` with `POST /account/add-by-rss/parse/all`.
2. The API seals them into an AES-256-GCM envelope (`sealAddByRssCredentialsForParse` in `apps/api/src/lib/addByRSSCredentials.ts`, built on `packages/helpers-backend/src/addByRssCredentialsTransit.ts`). The envelope expires after **15 minutes** and its associated data binds it to `accountId | requestId | feedUrl`, so a copied envelope cannot be replayed against another request or feed. The queue message carries only the envelope; its dedupe id excludes it. When the feed is an artist feed, the worker seals the same way for each listed album in scope (see [Artist feeds](#artist-feeds)).
3. The worker opens the envelope in memory, checks the feed URL's scope, and fetches the feed with the Basic Auth header.
4. The parse result records `failureReason` / `credentialsState` for the client: `credentials_required`, `credentials_rejected`, `credentials_withheld_other_domain`, `credentials_withheld_insecure`, or `credentials_envelope_invalid`.

A flagged feed with no credentials in a refresh-all is not queued; it reports `credentials_required`.

**Chapters and transcripts** (`POST /account/add-by-rss/chapters-transcript`): the client sends the credentials together with `feedUrl`; the API applies them only to in-scope URLs and never stores them.

### Artist feeds

An Add by RSS parse whose resource type is `artists` (a publisher feed listing music albums) also resolves every feed the artist lists, for that member only. Nothing it does reaches the public directory: no directory parse, no feed, channel, or follow rows, no verified publisher links.

- **Directory albums** (matched by guid, then feed URL, through `ChannelAddByRSSDirectoryMatchService`) are linked to the directory channel and not fetched.
- **Other albums** are parsed as their own Add by RSS requests. Each gets a `queued` parse entry and its own message on `add-by-rss-background` before the artist entry is written, so every request id the client reads already has an entry. These messages skip broker dedupe, because Add by RSS dedupe keys on the feed URL alone and would drop a second member's album.
- The artist's `parsed` entry carries `publisherListedFeeds`: directory links, album request ids, or why a listed feed was skipped. Each album's entry carries `publisherRequestId`, the artist parse's id. An album message never fans out, even when the album is itself a publisher feed.
- At most 100 listed feeds per artist (`ADD_BY_RSS_PUBLISHER_LISTED_FEEDS_MAX`); the rest are dropped and logged as a count. Feeds named only by item-level references (track credits) are not fetched; they report `item_references_only`.
- A channel-level reference with no feed URL is looked up on Podcast Index by its guid, but only when the artist feed was fetched without credentials, so a private feed's references never leave Podverse. A failed or empty lookup reports `no_feed_url`.
- A `not_modified` artist parse has no body to read and returns no list; the client keeps the list it stored.
- **Credentials** go only to album URLs `resolveCredentialScope` allows from the artist feed's URL. The worker seals a new envelope for each such album, bound to that album's `accountId | requestId | feedUrl`, with the standard 15-minute lifetime. An album out of scope is fetched without credentials and its message carries `credentialsWithheld`, so its entry reports `withheld_other_domain` or `withheld_insecure`, and a private album there lands in Needs username and password.
- A fan-out failure never fails the artist parse: the artist entry is written `parsed` without `publisherListedFeeds`, and the error is logged with the feed host only.

### `requires_credentials`

- The client sets it when a feed is added with credentials.
- The worker sets it when a parse without credentials gets a Basic `401`.
- The worker clears it when a parse without credentials succeeds.
- The worker leaves it set when credentials were sent and rejected (`401` / `403`).

### Scope rules

Every surface uses `resolveCredentialScope` from `@podverse/helpers`:

- Credentials go only to hosts on the feed's registrable domain (eTLD+1 via `tldts`, private suffixes included). Subdomains are in scope; a different registrable domain is not.
- IP addresses and `localhost` must match the feed's host exactly.
- HTTPS only. Local development (`NODE_ENV=development`) and E2E fixtures (`PODVERSE_E2E_FIXTURES=1`) allow plain HTTP on the API and workers; mobile uses `EXPO_PUBLIC_MOBILE_ADD_BY_RSS_ALLOW_INSECURE_CREDENTIALS=1` or its E2E build.
- **Redirects:** the `Authorization` header is dropped on the first hop that leaves the scope or downgrades to HTTP, and stays dropped.
- Media on a different registrable domain from the feed is **out of scope** on every surface: it is requested without credentials, and a failure is logged with the withheld reason.

### Media, downloads, and artwork

- **Web:** always requests the plain enclosure URL. A media element cannot attach Basic Auth, and there is **no media proxy**. When a flagged feed's media fails, the player explains why (`add_by_rss.media_needs_credentials`, or `add_by_rss.media_other_domain` when the host is out of scope) and points to the mobile app. The console log carries hosts only.
- **Mobile playback:** the native engine answers an HTTP Basic **challenge** only from an in-scope host (iOS `AVAssetResourceLoaderDelegate`, Android OkHttp `Authenticator`); nothing is sent before a challenge, so a redirect elsewhere never receives the credential. A `401` / `403` is logged as `add_by_rss_credentials_required`, `add_by_rss_credentials_rejected`, `playback_credentials_withheld_other_domain`, or `playback_credentials_withheld_insecure`, with a `basic_auth` detail. See [the media engine README](/apps/mobile/modules/podverse-media-engine/README.md#protected-media-sourcebasicauth).
- **Mobile downloads and artwork:** Android sends the header up front to in-scope URLs; OkHttp drops it on any redirect that changes host, port, or scheme. iOS withholds it, because its download and image stacks give no redirect guarantee; a protected download there fails with `credentials_withheld`.
- Car surfaces (CarPlay, Android Auto) play from the native cache, which carries no credentials.

### Feeds that need credentials on this device

A followed feed that has `requires_credentials` and no stored credentials on this device (or whose stored credentials were last rejected) appears as a **partial row** in a **Needs username and password** section at the end of the Add by RSS library list (mobile Library → Add by RSS, and the web Add by RSS page, `/add-by-rss`). Home does not include that section. Its subtitle says whether credentials are missing or were rejected. The row opens a credentials screen (web `/add-by-rss/credentials/<idText>` or channel Settings; mobile `AddByRssCredentials`) that explains the credentials stay on this device, saves them, and checks the feed right away.

### Environment

`ADD_BY_RSS_CREDENTIALS_ENCRYPTION_KEY` (64 hex characters, 32 bytes; `openssl rand -hex 32`) is required in the API and workers and must match. It is a **transit** key: it seals and opens queue envelopes, and nothing is encrypted at rest with it. Do not reuse the JWT secret; a dedicated key rotates independently of auth.

**Rotation:** deploy the new key as `ADD_BY_RSS_CREDENTIALS_ENCRYPTION_KEY` with the previous one as `ADD_BY_RSS_CREDENTIALS_ENCRYPTION_KEY_OLD` (workers try it after the current key fails), wait at least 15 minutes for in-flight envelopes to expire, then remove `_OLD`. No data migration is involved.

- [apps/api/ENV.md](/apps/api/ENV.md) – API
- [apps/workers/ENV.md](/apps/workers/ENV.md) – Workers (`mqAddByRSSRunParser`)
- [apps/mobile/.env.example](/apps/mobile/.env.example) – mobile allow-insecure flag

### Logging

Usernames, passwords, `Authorization` headers, and envelopes never appear in API responses, parse-status payloads, logs, or unencrypted queue bodies. `redactForLog` in `packages/helpers-backend/src/redactForLog.ts` masks the credential fields; extend it before logging anything that could carry a request body.

### Testing

- **Fixtures:** `tools/test-assets` serves a gated feed, a gated feed with public media, a gated feed with media on another host, a cross-host redirect, and an `Authorization` probe. See [TOOLS-TEST-ASSETS.md § Credential fixtures](/tools/test-assets/TOOLS-TEST-ASSETS.md#credential-fixtures) and `tools/test-assets/scripts/verify-basic-auth.sh`.
- **Web E2E:** `apps/web/e2e/add-by-rss-credentials-*.spec.ts` (add, partial row, rejected, media message). The web E2E stack has no broker, so parse outcomes are stubbed.
- **Mobile E2E:** `apps/mobile/e2e/add-by-rss-credentials.yaml` (add with credentials, sign out,
  partial row, re-enter, play). `apps/mobile/e2e/add-by-rss-episode-sections.yaml` (an item's
  Chapters and Transcript on the episode page and in the full player).
  `apps/mobile/e2e/add-by-rss-track.yaml` (a music feed's track page and Lyrics).
- **API:** `apps/api/src/test/add-by-rss-parse-credentials.test.ts`.
