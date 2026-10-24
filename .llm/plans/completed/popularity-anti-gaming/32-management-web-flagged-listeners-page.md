**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 32 — Management web: Flagged Listeners page

A page under Stats lists flagged listeners and lets an admin with stats update permission clear a
flag after a confirmation. It reads plan 31's routes through the request package and shows the
pseudonymous listener id, never an account.

## Rows

R11

## Runs after

31

## Route, permission, entry point

- `apps/management-web/src/lib/routes.ts`: add `STATS_FLAGGED_LISTENERS: '/stats/flagged-listeners',`
  right after `STATS`.
- `apps/management-web/src/lib/managementPermissions.ts`: add `canUpdateStats(user)` after
  `canReadStats`, same shape with `CRUD_UPDATE`.
- `apps/management-web/src/app/(management)/stats/StatsPageClient.tsx`: pass `headerChildren` to
  `ManagementPageShell`:

  ```tsx
  headerChildren={
    <PageHeaderActions>
      <ActionLink href={ROUTES.STATS_FLAGGED_LISTENERS} variant="secondary" LinkComponent={Link}>
        {ts('flaggedListenersLink')}
      </ActionLink>
    </PageHeaderActions>
  }
  ```

  (`PageHeaderActions` and `ActionLink` from `@podverse/ui`, the way
  `NotificationsListPageClient.tsx` uses them.) The stats page is already readable only with
  stats read, so the link needs no extra check.
- No new nav section: Flagged Listeners lives under Stats.

## Page

- New `apps/management-web/src/app/(management)/stats/flagged-listeners/page.tsx`: copy
  `stats/page.tsx` (session check, `redirect(ROUTES.HOME)` without a user) and render
  `<FlaggedListenersPageClient user={user} />`.
