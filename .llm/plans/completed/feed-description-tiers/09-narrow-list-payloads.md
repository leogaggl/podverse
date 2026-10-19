# 09 — Narrow list payloads

**Cursor model:** Codex 5.3 · **Reasoning:** high

## Premise

No alpha tester is running an older build, and the app database can be wiped. List responses
omit `value` in the same release as the preview reads from 07 and 08. A phone that already
cached a list row still has `value`; `getDescriptionPreviewText` covers that row. A reinstall
only sees the new shape. Web ships with the API.

## Summary

List endpoints stop shipping full description HTML. Detail endpoints and the description
endpoint (06) still return it. With stored caps up to 150,000 characters, a 20-episode list
could otherwise carry megabytes of notes nobody reads.

## ORM

- `ItemDescription.value` and `ChannelDescription.value`: add `select: false`. `preview`,
  `is_truncated`, and `source_length` stay selected.
- `packages/orm/src/services/item/item.ts` and `packages/orm/src/services/channel/channel.ts`:
  `itemGetManyRelations` and the channel list relations keep `item_description` and
  `channel_description`. List rows then carry the preview fields and no `value`.
- Single-item and single-channel reads (`itemGetOneRelations`, `getItemOneToOneRelations`, and
  the channel equivalents) must load `value`. If that path uses a query builder, add
  `.addSelect('item_description.value')`. Otherwise follow the entity read with one primary-key
  lookup that selects `value`. Add `getValueByParentId` helpers on `ItemDescriptionService` and
  `ChannelDescriptionService` for that lookup.
- `BaseOneService._update` loads the existing row before saving. For the two description
  services, pass a `config` whose `select` includes `value`, so TypeORM's change detection
  still sees the stored text and an unchanged reparse does not rewrite the row.
- `archiver.ts` deletes by SQL and needs no change. Confirm by reading.

Search `apps/` and `packages/` for `item_description`, `channel_description`,
`ItemDescription`, and `ChannelDescription`. Every server reader of `value` either goes through
a detail path above or selects the column explicitly. Known readers:

- `GET /item/:idOrIdText` and channel detail controllers in `apps/api/src/controllers/`
- `ItemController.getDescriptionByIdOrIdText` (06)
- `ormDescriptionsBackfill` (04), when it reads through TypeORM rather than SQL
- The parser description handlers (`packages/parser/src/lib/rss/**/*Description.ts`)

## DTOs

`packages/helpers/src/dtos/item/itemDescription.ts` and the channel equivalent: `value` becomes
optional, with a doc comment that lists omit it and detail includes it. Fix every TypeScript
error on web, mobile, API, and management-web. Fix each one by reading `value` only where a
detail payload is guaranteed, and use `getDescriptionPreviewText` everywhere else. Do not add
`?? ''` fallbacks that hide a list payload reaching a detail renderer.

Mobile check: after this change, `channel_item` payloads cached from lists have no `value`.
Confirm that `useItemDescription` (08) covers every Summary surface and that no mobile screen
reads `item_description.value` directly.

## Seeds

`tools/web/seed-e2e.mjs`: every `item_description` and `channel_description` insert also
writes `preview`, so seeded rows keep their snippets. The seeds are short plain sentences, so
`preview` equals the plain value. Use one helper in the seed file, not a repeated literal.

## OpenAPI

`apps/api/openapi.yml`: the description schemas mark `value` as optional. Say it is omitted in
list responses and present on detail and `GET /item/{idOrIdText}/description`.

## Tests

- API integration (`apps/api`): a podcast's episode list has `preview` and no `value`; item
  detail has `value`; channel detail has `value`; the description endpoint has `value`.
- Parser test: reparsing an unchanged item leaves `item_description.value` intact.
- Web E2E: rerun `episode-show-notes.spec.ts` and `about-summary-people.spec.ts`. Rows show the
  preview; Summary and About show the full text.
- Mobile Maestro: rerun `show-notes`, `podcast-episode`, and `player-screen`.

## Scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## API list responses omit full description HTML

- Surfaces: api, web, mobile
- Change: Episode and channel list responses include item_description / channel_description
  with preview, is_truncated, and source_length, but no value. Item and channel detail, and
  GET /item/:idOrIdText/description, still return value. List payloads shrink, most for feeds
  with long show notes.
- Who notices: third-party API clients that read value from list responses; listeners see
  faster lists
- Operator steps: none. Ship with the rest of this set. Install a mobile binary that includes
  the show notes cache on any phone pointed at alpha.
```

## Done when

- No list endpoint returns `value`.
- Detail and the description endpoint do.
- Every surface type-checks.
- Code comments must not cite this plan or any plan number.

## Operator verification — whole plan set

This is the last prompt. These commands cover 01 through 09. Do not set `E2E_API_GATE_MODE`.

**Root**

```bash
npm run build:packages
npm run lint
npm run test:unit
make test_deps
npm run test:e2e:api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/api
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/ops
kustomize build --load-restrictor LoadRestrictionsNone infra/k8s/base/cron
make e2e_test_web_report_spec SPEC=e2e/episode-show-notes.spec.ts,e2e/about-summary-people.spec.ts
make e2e_test_management_web_report_spec SPEC=e2e/feeds-flag-status.spec.ts
open .artifacts/e2e-reports/latest/index.html
```

From the Partytime repo root. It already ran in 02 before the release; rerun only if Partytime
changed since.

```bash
npm test
```

**Mobile**

```bash
npm run type-check:mobile
npm --prefix apps/mobile run test
make mobile_e2e_seed
```

**Mobile Maestro**: **Mobile E2E Metro**, **Mobile E2E API**, **Mobile E2E test-assets**, and
**Mobile E2E iOS** / **Mobile E2E Android** must already be running.

```bash
npm run mobile:e2e:test -- show-notes
npm run mobile:e2e:test -- podcast-episode
npm run mobile:e2e:test -- player-screen
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
