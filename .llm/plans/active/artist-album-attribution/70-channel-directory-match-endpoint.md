**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 70 — Public read: which directory channel a feed guid is

The player line and track byline for an Add by RSS album fall back to a directory artist when no
Add by RSS artist on the device lists or is named by the album (R50). The album's
`<podcast:publisher>` pointer gives a guid and maybe a feed URL; the client needs that directory
channel's `id_text`, title, and medium to link it. No public endpoint resolves a guid today
(`GET /channel/podcast-index/:id` takes a Podcast Index id). This plan adds one read that reuses
plan 21's lookup, so the visibility rules stay in one place.

The request carries only a guid and URL the member's own feed already published. The endpoint
reads public directory rows and writes nothing (R40). Mobile (area I) can call the same helper.

## Rows

R40, R50

## Runs after

10, 21

Plan 21 adds `ChannelAddByRSSDirectoryMatchService.getForListedFeeds`. Plan 10 sets the pattern
for channel DTO files under `packages/helpers/src/dtos/channel/`.

## Files

packages/helpers/src/dtos/channel/channelDirectoryMatch.ts
packages/helpers/src/dtos/index.ts
apps/api/src/controllers/channel.ts
apps/api/src/routes/channel.ts
apps/api/openapi.yml
apps/api/src/test/channel-directory-match.test.ts
packages/helpers-requests/src/api/channel/channel.ts
packages/helpers-requests/src/api/_request.ts
release-notes/scratchpad.md

## Reuses

- `ChannelAddByRSSDirectoryMatchService` from `@podverse/orm` (plan 21). It already filters to
  parsed, publicly visible, active channels, skips non-UUID guids before SQL, and falls back to a
  feed URL match when the channel has no guid or the same guid. Do not write a second query.
- `validateQueryObject` and `handleGenericErrorResponse`, as the other handlers in
  `apps/api/src/controllers/channel.ts` use them.
- The `reqChannelGetByPodcastIndexId` pair in `packages/helpers-requests` as the shape for the new
  request function and its `ApiRequestService` method.

## `packages/helpers/src/dtos/channel/channelDirectoryMatch.ts` (new)

```typescript
/** A directory channel a feed guid (or feed URL) resolves to. Public directory data only. */
export interface DTOChannelDirectoryMatch {
  id_text: string;
  title: string | null;
  medium_id: number | null;
}
```

Export from `packages/helpers/src/dtos/index.ts` beside `./channel/channelRemoteItem.js`:
`export * from './channel/channelDirectoryMatch.js';`. Plan 10 adds `./channel/verifiedPublisher.js`
in the same block; keep it.

## API

### Route (`apps/api/src/routes/channel.ts`)

Add `router.get('/directory-match', asyncHandler(ChannelController.getDirectoryMatch));` directly
after the `/podcast-index/:podcast_index_id` line. It must sit above `'/:idOrIdText'`, or that
route swallows it.

### Handler (`ChannelController.getDirectoryMatch`)

Public, like `getbyPodcastIndexId`. Query schema:

```typescript
const directoryMatchQuerySchema = {
  feed_guid: Joi.string().trim().min(1).max(255).required(),
  feed_url: Joi.string().trim().uri({ scheme: ['http', 'https'] }).max(2048).optional(),
};
```

Inside `validateQueryObject(Joi.object(directoryMatchQuerySchema), req, res, async () => { … })`:

1. Read `feed_guid` and `feed_url` from `req.query` with `typeof … === 'string'` checks (no `as`).
2. `const matches = await new ChannelAddByRSSDirectoryMatchService().getForListedFeeds([{ feedGuid, feedUrl: feedUrl ?? null }]);`
   Hold the service in a `private static` field the way the controller holds `channelService`.
3. `const match = matches.get(feedGuid.trim().toLowerCase()) ?? null;`
4. `res.json(match === null ? null : { id_text: match.channelIdText, title: match.title, medium_id: match.mediumId })`
   typed as `DTOChannelDirectoryMatch | null` (`import type` from `@podverse/helpers`).

