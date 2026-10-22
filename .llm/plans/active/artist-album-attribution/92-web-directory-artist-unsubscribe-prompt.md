**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 92 — Web: ask about albums when unsubscribing from a directory artist

On `/artist/:id`, pressing Unsubscribe while the member follows at least one of the artist's
verified albums opens a dialog: "Unsubscribe from [Artist]?", "You also follow N albums by this
artist.", and Cancel, Artist Only, Artist and Albums. With no followed verified album, Unsubscribe
works as today with no dialog. This plan also adds the dialog component plan 93 reuses on the
Add by RSS artist header.

## Rows

R8, R55, R57, R58

## Runs after

11, 30, 90, 91

Plan 11 makes `channelsAdded` (the page's `ssrChannelsAdded`) the verified albums. Plan 30 edits
`ArtistPageClient.tsx`.

## Files

apps/web/src/lib/artistUnsubscribe.ts
apps/web/src/lib/artistUnsubscribe.test.ts
apps/web/src/components/Media/Header/UnsubscribeArtistModal.tsx
apps/web/src/components/Media/Header/SubscribeButton.tsx
apps/web/src/components/Media/Header/HeaderButtons.tsx
apps/web/src/components/Core/Artist/CoreArtistHeaderButtons.tsx
apps/web/src/components/Core/Artist/CoreArtistHeaderViewDesktop.tsx
apps/web/src/components/Core/Artist/CoreArtistHeaderViewTablet.tsx
apps/web/src/components/Core/Artist/CoreArtistHeader.tsx
apps/web/src/app/artist/[channel_id]/ArtistPageClient.tsx
release-notes/scratchpad.md

## Reuses

- `Modal`, `Modal.Body`, `Modal.Actions`, and `Button` from `@podverse/ui`, laid out as
  `apps/web/src/components/MediaPlayer/Modal/PlaybackErrorModal.tsx` does (**modal-layout-contract**).
- `reqAccountUnfollowChannel` (Artist Only) and plan 90's `reqAccountUnfollowBulk`
  (Artist and Albums) on `getApiRequestService()`, both returning the refreshed `DTOAccount`.
- Plan 91's keys `features.unsubscribe_artist.*` and `misc.cancel`, `misc.close_modal`.
- The SSR verified albums already on the page (`ssrChannelsAdded`). No new request.

## Decisions this plan fixes

- **The verified albums reach the button as a prop**, threaded
  `ArtistPageClient → CoreArtistHeader → CoreArtistHeaderViewDesktop / Tablet → CoreArtistHeaderButtons → HeaderButtons → SubscribeButton`
  as optional `artistAlbums?: readonly DTOChannel[]`. A context was the other choice; the prop is
  six small edits and keeps `SubscribeButton` readable on its own. Podcast and album headers pass
  nothing and behave as today.
- **"Followed" is the account's follow list:** an album counts when its numeric `id` is in
  `loggedInAccount.account_following_channels`. The page's own Your Add by RSS Albums (plan 75)
  do not count: a directory artist's albums are its verified albums (R57).
- **Button order** in `Modal.Actions`: Cancel (`secondary`), Artist Only (`secondary`), Artist
  and Albums (primary, the default variant). Secondary before primary, per the contract.
- **The dialog stays open while the request runs.** All three buttons are disabled and the
  pressed one shows `isLoading`. It closes on success. On a membership gate error the dialog closes
  and `tryHandleMembershipGateError` runs, as today; any other error closes it and rethrows, as
  today.
- Escape, the close button, and the backdrop are Cancel.

## `apps/web/src/lib/artistUnsubscribe.ts` (new, pure)

```typescript
import type { DTOChannel } from '@podverse/helpers';

/** Which body sentence the unsubscribe-from-artist dialog shows for `count` followed albums. */
export const unsubscribeArtistBodyKey = (
  count: number
): 'unsubscribe_artist.followed_one_album' | 'unsubscribe_artist.followed_albums' =>
  count === 1 ? 'unsubscribe_artist.followed_one_album' : 'unsubscribe_artist.followed_albums';

/**
 * The artist's verified albums the member follows, as `id_text`s in album order, each once.
 * Never the artist itself, never an album with an empty `id_text`.
 */
export const followedDirectoryArtistAlbumIdTexts = (input: {
  artistIdText: string;
  albums: readonly Pick<DTOChannel, 'id' | 'id_text'>[];
  followingChannelIds: ReadonlySet<number>;
}): string[] => …;
```

Keys are relative to the `features` namespace (`useTranslations('features')`). If next-intl's
key typing rejects the union return type, type the return as the two literal keys the component
passes to `tFeatures` directly; do not cast.

## `UnsubscribeArtistModal.tsx` (new)

```typescript
type UnsubscribeArtistModalProps = {
  albumCount: number;
  artistTitle: string;
  /** Which action is running; null when idle. */
  busyAction: 'artist_only' | 'artist_and_albums' | null;
  isOpen: boolean;
  onArtistAndAlbums: () => void;
  onArtistOnly: () => void;
  onCancel: () => void;
};

export const UnsubscribeArtistModal: React.FC<UnsubscribeArtistModalProps> = …;
```

- `title = tFeatures('unsubscribe_artist.title', { artist: artistTitle })`.
- `<Modal isOpen={isOpen} onClose={onCancel} closeButtonAriaLabel={tMisc('close_modal')} header={title} ariaLabel={title}>`.
- `<Modal.Body><p>{tFeatures(unsubscribeArtistBodyKey(albumCount), { count: albumCount })}</p></Modal.Body>`.
- `Modal.Actions`: Cancel (`variant="secondary"`, `onClick={onCancel}`, `disabled` while busy),
  Artist Only (`variant="secondary"`, `isLoading={busyAction === 'artist_only'}`, `disabled`
  while the other runs), Artist and Albums (`isLoading={busyAction === 'artist_and_albums'}`,
  `disabled` while the other runs).
- `'use client'`. No SCSS file.

## `SubscribeButton.tsx`

- Props gain `artistAlbums?: readonly DTOChannel[]`.
- At the top of the component (hooks run before any branch):
  `const [artistPromptAlbumIdTexts, setArtistPromptAlbumIdTexts] = useState<string[] | null>(null);`
  and `const [artistPromptBusy, setArtistPromptBusy] = useState<'artist_only' | 'artist_and_albums' | null>(null);`.
- In the channel branch, `toggleSubscribe` when `isSubscribed && kind === 'artist'`: compute
  `followedDirectoryArtistAlbumIdTexts({ artistIdText: channel.id_text, albums: artistAlbums ?? [], followingChannelIds: new Set(loggedInAccount.account_following_channels?.map((row) => row.channel_id) ?? []) })`.
  Non-empty → `setArtistPromptAlbumIdTexts(result)` and return. Empty → today's unfollow.
- `runArtistUnsubscribe(action)`: sets busy; Artist Only calls
  `reqAccountUnfollowChannel({ channel_id_text: channel.id_text })`; Artist and Albums calls
  `reqAccountUnfollowBulk({ channel_id_texts: [channel.id_text, ...artistPromptAlbumIdTexts] })`;
  then `await setLoggedInAccount(updatedAccount)`. `finally` clears busy and the prompt. The
  `catch` is today's (`tryHandleMembershipGateError`, else rethrow).
- Render the button as today, followed by
  `<UnsubscribeArtistModal isOpen={artistPromptAlbumIdTexts !== null} albumCount={artistPromptAlbumIdTexts?.length ?? 0} artistTitle={channel.title ?? ''} … />`
  inside a fragment. Only the channel branch renders the modal.
- The `entity as DTOChannel` line stays as it is; this plan adds no new assertion.

## Header chain

- `HeaderButtons.tsx`: props gain `artistAlbums?: readonly DTOChannel[]`; pass it to
  `<SubscribeButton entity={channel} kind={kind} artistAlbums={artistAlbums} />`.
- `CoreArtistHeaderButtons.tsx`, `CoreArtistHeaderViewDesktop.tsx`,
  `CoreArtistHeaderViewTablet.tsx`, `CoreArtistHeader.tsx`: each gains the same optional prop and
  passes it down.
- `ArtistPageClient.tsx`: `<CoreArtistHeader channel={ssrChannel} artistAlbums={ssrChannelsAdded} />`.

## Must stay true

- Podcast, album, playlist, and profile subscribe buttons behave exactly as today.
- Signed out, Unsubscribe never shows (the button reads Subscribe and opens the login modal).
- No new request when the page loads or when Unsubscribe is pressed with no followed album.
- No `as` added, no `any`, strict equality. Named exports only.

## Tests

`apps/web/src/lib/artistUnsubscribe.test.ts` (new). One `it` each:

- Two verified albums, one followed: returns that one's `id_text`.
- Order follows the albums array; a duplicate `id_text` appears once.
- The artist's own id and an album with an empty `id_text` are skipped.
- Nothing followed: `[]`.
- `unsubscribeArtistBodyKey(1)` and `(3)` return the two keys.

Plan 96 adds the Playwright spec.

## Release scratchpad

```markdown
## Web asks about albums when you unsubscribe from an artist

- Surfaces: web
- Change: on a directory artist page, Unsubscribe opens "Unsubscribe from [Artist]?" when you
  follow at least one of the artist's verified albums. The dialog says how many, and offers
  Cancel, Artist Only (today's behavior), and Artist and Albums (one request ends the artist and
  those album follows). With no followed album, Unsubscribe works as before with no dialog.
- Who notices: signed-in members who follow an artist and its albums
- Operator steps: none
```
