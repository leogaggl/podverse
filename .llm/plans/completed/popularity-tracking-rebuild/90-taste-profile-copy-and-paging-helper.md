**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 90 — Taste Profile copy and the shared paging helper

The shared base that the web and mobile plans (92–95) build on:

- Consumer catalog keys for the opt-out warning and the Taste Profile sections, in all four
  locales. Web and mobile both read the consumer layer, so both clients get the same copy.
- A pure helper in `@podverse/helpers` that fetches, merges, and extends pages of either Taste
  Profile list. Both clients call it, so paging cannot drift between them
  (**reuse-beyond-components**).

No UI renders these keys yet. Plans 92–95 do.

## Rows

R64

## Runs after

71

## Files

- `packages/i18n-catalog/consumer/originals/en-US.json`
- `packages/i18n-catalog/consumer/originals/es.json`
- `packages/i18n-catalog/consumer/originals/fr.json`
- `packages/i18n-catalog/consumer/originals/el-GR.json`
- `packages/helpers/src/lib/tasteProfilePages.ts` (new)
- `packages/helpers/src/lib/tasteProfilePages.test.ts` (new)
- `packages/helpers/src/index.ts`

## Catalog keys

The four catalog files are large. Search for the anchor, then edit a window
(**large-file-reading**). Key order must match in all four files; `i18n:validate` checks parity and
order. No plurals: web uses ICU and mobile uses `_one`/`_other`, so shared keys stay plural-free.
Interpolation is single-brace (`{title}`, `{date}`) on both clients.

Copy rules: chrome (titles, buttons, accessible names) is title case in en-US; sentences are
sentence case (**ui-copy-casing**). The es, fr and el-GR strings follow the sentence-case style
those files already use. Never call the listener id anonymous. French uses a plain space before
`?` and `:` and a straight apostrophe, as the fr file already does. Greek uses `;` as its question
mark.

Reused keys, do not add copies: `misc.cancel` (dialog cancel), `misc.close_modal` (web modal close
button), `misc.untitled` (a show with no title), `popularity_tracking.retry` (retry buttons).

### `popularity_tracking` block — append three keys

Anchor: the `"popularity_tracking": {` object. Add these after `"status_undecided"`, the block's
last key, in this order. Remember the comma on `status_undecided`.

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `opt_out_confirm_title` | Turn Off Popularity Tracking? | ¿Desactivar el seguimiento de popularidad? | Désactiver le suivi de popularité ? | Απενεργοποίηση της παρακολούθησης δημοτικότητας; |
| `opt_out_confirm_body` | Your Taste Profile, your Hidden From Taste Profile list, and your stored listening history will be deleted right away. If you turn Popularity Tracking on again later, your recommendations will start from scratch. Public listen totals that already include your listens stay as they are. | Tu perfil de gustos, tu lista Oculto del perfil de gustos y tu historial de escucha guardado se borrarán de inmediato. Si vuelves a activar el seguimiento de popularidad más adelante, tus recomendaciones empezarán desde cero. Los totales públicos de escuchas que ya incluyen tus escuchas se quedan como están. | Votre profil de goûts, votre liste Masqué du profil de goûts et votre historique d'écoute enregistré seront supprimés immédiatement. Si vous réactivez le suivi de popularité plus tard, vos recommandations repartiront de zéro. Les totaux d'écoute publics qui incluent déjà vos écoutes restent inchangés. | Το προφίλ γούστου σας, η λίστα Κρυμμένο από το προφίλ γούστου και το αποθηκευμένο ιστορικό ακρόασής σας θα διαγραφούν αμέσως. Αν ενεργοποιήσετε ξανά την παρακολούθηση δημοτικότητας αργότερα, οι προτάσεις σας θα ξεκινήσουν από την αρχή. Τα δημόσια σύνολα ακροάσεων που περιλαμβάνουν ήδη τις ακροάσεις σας μένουν ως έχουν. |
| `opt_out_confirm_action` | Turn Off and Delete | Desactivar y borrar | Désactiver et supprimer | Απενεργοποίηση και διαγραφή |

### New `taste_profile` block