Errors go to `handleGenericErrorResponse`. Do not 404 on no match: `null` with 200, the same
contract as `/channel/podcast-index/:id`, so a client can tell "not in the directory" from a
failure.

### OpenAPI (`apps/api/openapi.yml`)

Add `/channel/directory-match` directly after the `/channel/podcast-index/{podcast_index_id}`
block, copying its shape: `operationId: apiGetChannelDirectoryMatch`, tag `channel`,
`security: []`, query parameters `feed_guid` (required string) and `feed_url` (optional string),
the same error responses. Add `ApiGetChannelDirectoryMatchResponse200` under
`components/schemas` beside `ApiGetChannelPodcastIndexPodcastIndexIdResponse200`: `nullable: true`
object with `id_text` (string), `title` (string, nullable), `medium_id` (integer, nullable), all
required. Description: "Public endpoint returning the directory channel a feed guid (or feed
URL) resolves to, or null. Reads public directory data only."

## `packages/helpers-requests`

In `api/channel/channel.ts`, after `reqChannelGetByPodcastIndexId`:

```typescript
export async function reqChannelGetDirectoryMatch(
  api: ApiRequestService,
  params: { feed_guid: string; feed_url?: string | null }
) {
  // API returns the match or `null` when the guid is not a directory channel.
  return api.apiRequest<DTOChannelDirectoryMatch | null>({
    path: '/channel/directory-match',
    method: 'GET',
    config: {
      params: {
        feed_guid: params.feed_guid,
        ...(params.feed_url ? { feed_url: params.feed_url } : {}),
      },
    },
  });
}
```

Add `DTOChannelDirectoryMatch` to the file's `import type` from `@podverse/helpers`. In
`_request.ts`, import it in the channel import block and add the method after
`reqChannelGetByPodcastIndexId`:

```typescript
  reqChannelGetDirectoryMatch(params: { feed_guid: string; feed_url?: string | null }) {
    return reqChannelGetDirectoryMatch(this, params);
  }
```

## Must stay true

- The endpoint never writes, never follows, and never creates a directory row.
- A hidden, unparsed, archived, or merged channel never matches (plan 21's rules, unchanged).
- A non-UUID `feed_guid` returns `null` (via the URL fallback or no match), never a 500.
- No `as`, no `any`, strict equality.

## Tests

`apps/api/src/test/channel-directory-match.test.ts` (new). Follow plan 23's mocking: `vi.mock('@podverse/orm', async (importOriginal) => …)` keeping the actual module and replacing
`ChannelAddByRSSDirectoryMatchService` with a class whose `getForListedFeeds` records its argument
and returns a map with `'11111111-2222-4333-8444-555555555502'` →
`{ channelIdText: 'e2eMusicChnl01', title: 'E2E Music Artist', mediumId: 12 }` (use
`MediumEnum.PublisherMusic` from `@podverse/helpers`, not the literal). `startTestApp` from
`./helpers/index.js`; no auth. One `it` each:

- `GET /channel/directory-match?feed_guid=11111111-2222-4333-8444-555555555502` returns 200 with
  `{ id_text: 'e2eMusicChnl01', title: 'E2E Music Artist', medium_id: MediumEnum.PublisherMusic }`.
- An upper-case guid returns the same match (the lookup key is lowercased).
- `feed_url` reaches the service as `feedUrl`; omitted, the service gets `feedUrl: null`.
- A guid the service does not know returns 200 with `null`.
- No `feed_guid` returns 400.
- `/channel/directory-match` does not reach `getByIdOrIdText` (the route order): the response is
  the mocked match, not a 404 for a channel named `directory-match`.

## Release scratchpad

```markdown
## Public read for a directory channel by feed guid

- Surfaces: api, helpers-requests
- Change: `GET /channel/directory-match?feed_guid=…&feed_url=…` returns `{ id_text, title,
  medium_id }` for the parsed, publicly visible directory channel with that podcast guid (or, for
  a channel with no guid, that feed URL), else `null`. Reads only. The web and mobile players use
  it to link an Add by RSS album to its directory artist.
- Who notices: API consumers; members whose Add by RSS albums name a directory artist
- Operator steps: none
```
