# Deferred: Chapter artwork on private Add by RSS feeds

This placeholder is saved for later planning. Nothing here is scheduled, and no code has changed.
It came out of the `add-by-rss-parity` set (row R66), where the operator chose to defer it.

## The gap

Once `add-by-rss-parity` lands, Add by RSS episodes show chapters on the episode page (plans 35 and 36) and in the full player (plan 93). Each chapter can carry an image (`img`). On a feed that needs
a username and password, those chapter images load without the feed's credentials. When the image
host requires them, the chapter row and the player show the fallback artwork instead of the
chapter image.

## Why it waits

The behavior follows a deliberate rule, **add-by-rss-client-held-credentials**:

- Credentials go only to hosts inside the feed's credential scope (`resolveCredentialScope`): the
  feed's registrable domain, HTTPS, re-checked on every redirect.
- Mobile withholds credentials on iOS artwork loads (`withheld_unverified_platform`), because that
  stack's redirect handling is not verified to drop the header on a host change.
- Web never proxies media or artwork to attach Basic Auth.

Fixing the gap means changing one of those decisions, so it is a product and security decision
first and an implementation second.

## Questions to settle before planning

1. **Which surfaces?** Mobile only, or web as well? Web would need either a proxy (ruled out
   today) or an in-browser authenticated fetch turned into an object URL.
2. **Which hosts?** Only images inside the feed's credential scope, or never other domains (the
   rule today)?
3. **iOS artwork stack.** Verify that the image loader drops `Authorization` on a cross-host
   redirect, or load chapter images through a path that is verified (a fetch to a local file, then
   `CoverImage`).
4. **Scope.** Chapter images only, or every private-feed artwork load (channel and item art too)?

## Starting points

- `.cursor/rules/add-by-rss-client-held-credentials.mdc` and `docs/features/ADD-BY-RSS.md`
- `resolveCredentialScope` and `hasUrlInCredentialScope` in `@podverse/helpers`
- Mobile `CoverImage` / `useCoverThumbnail` (**mobile-image-loading**) and
  `resolvePlayerChapterArtworkUri` (**mobile-chapter-artwork**)
- The Add by RSS chapters loader from `add-by-rss-parity` plan 35

## When picked up

Run **abcplan** with this file as the request's starting context, answer the questions above, and
update the credentials rule in the same change as the code.