Anchor: insert a new top-level `"taste_profile": { … }` object directly after the closing `},` of
`"popularity_tracking"` and before `"misc": {`, in all four files. Keys in this order:

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `title` | Taste Profile | Perfil de gustos | Profil de goûts | Προφίλ γούστου |
| `description` | Shows your listening has added while Popularity Tracking is on. Future recommendations will use this list. Removing a show deletes its listening data here and moves it to Hidden From Taste Profile. | Programas que tus escuchas han añadido mientras el seguimiento de popularidad está activado. Las recomendaciones futuras usarán esta lista. Quitar un programa borra aquí sus datos de escucha y lo mueve a Oculto del perfil de gustos. | Émissions ajoutées par vos écoutes pendant que le suivi de popularité est activé. Les futures recommandations utiliseront cette liste. Retirer une émission supprime ici ses données d'écoute et la déplace vers Masqué du profil de goûts. | Εκπομπές που πρόσθεσαν οι ακροάσεις σας όσο η παρακολούθηση δημοτικότητας είναι ενεργή. Οι μελλοντικές προτάσεις θα χρησιμοποιούν αυτή τη λίστα. Η αφαίρεση μιας εκπομπής διαγράφει τα δεδομένα ακρόασής της εδώ και τη μεταφέρει στο Κρυμμένο από το προφίλ γούστου. |
| `empty` | No shows yet. Shows appear here after you listen with Popularity Tracking on. | Aún no hay programas. Aparecen aquí cuando escuchas con el seguimiento de popularidad activado. | Aucune émission pour l'instant. Elles apparaissent ici quand vous écoutez avec le suivi de popularité activé. | Δεν υπάρχουν ακόμη εκπομπές. Εμφανίζονται εδώ όταν ακούτε με ενεργή την παρακολούθηση δημοτικότητας. |
| `hidden_title` | Hidden From Taste Profile | Oculto del perfil de gustos | Masqué du profil de goûts | Κρυμμένο από το προφίλ γούστου |
| `hidden_description` | Shows you removed. Listening to them does not add them back. Unhide a show to add it back now or to let your next listen add it. | Programas que quitaste. Escucharlos no los vuelve a añadir. Muestra de nuevo un programa para añadirlo ahora o para que tu próxima escucha lo añada. | Émissions que vous avez retirées. Les écouter ne les ajoute pas à nouveau. Réaffichez une émission pour l'ajouter maintenant ou pour que votre prochaine écoute l'ajoute. | Εκπομπές που αφαιρέσατε. Η ακρόασή τους δεν τις προσθέτει ξανά. Επανεμφανίστε μια εκπομπή για να την προσθέσετε τώρα ή για να την προσθέσει η επόμενη ακρόασή σας. |
| `hidden_empty` | No hidden shows. | No hay programas ocultos. | Aucune émission masquée. | Δεν υπάρχουν κρυμμένες εκπομπές. |
| `remove` | Remove | Quitar | Retirer | Αφαίρεση |
| `remove_accessible` | Remove {title} From Taste Profile | Quitar {title} del perfil de gustos | Retirer {title} du profil de goûts | Αφαίρεση του {title} από το προφίλ γούστου |
| `unhide` | Unhide | Mostrar de nuevo | Réafficher | Επανεμφάνιση |
| `unhide_accessible` | Unhide {title} | Mostrar de nuevo {title} | Réafficher {title} | Επανεμφάνιση του {title} |
| `unhide_dialog_title` | Unhide Show | Mostrar de nuevo el programa | Réafficher l'émission | Επανεμφάνιση εκπομπής |
| `unhide_dialog_body` | Add {title} back to your Taste Profile now, or only take it off this list so your next listen adds it again. | Vuelve a añadir {title} a tu perfil de gustos ahora, o solo quítalo de esta lista para que tu próxima escucha lo añada de nuevo. | Ajoutez {title} à votre profil de goûts maintenant, ou retirez-la seulement de cette liste pour que votre prochaine écoute l'ajoute à nouveau. | Προσθέστε ξανά το {title} στο προφίλ γούστου σας τώρα ή απλώς αφαιρέστε το από αυτή τη λίστα, ώστε η επόμενη ακρόασή σας να το προσθέσει ξανά. |
| `unhide_add_back` | Add to Taste Profile | Añadir al perfil de gustos | Ajouter au profil de goûts | Προσθήκη στο προφίλ γούστου |
| `unhide_remove_only` | Only Remove From Hidden List | Solo quitar de la lista de ocultos | Retirer seulement de la liste masquée | Μόνο αφαίρεση από τη λίστα κρυμμένων |
| `last_listened` | Last Listened: {date} | Última escucha: {date} | Dernière écoute : {date} | Τελευταία ακρόαση: {date} |
| `added_back` | Added back. No listens since. | Añadido de nuevo. Sin escuchas desde entonces. | Ajoutée à nouveau. Aucune écoute depuis. | Προστέθηκε ξανά. Καμία ακρόαση από τότε. |
| `hidden_on` | Hidden: {date} | Oculto: {date} | Masquée : {date} | Κρύφτηκε: {date} |
| `load_more` | Load More | Cargar más | Charger plus | Φόρτωση περισσότερων |
| `load_error` | Could not load your Taste Profile. Please try again. | No se pudo cargar tu perfil de gustos. Inténtalo de nuevo. | Impossible de charger votre profil de goûts. Veuillez réessayer. | Δεν ήταν δυνατή η φόρτωση του προφίλ γούστου σας. Δοκιμάστε ξανά. |
| `hidden_load_error` | Could not load your hidden shows. Please try again. | No se pudieron cargar tus programas ocultos. Inténtalo de nuevo. | Impossible de charger vos émissions masquées. Veuillez réessayer. | Δεν ήταν δυνατή η φόρτωση των κρυμμένων εκπομπών σας. Δοκιμάστε ξανά. |
| `load_more_error` | Could not load more shows. Please try again. | No se pudieron cargar más programas. Inténtalo de nuevo. | Impossible de charger plus d'émissions. Veuillez réessayer. | Δεν ήταν δυνατή η φόρτωση περισσότερων εκπομπών. Δοκιμάστε ξανά. |
| `action_error` | Could not update your Taste Profile. Please try again. | No se pudo actualizar tu perfil de gustos. Inténtalo de nuevo. | Impossible de mettre à jour votre profil de goûts. Veuillez réessayer. | Δεν ήταν δυνατή η ενημέρωση του προφίλ γούστου σας. Δοκιμάστε ξανά. |