- New `apps/management-web/src/app/(management)/stats/flagged-listeners/FlaggedListenersPageClient.tsx`,
  `'use client'`, modeled on `feeds/merge-review/MergeReviewPageClient.tsx`:
  - Translations: `useTranslations('statsFlaggedListeners')`, `common`, `nav`, `statsPage` (for
    the breadcrumb label `statsPage.title`). `useLocale()` for dates.
  - `canClear = canUpdateStats(user)`.
  - State: `status: StatsFlaggedListenerStatus` (`'active'`), `page` (1), `refresh` (0), `rows`,
    `totalPages`, `loading` (true), `loadError`, `confirmRow: StatsFlaggedListenerRow | null`,
    `pending`, `actionError`.
  - Load effect on `[status, page, refresh, t]` with a `cancelled` flag, like merge review:
    `reqStatsFlaggedListeners(status, page, PAGE_SIZE)` with `PAGE_SIZE = 25`;
    `totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))`; failure sets `t('loadError')`.
  - Shell: `ManagementPageShell` with `title={t('pageTitle')}` and `Breadcrumbs`
    Dashboard → Stats (`ROUTES.STATS`) → Flagged Listeners. Under it a `LeadParagraph` with
    `t('intro')`.
  - `ManagementLoadingSpinnerOverlay isLoading={loading}`; `Alert` for `loadError`.
  - `FormStack` holding a `FormDropdown` (`eyebrow={t('filterStatus')}`,
    `id="stats-flagged-listeners-status"`, options Active, Cleared, All in that order; changing it
    sets the status and page 1; narrow the value with an `isStatusFilter` guard like merge
    review's).
  - Empty: `<p>{t('empty')}</p>` when not loading, no error, and no rows.
  - Table (`Table.ScrollContainer` > `Table`), columns in order: Listener, Reason, Flagged, Times
    Flagged, Listens (7 Days), Opens (7 Days), Status, and `tc('actions')`.
    - Listener: `<code title={row.listener_id}>{row.listener_id.slice(0, 8)}</code>`.
    - Reason: an exhaustive `switch` on `row.reason` (`stored_cap_reached` →
      `t('reasonStoredCapReached')`, `too_soon_minutes` → `t('reasonTooSoonMinutes')`), no
      default branch (**i18n-user-facing-strings** § Reason-mapped copy).
    - Flagged: `formatDateTimeAbbrevOrFallback(row.flagged_at, locale, t('emptyValue'))` from
      `@podverse/helpers` (**time-format-local**).
    - Counts: `toLocaleString(locale)`.
    - Status: `t('statusActive')` while `cleared_at` is null, otherwise
      `t('clearedOn', { date: formatDateTimeAbbrevOrFallback(row.cleared_at, locale, t('emptyValue')) })`.
    - Actions: when `canClear && row.cleared_at === null`, a `Button` `variant="secondary"`,
      text `t('clear')`, `aria-label={t('clearNamed', { listener: row.listener_id.slice(0, 8) })}`,
      that sets `confirmRow` and clears `actionError`. Otherwise the cell is empty.
  - `Pagination` from `@podverse/ui` under the table when `totalPages > 1`: `currentPage={page}`,
    `totalPages`, `onPageChange={setPage}`, `prevLabel={tc('paginationPrevButton')}`,
    `nextLabel={tc('paginationNextButton')}`,
    `pageIndicatorLabel={tc('paginationPageOf', { currentPage: page, totalPages })}`.
  - Confirm `Modal` (`ariaLabel` and `header` `t('clearConfirmTitle')`,
    `closeButtonAriaLabel={tc('closeModalAria')}`, `isOpen={confirmRow !== null}`, closing is
    ignored while `pending`): `ModalBody` with `actionError` in an `Alert` and
    `<p>{t('clearConfirmBody')}</p>`; `ModalActions` with Cancel (`tc('cancel')`, secondary,
    disabled while pending) then Clear (`t('clear')`, `variant="primary"`, `isLoading={pending}`)
    (**modal-layout-contract**, **form-primary-actions-row**).
  - Clear handler: return when `confirmRow === null`, `!canClear`, or `pending` (in-flight guard,
    **input-rate-control**); `setPending(true)`; `await reqStatsFlaggedListenerClear(confirmRow.id)`;
    on success close the modal and bump `refresh`; on failure set
    `readRequestMessage(error) ?? t('actionError')` (copy merge review's `readRequestMessage`
    and `isRecord` into this file); `finally` `setPending(false)`.
- Import types and calls from `'../../../../lib/requests/stats'` (it re-exports
  `@podverse/management-api-requests`). Styles: none; the shared components carry layout.

## Copy

`packages/i18n-catalog/management/originals/*.json`. Add `"flaggedListenersLink"` inside
`statsPage` (after `"close"`), and a new top-level `"statsFlaggedListeners"` object right after
`statsPage`. Labels are title case in English; sentences stay sentence case
(**ui-copy-casing**). Do not edit `overrides/`.

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `statsPage.flaggedListenersLink` | Flagged Listeners | Oyentes marcados | Auditeurs signalés | Επισημασμένοι ακροατές |
| `pageTitle` | Flagged Listeners | Oyentes marcados | Auditeurs signalés | Επισημασμένοι ακροατές |
| `intro` | Listeners whose listening looked scripted. While flagged, their listening still updates their Taste Profile but does not count toward public lists. | Oyentes cuya escucha parecía automatizada. Mientras estén marcados, su escucha sigue actualizando su Perfil de gustos, pero no cuenta para las listas públicas. | Auditeurs dont l'écoute semblait automatisée. Tant qu'ils sont signalés, leur écoute met toujours à jour leur Profil de goûts, mais ne compte pas pour les listes publiques. | Ακροατές των οποίων η ακρόαση έμοιαζε αυτοματοποιημένη. Όσο είναι επισημασμένοι, η ακρόασή τους ενημερώνει ακόμη το Προφίλ γούστου τους, αλλά δεν μετρά στις δημόσιες λίστες. |
| `filterStatus` | Status | Estado | Statut | Κατάσταση |
| `statusActive` | Active | Activo | Actif | Ενεργή |
| `statusCleared` | Cleared | Retirado | Levé | Με άρση |
| `statusAll` | All Statuses | Todos los estados | Tous les statuts | Όλες οι καταστάσεις |
| `columnListener` | Listener | Oyente | Auditeur | Ακροατής |
| `columnReason` | Reason | Motivo | Motif | Λόγος |
| `columnFlagged` | Flagged | Marcado | Signalé | Επισήμανση |
| `columnTimesFlagged` | Times Flagged | Veces marcado | Nombre de signalements | Φορές επισήμανσης |
| `columnListens` | Listens (7 Days) | Escuchas (7 días) | Écoutes (7 jours) | Ακροάσεις (7 ημέρες) |
| `columnOpens` | Opens (7 Days) | Aperturas (7 días) | Ouvertures (7 jours) | Ανοίγματα (7 ημέρες) |
| `columnStatus` | Status | Estado | Statut | Κατάσταση |
| `reasonStoredCapReached` | Daily Listen Limit Reached Quickly | Límite diario de escuchas alcanzado rápidamente | Limite quotidienne d'écoutes atteinte rapidement | Το ημερήσιο όριο ακροάσεων συμπληρώθηκε γρήγορα |
| `reasonTooSoonMinutes` | Sustained Too-Soon Listens | Escuchas demasiado seguidas y continuas | Écoutes trop rapprochées en continu | Συνεχείς πολύ κοντινές ακροάσεις |
| `clearedOn` | Cleared {date} | Retirado {date} | Levé le {date} | Άρση {date} |
| `clear` | Clear Flag | Retirar marca | Lever le signalement | Άρση επισήμανσης |
| `clearNamed` | Clear Flag for {listener} | Retirar la marca de {listener} | Lever le signalement de {listener} | Άρση επισήμανσης για {listener} |
| `clearConfirmTitle` | Clear Flag | Retirar marca | Lever le signalement | Άρση επισήμανσης |
| `clearConfirmBody` | This listener's new listening, and listening from before the flag, counts toward public lists again. Listening recorded while flagged stays out. A new signal on a later day flags it again. | La escucha nueva de este oyente, y la de antes de la marca, vuelve a contar para las listas públicas. La escucha registrada mientras estaba marcado sigue fuera. Una nueva señal en un día posterior lo vuelve a marcar. | La nouvelle écoute de cet auditeur, et celle d'avant le signalement, compte de nouveau pour les listes publiques. L'écoute enregistrée pendant le signalement reste exclue. Un nouveau signal un jour suivant le signale de nouveau. | Η νέα ακρόαση αυτού του ακροατή, και η ακρόαση πριν από την επισήμανση, μετρά ξανά στις δημόσιες λίστες. Η ακρόαση που καταγράφηκε όσο ήταν επισημασμένος μένει εκτός. Ένα νέο σήμα σε επόμενη ημέρα τον επισημαίνει ξανά. |
| `loadError` | Could not load flagged listeners. | No se pudieron cargar los oyentes marcados. | Impossible de charger les auditeurs signalés. | Δεν ήταν δυνατή η φόρτωση των επισημασμένων ακροατών. |
| `actionError` | Could not clear this flag. | No se pudo retirar esta marca. | Impossible de lever ce signalement. | Δεν ήταν δυνατή η άρση αυτής της επισήμανσης. |
| `empty` | No flagged listeners match this status. | Ningún oyente marcado coincide con este estado. | Aucun auditeur signalé ne correspond à ce statut. | Κανένας επισημασμένος ακροατής δεν ταιριάζει με αυτήν την κατάσταση. |
| `emptyValue` | — | — | — | — |

All keys except the first sit inside `statsFlaggedListeners`.

## Files

apps/management-web/src/lib/routes.ts
apps/management-web/src/lib/managementPermissions.ts
apps/management-web/src/app/(management)/stats/StatsPageClient.tsx
apps/management-web/src/app/(management)/stats/flagged-listeners/page.tsx
apps/management-web/src/app/(management)/stats/flagged-listeners/page.test.tsx
apps/management-web/src/app/(management)/stats/flagged-listeners/FlaggedListenersPageClient.tsx
packages/i18n-catalog/management/originals/en-US.json
packages/i18n-catalog/management/originals/es.json
packages/i18n-catalog/management/originals/fr.json
packages/i18n-catalog/management/originals/el-GR.json
apps/management-web/e2e/stats-flagged-listeners.spec.ts
apps/management-web/e2e/stats-page.spec.ts
release-notes/scratchpad.md

## Tests

Unit, `apps/management-web/src/app/(management)/stats/flagged-listeners/page.test.tsx`: copy
`stats/page.test.tsx` (redirects without a session; renders the client with the session user).

Playwright, new `apps/management-web/e2e/stats-flagged-listeners.spec.ts` (**e2e-page-tests**,
**e2e-readability**, **e2e-suite-title**, **e2e-screenshot-verified-element**). Top-level
describe: "Management-web flagged listeners page". Sign in as `e2e-superadmin@example.com` like
`stats-page.spec.ts`, and mock the API with `page.route` so no listener rows need seeding:

- `GET` matching `/\/stats\/flagged-listeners(?:\?.*)?$/`: answer
  `{ rows: [MOCK_ACTIVE_ROW], total: 1, page: 1, pageSize: 25 }` until the clear, then
  `{ rows: [], total: 0, page: 1, pageSize: 25 }`. `MOCK_ACTIVE_ROW` has `id: 4343`,
  `listener_id: 'e2e0f1a2-0000-4000-8000-000000000001'`, `reason: 'stored_cap_reached'`,
  `flagged_at: '2026-10-21T12:00:00.000Z'`, `times_flagged: 1`, `cleared_at: null`,
  `cleared_by_admin_id: null`, `listens_last_7_days: 300`, `opens_last_7_days: 4`.
- `POST` matching `/\/stats\/flagged-listeners\/4343\/clear$/`: answer
  `{ row: { ...MOCK_ACTIVE_ROW, cleared_at: '2026-10-22T09:00:00.000Z', cleared_by_admin_id: 1 } }`
  and record that it was called.

One test, "When a superuser opens Flagged Listeners from the stats page, they see the flagged
listener and can clear its flag after confirming.":

1. Go to `ROUTES.STATS`; click the `Flagged Listeners` link; the URL ends with
   `/stats/flagged-listeners` and the level-1 heading is `Flagged Listeners`. Capture.
1. The row named `/e2e0f1a2/` shows `Daily Listen Limit Reached Quickly` and `300`. Capture with
   the row.
1. Click `Clear Flag for e2e0f1a2`; the dialog `Clear Flag` shows the confirmation sentence.
   Capture with the dialog.
1. Click `dialog.getByRole('button', { name: 'Clear Flag', exact: true })` (the row button's
   name also starts with "Clear Flag", so scope to the dialog and match exactly); the dialog
   closes, the POST mock was called once, and the page shows
   `No flagged listeners match this status.` Capture.

`apps/management-web/e2e/stats-page.spec.ts`: after the stats heading check, assert the
`Flagged Listeners` link is visible.

Place the new spec next to `stats-page.spec.ts` in any ordered spec list the management report
uses (**e2e-report-order**).

## Release scratchpad

```markdown
## Management Stats has a Flagged Listeners page

- Surfaces: management-web
- Change: Stats links to a new Flagged Listeners page that lists listeners flagged out of
  popularity (active, cleared, or all), with the pseudonymous listener id, reason, when, times
  flagged, and listens and opens in the last 7 days. Admins with stats update permission can
  clear a flag after confirming.
- Who notices: admins with stats permissions
- Operator steps: none
```
