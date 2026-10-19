# 06 — API description contract

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Add a small endpoint that returns one item's full show notes, the request-client method for it,
the copy keys web and mobile share, and one seeded episode with shortened notes. This prompt
defines the contract so 07 (web) and 08 (mobile) can run in parallel without touching shared
files.

List endpoints are unchanged here. They already return the new `preview`, `is_truncated`, and
`source_length` columns, because TypeORM loads every column of `item_description`. Plan 09
removes `value` from lists later.

Depends on 03. Do not edit web, mobile, management, or the parser.

## Response DTO — new `packages/helpers/src/dtos/item/itemDescriptionDetail.ts`

```ts
export interface DTOItemDescriptionDetail {
  item_id_text: string;
  value: string | null;
  preview: string | null;
  is_truncated: boolean;
  source_length: number | null;
  /** The item's `<link>`; where the full notes live when `is_truncated`. */
  link_url: string | null;
}
```

Export it beside the other item DTOs.

## Endpoint — `GET /item/:idOrIdText/description`

`apps/api/src/routes/item.ts`: register it above `/:idOrIdText`.

`apps/api/src/controllers/item.ts`, new `getDescriptionByIdOrIdText`. Mirror
`getByIdOrIdText`:

1. Validate with `idOrIdTextParamSchema`.
2. Apply the same merge redirect (`mergeRedirects.itemMove`, then `sendMergedInto`), so a merged
   episode answers the same way as its detail route.
3. Load the item with only `item_description` and `item_about`. Do not use
   `itemGetOneRelations`; this route must stay light.
4. Missing item returns 404. An item with no description row returns 200 with `value`,
   `preview`, `source_length`, and `link_url` resolved and `is_truncated: false`. Clients cache
   "no notes" and do not refetch.
5. `link_url` is `item_about.website_link_url`.

If other public item reads set `Cache-Control`, match them. Otherwise add none.

`apps/api/openapi.yml` (**openapi-sync**): the path, the `DTOItemDescriptionDetail` schema,
404, the merged response the detail route documents, and one example.

## Request client — `packages/helpers-requests`

`src/api/item/item.ts`:

```ts
export async function reqItemDescriptionGetByIdOrIdText(
  api: ApiRequestService,
  idOrIdText: string
) {
  return api.apiRequest<DTOItemDescriptionDetail>({
    path: `/item/${idOrIdText}/description`,
    method: 'GET',
  });
}
```

Add the matching method on the class in `src/api/_request.ts`, next to
`reqItemGetByIdOrIdText`.

## Copy — consumer catalog

`packages/i18n-catalog/consumer/originals/{en-US,es,fr,el-GR}.json`. Add a new `info.truncation`
object. `info.about` is a string, so it cannot hold nested keys.

| Key | en-US | Kind |
| --- | --- | --- |
| `info.truncation.read_full_show_notes` | Read Full Show Notes | Link (title case) |
| `info.truncation.read_full_description` | Read Full Description | Link (title case) |
| `info.truncation.show_notes_shortened` | These show notes were shortened. | Sentence |
| `info.truncation.description_shortened` | This description was shortened. | Sentence |

Item Summary uses the show-notes pair. Channel About uses the description pair
(**abcmemory-vocabulary**: description / About / Summary). Translate es, fr, and el-GR in each
language's own capitalization (**ui-copy-casing**). Do not edit `overrides/`.

## Seed — `tools/web/seed-e2e.mjs`

Add one deterministic episode to the seeded podcast that `about-summary-people.spec.ts` and the
mobile `podcast-episode.yaml` flow already open. Follow **e2e-seed-nano-id-limits** for its
`id_text`.

- Title **E2E Long Show Notes**.
- `item_description.value`: synthetic rich notes, made of a heading, two paragraphs, and a
  five-item link list. `preview` is the first 400 plain characters at a word boundary.
  `is_truncated: true` and `source_length: 18000`.
- `item_about.website_link_url`: `https://example.com/e2e-long-show-notes`.
- The same enclosure fixture the other seeded episodes in that podcast use, so the mobile flow
  in 08 can play it and open the full player.

Use a publication date that keeps every existing list assertion stable (older than the current
newest seeded episode). Do not change other seeded descriptions.

Write the seed values by hand. The seed script does not import workspace packages.

## Tests

`apps/api`: add an integration test next to the existing item route tests (**api-testing**).

- Seeded long notes: 200, `value` present, `is_truncated` true, `link_url` set.
- Item with no description row: 200, `value` null, `is_truncated` false.
- Unknown id: 404.
- A merged item: the same merged response as `GET /item/:idOrIdText`, if the merge fixtures are
  available in this suite.
- `GET /item/channel/...` list responses include `preview` and `is_truncated` on
  `item_description`. This pins the widen step.

## Scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Item show notes endpoint

- Surfaces: api
- Change: GET /item/:idOrIdText/description returns one item's full show notes, a plain
  preview, whether the notes were shortened, and the item link. List responses now include
  preview and is_truncated on item_description.
- Who notices: API clients; the apps use it to load notes on demand
```

## Done when

- The endpoint loads two relations, not the detail set.
- Merged items behave as they do on the detail route.
- Catalog keys exist in all four locales.
- Code comments must not cite this plan or any plan number.

## Operator verification

**Root** — needs `make test_deps`.

```bash
npm run build:packages
npm run test -w apps/api
npm run test -w packages/helpers-requests
make e2e_seed
```