The section names (`title`, `hidden_title`) match the names plan 20 uses in the explanation text.

## Helper — `packages/helpers/src/lib/tasteProfilePages.ts`

Import the pagination DTO type from plan 71
(`import type { DTOAccountTasteProfilePagination } from '../dtos/account/accountTasteProfile.js';`).
No React, no request code: callers pass a `fetchPage` function.

```typescript
/** Rows per request for both Taste Profile lists; matches the API default. */
export const TASTE_PROFILE_PAGE_LIMIT = 20;

type TasteProfileKeyedRow = { channel: { id_text: string } };

export type TasteProfilePage<Row> = {
  items: Row[];
  pagination: DTOAccountTasteProfilePagination;
};

export type TasteProfileRows<Row> = {
  rows: Row[];
  totalCount: number;
  /** Pages 1..loadedPages are in `rows`. Always at least 1. */
  loadedPages: number;
  hasMore: boolean;
};

export function mergeTasteProfileRows<Row extends TasteProfileKeyedRow>(
  existing: readonly Row[],
  incoming: readonly Row[]
): Row[];

export async function fetchTasteProfilePages<Row extends TasteProfileKeyedRow>(
  fetchPage: (page: number) => Promise<TasteProfilePage<Row>>,
  pageCount: number
): Promise<TasteProfileRows<Row>>;

export function appendTasteProfilePage<Row extends TasteProfileKeyedRow>(
  current: TasteProfileRows<Row>,
  page: TasteProfilePage<Row>,
  pageNumber: number
): TasteProfileRows<Row>;
```

Behavior:

- `mergeTasteProfileRows` returns `existing` followed by each `incoming` row whose
  `channel.id_text` is not already present. A hide or unhide between two page requests shifts the
  offsets, so a row can arrive twice; the first copy wins.
- `fetchTasteProfilePages`:
  1. `target = Math.max(1, Math.floor(pageCount))`.
  2. Fetch page 1. Then fetch pages 2, 3, … one at a time while the page number is
     `<= target` and `<= total_pages` from the latest response. Merge each page's items with
     `mergeTasteProfileRows`.
  3. `totalCount` and the total pages come from the last response.
  4. `loadedPages = Math.max(1, Math.min(target, totalPages))`; `hasMore = loadedPages < totalPages`.
  5. A rejected `fetchPage` rejects the whole call. Do not catch.
- `appendTasteProfilePage` merges `page.items` into `current.rows`. When
  `pageNumber <= page.pagination.total_pages`, `loadedPages` becomes `pageNumber`; otherwise it
  keeps `current.loadedPages`. `totalCount = page.pagination.total_count`;
  `hasMore = loadedPages < page.pagination.total_pages`.

Callers refetch with `fetchTasteProfilePages(fetchPage, current.loadedPages)` after a hide or
unhide, so the listener keeps the rows they had scrolled to.

### Export

In `packages/helpers/src/index.ts`, add `export * from './lib/tasteProfilePages.js';` on the line
after `export * from './lib/popularityTracking.js';`. Plans in other areas also add lines to this
file; keep theirs.

## Tests

`packages/helpers/src/lib/tasteProfilePages.test.ts` (vitest, style of
`packages/helpers/src/lib/accessTier.test.ts`). Use a fake `fetchPage` that serves a fixed array
of rows in pages of 2. One `it` per behavior, no more:

1. `fetchTasteProfilePages(fetchPage, 1)` on five rows returns the first two rows,
   `loadedPages` 1, `hasMore` true, `totalCount` 5.
2. `pageCount` 3 on five rows returns all five rows in order, `loadedPages` 3, `hasMore` false,
   and calls `fetchPage` with 1, 2, 3 only.
3. `pageCount` 4 on three rows stops after page 2 (`total_pages` 2): `loadedPages` 2,
   `hasMore` false, `fetchPage` called twice.
4. An empty list (`total_count` 0, `total_pages` 0) returns no rows, `loadedPages` 1,
   `hasMore` false.
5. A row repeated across pages appears once (`mergeTasteProfileRows`).
6. `appendTasteProfilePage` adds page 2's rows, sets `loadedPages` 2, and recomputes `hasMore`.
7. A `fetchPage` that rejects on page 2 makes `fetchTasteProfilePages` reject.

## Release scratchpad

none
