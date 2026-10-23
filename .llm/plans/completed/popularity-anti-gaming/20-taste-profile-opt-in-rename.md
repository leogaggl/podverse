**Cursor model:** Opus 5.5 · **Reasoning:** high

# 20 — Rename the opt-in from Popularity Tracking to Taste Profile

Listeners see the opt-in as "Popularity Tracking", but what they get is a Taste Profile. This
plan renames the opt-in everywhere it is named, in the UI, the legal text, the env keys, the
routes, and the code. Public counts keep the popularity name. Web Settings and the mobile screen
get one Taste Profile section: heading, switch, a plain summary, then the shows list and Hidden
From Taste Profile.

The web consent page moves from `/popularity-tracking` to `/taste-profile` with no redirect,
because nothing has shipped. The agreement and terms versions do not change. No database column,
table, or migration changes.

## Rows

R30, R31, R32, R33, R34, R35, R36, R37, R38, R39, R40

## Runs after

none. Plan 20 runs alone, before every other implementation plan. Later plans are written
against the new names below.

## Naming scheme

The names follow two suffixes so they cannot collide with the existing `TasteProfile*` and
`taste_profile` names (the list, its rows, `useTasteProfileLists`, `TasteProfileSections`):

- **Taste Profile agreement** is the served Markdown document and its version: env keys, the
  legal folder and endpoint, the DTO, the API and web config.
- **Taste Profile consent** is the account's decision and the UI that asks for it: helpers, gates,
  the i18n namespace, components, test ids, flows, and specs.

Use `git mv` for every renamed file so history follows.

## Old and new names

### Env keys, config, and routes

| Old | New |
| --- | --- |
| `POPULARITY_TRACKING_AGREEMENT_VERSION` | `TASTE_PROFILE_AGREEMENT_VERSION` |
| `POPULARITY_TRACKING_CONTENT_DIR` | `TASTE_PROFILE_AGREEMENT_CONTENT_DIR` |
| `NEXT_PUBLIC_POPULARITY_TRACKING_AGREEMENT_VERSION` | `NEXT_PUBLIC_TASTE_PROFILE_AGREEMENT_VERSION` |
| API `config.popularityTracking.version` | `config.tasteProfileAgreement.version` |
| API `config.popularityTracking.contentDir` | `config.tasteProfileAgreement.contentDir` |
| Web `config.public.legal.popularityTracking.version` | `config.public.legal.tasteProfileAgreement.version` |
| `GET /legal/popularity-tracking` | `GET /legal/taste-profile-agreement` |
| OpenAPI operationId `apiGetLegalPopularityTracking` | `apiGetLegalTasteProfileAgreement` |
| OpenAPI schema `ApiGetLegalPopularityTrackingResponse200` | `ApiGetLegalTasteProfileAgreementResponse200` |
| `APP_ROUTES.POPULARITY_TRACKING` (`'/popularity-tracking'`) | `APP_ROUTES.TASTE_PROFILE` (`'/taste-profile'`) |
| Web page `/popularity-tracking` | `/taste-profile` |
| Mobile route `MoreSettingsPopularityTracking` | `MoreSettingsTasteProfile` |
| API error code `popularity_tracking_not_allowed` | `taste_profile_consent_required` |
| Account data export key `popularity_tracking` | `listening_data` |

API `config.popularityTracking` stays, holding `dailyListenCap` and the caps later plans add
(see "Names that stay"). The new `config.tasteProfileAgreement` sits next to it:

```typescript
tasteProfileAgreement: {
  version: string;
  contentDir: string;
};
```

with values `process.env.TASTE_PROFILE_AGREEMENT_VERSION!` and
`process.env.TASTE_PROFILE_AGREEMENT_CONTENT_DIR ?? ''`. The `?? ''` already exists on the old key;
keep it as it is.

### Files and folders

| Old | New |
| --- | --- |
| `apps/api/legal/popularity-tracking/{en-US,es,fr,el-GR}.md` | `apps/api/legal/taste-profile-agreement/{en-US,es,fr,el-GR}.md` |
| `apps/api/src/lib/legal/popularityTrackingContent.ts` | `apps/api/src/lib/legal/tasteProfileAgreementContent.ts` |
| `apps/api/src/controllers/legal/popularityTracking.ts` | `apps/api/src/controllers/legal/tasteProfileAgreement.ts` |
| `apps/api/src/test/legal-popularity-tracking.test.ts` | `apps/api/src/test/legal-taste-profile-agreement.test.ts` |
| `apps/api/src/test/popularity-tracking-opt-out.integration.test.ts` | `apps/api/src/test/taste-profile-consent-opt-out.integration.test.ts` |
| `apps/api/src/test/account-data-export-popularity.integration.test.ts` | `apps/api/src/test/account-data-export-listening-data.integration.test.ts` |
| `packages/helpers/src/lib/popularityTracking.ts` | `packages/helpers/src/lib/tasteProfileConsent.ts` |
| `packages/helpers/src/lib/popularityTracking.test.ts` | `packages/helpers/src/lib/tasteProfileConsent.test.ts` |
| `packages/helpers/src/dtos/legal/popularityTrackingAgreement.ts` | `packages/helpers/src/dtos/legal/tasteProfileAgreement.ts` |
| `packages/helpers-requests/src/api/legal/popularityTracking.ts` | `packages/helpers-requests/src/api/legal/tasteProfileAgreement.ts` |
| `apps/web/src/app/popularity-tracking/page.tsx` | `apps/web/src/app/taste-profile/page.tsx` |
| `apps/web/src/components/Legal/PopularityAgreementGate.tsx` | `apps/web/src/components/Legal/TasteProfileAgreementGate.tsx` |
| `apps/web/src/components/Legal/ModalPopularityTrackingOptOut.tsx` | `apps/web/src/components/Legal/ModalTasteProfileConsentOptOut.tsx` |
| `apps/web/src/styles/components/Modal/ModalPopularityTrackingOptOut.module.scss` | `apps/web/src/styles/components/Modal/ModalTasteProfileConsentOptOut.module.scss` |
| `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsListenStats.tsx` | `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsTasteProfileConsentSwitch.tsx` |
| `apps/web/src/lib/popularityTrackingStatus.ts` | `apps/web/src/lib/tasteProfileConsentStatus.ts` |
| `apps/web/src/lib/popularityTrackingRequired.ts` | `apps/web/src/lib/tasteProfileConsentRequired.ts` |
| `apps/web/e2e/popularity-tracking-consent.spec.ts` | `apps/web/e2e/taste-profile-consent.spec.ts` |
| `apps/mobile/src/popularityTracking/` | `apps/mobile/src/tasteProfileConsent/` |
| `apps/mobile/src/popularityTracking/PopularityTrackingAgreementBody.tsx` | `apps/mobile/src/tasteProfileConsent/TasteProfileAgreementBody.tsx` |
| `apps/mobile/src/popularityTracking/PopularityTrackingOptOutPanel.tsx` | `apps/mobile/src/tasteProfileConsent/TasteProfileConsentOptOutPanel.tsx` |
| `apps/mobile/src/popularityTracking/popularityTrackingGate.ts` | `apps/mobile/src/tasteProfileConsent/tasteProfileConsentGate.ts` |
| `apps/mobile/src/screens/more/MoreSettingsPopularityTrackingScreen.tsx` | `apps/mobile/src/screens/more/MoreSettingsTasteProfileScreen.tsx` |
| `apps/mobile/e2e/popularity-tracking.yaml` | `apps/mobile/e2e/taste-profile-consent.yaml` |
| `apps/mobile/e2e/terms-popularity.yaml` | `apps/mobile/e2e/terms-taste-profile-consent.yaml` |
| `docs/features/POPULARITY-TRACKING.md` | `docs/features/POPULARITY-AND-TASTE-PROFILE.md` |

`apps/api/Dockerfile` copies all of `apps/api/legal/`, so the folder rename needs no Docker edit.
Update `BUNDLED_FROM_MODULE` in the content module to `'../../../legal/taste-profile-agreement'`.

### Symbols

| Old | New |
| --- | --- |
| `PopularityTrackingDecision` | `TasteProfileConsentDecision` |
| `POPULARITY_TRACKING_AGREEMENT_VERSION_MAX_LENGTH` | `TASTE_PROFILE_AGREEMENT_VERSION_MAX_LENGTH` |
| `isPopularityTrackingAllowed` | `isTasteProfileTrackingAllowed` |
| `isPopularityTrackingPromptRequired` | `isTasteProfileConsentPromptRequired` |
| `PopularityTrackingChoice` | `TasteProfileConsentChoice` |
| `getPopularityTrackingChoice` | `getTasteProfileConsentChoice` |
| `isPopularityTrackingOptOutDestructive` | `isTasteProfileConsentOptOutDestructive` |
| `DTOPopularityTrackingAgreement` | `DTOTasteProfileAgreement` |
| `DTOAccountDataExportPopularityTracking` | `DTOAccountDataExportListeningData` |
| `emptyPopularityTracking` (ORM `listeningDataExport.ts`) | `emptyListeningData` |
| `reqLegalPopularityTracking` | `reqLegalTasteProfileAgreement` |
| `resolvePopularityTrackingContentDir` | `resolveTasteProfileAgreementContentDir` |
| `interpolatePopularityTrackingMarkdown` | `interpolateTasteProfileAgreementMarkdown` |
| `resolvePopularityTrackingMarkdownPath` | `resolveTasteProfileAgreementMarkdownPath` |
| `loadPopularityTrackingMarkdown` | `loadTasteProfileAgreementMarkdown` |
| Error text `'Popularity tracking agreement file is not available'` | `'Taste Profile agreement file is not available'` |
| `PopularityTrackingLegalController` | `TasteProfileAgreementLegalController` |
| `POPULARITY_TRACKING_NOT_ALLOWED_BODY` | `TASTE_PROFILE_CONSENT_REQUIRED_BODY` |
| `PopularityTrackingPage` | `TasteProfileAgreementPage` |
| `PopularityAgreementGate` | `TasteProfileAgreementGate` |
| `ModalPopularityTrackingOptOut` | `ModalTasteProfileConsentOptOut` |
| `SettingsListenStats` | `SettingsTasteProfileConsentSwitch` |
| `PopularityTrackingStatusKey`, `popularityTrackingStatusKey` | `TasteProfileConsentStatusKey`, `tasteProfileConsentStatusKey` |
| `isPopularityTrackingPromptRequiredForAccount` | `isTasteProfileConsentPromptRequiredForAccount` |
| `showPopularity` (`AppChrome.tsx`) | `showTasteProfileConsent` |
| `currentPopularityTrackingVersion` | `currentTasteProfileAgreementVersion` |
| `syncPopularityTrackingVersion` | `syncTasteProfileAgreementVersion` |
| `canSendPopularityReports` | `canSendStatsReports` |
| `setPopularityTrackingCurrentVersion`, `getPopularityTrackingCurrentVersion` | `setTasteProfileAgreementCurrentVersion`, `getTasteProfileAgreementCurrentVersion` |
| `PopularityTrackingAgreementBody` | `TasteProfileAgreementBody` |
| `PopularityTrackingOptOutPanel` | `TasteProfileConsentOptOutPanel` |
| `MoreSettingsPopularityTrackingScreen` | `MoreSettingsTasteProfileScreen` |
| `AccountConsentPhase` value `'popularity'` | `'taste-profile-consent'` |
| `accountConsentPhase` inputs `popularityLoadFailed`, `popularityVersion` | `tasteProfileAgreementLoadFailed`, `tasteProfileAgreementVersion` |
| `TermsAcceptanceProvider` state `popularityAgreement`, `popularityLoading`, `popularityErrorKey`, `popularityReloadKey`, `popularityOptOutConfirming`, `popularityVersion`, `popularityLoadFailed`, `popularityBodyLoading`, `handlePopularityDecision` | `tasteProfileAgreement`, `tasteProfileAgreementLoading`, `tasteProfileConsentErrorKey`, `tasteProfileAgreementReloadKey`, `tasteProfileOptOutConfirming`, `tasteProfileAgreementVersion`, `tasteProfileAgreementLoadFailed`, `tasteProfileAgreementBodyLoading`, `handleTasteProfileConsentDecision` |
| `popularityAllowed` (`MoreSettingsScreen.tsx`) | `tasteProfileAllowed` |
| Log tags `[PopularityAgreementGate]`, `[SettingsListenStats]` | `[TasteProfileAgreementGate]`, `[SettingsTasteProfileConsentSwitch]` |

`isTasteProfileTrackingAllowed` says "tracking" on purpose: it answers whether listens may be
recorded, not whether a prompt shows. Rename every local variable or prop that holds one of these
values in the same files (for example `popularityAgreement` props) to the matching new form.

`TASTE_PROFILE_CONSENT_REQUIRED_BODY` keeps the message `'Listen stats tracking is disabled for
this account'`. No client reads the code (web and mobile branch on the HTTP status), so the code
change needs only the API, its OpenAPI text, and `stats.track.test.ts`.

### Test ids

| Old | New |
| --- | --- |
| Web `AgreementScreen` `testId="popularity-agreement"` | `testId="taste-profile-agreement"` |
| Web switch `id: 'popularity-tracking'` | `id: 'taste-profile-consent'` |
| `popularity-tracking-prompt` | `taste-profile-consent-prompt` |
| `popularity-tracking-yes`, `-no`, `-full-agreement` | `taste-profile-consent-yes`, `-no`, `-full-agreement` |
| `popularity-tracking-opt-out-panel`, `-cancel`, `-confirm` | `taste-profile-consent-opt-out-panel`, `-cancel`, `-confirm` |
| `more-settings-popularity-tracking` (More Settings row) | `more-settings-taste-profile` |
| `more-settings-popularity-tracking-screen` | `more-settings-taste-profile-screen` |
| `more-settings-popularity-tracking-switch`, `-row`, `-more-info`, `-opt-out-dialog`, `-opt-out-cancel`, `-opt-out-confirm` | `more-settings-taste-profile-consent-switch`, `-row`, `-more-info`, `-opt-out-dialog`, `-opt-out-cancel`, `-opt-out-confirm` |
| `popularity-tracking-settings-full-agreement`, `-no`, `-yes`, `-info-loading`, `-info-error` | `taste-profile-consent-settings-full-agreement`, `-no`, `-yes`, `-info-loading`, `-info-error` |
| `e2e-quick-login-popularity` | `e2e-quick-login-taste-profile-undecided` |

`taste-profile-section` and `taste-profile-hidden-section` stay.

### Seed accounts and test constants

| Old | New |
| --- | --- |
| `E2E_POPULARITY_TRACKING_VERSION` (`tools/web/seed-e2e.mjs`) | `E2E_TASTE_PROFILE_AGREEMENT_VERSION` |
| `E2E_OUTDATED_POPULARITY_TRACKING_VERSION` | `E2E_OUTDATED_TASTE_PROFILE_AGREEMENT_VERSION` |
| `E2E_POPULARITY_UNDECIDED_EMAIL` (seed, mobile `e2eSeedConstants.ts`, web spec) | `E2E_TASTE_PROFILE_CONSENT_UNDECIDED_EMAIL` |
| `'e2e-popularity-undecided@example.com'` | `'e2e-taste-consent-undecided@example.com'` |
| `E2E_POPULARITY_STALE_EMAIL`, `E2E_POPULARITY_STALE_PASSWORD` | `E2E_TASTE_PROFILE_CONSENT_STALE_EMAIL`, `E2E_TASTE_PROFILE_CONSENT_STALE_PASSWORD` |
| `'e2e-popularity-stale@example.com'` | `'e2e-taste-consent-stale@example.com'` |
| Seed locals `popularityStale*` | `tasteProfileConsentStale*` |
| `'popularity-tracking-test@example.com'` (API test) | `'taste-profile-agreement-test@example.com'` |
| `'popularity-opt-out-'` email prefix (API test) | `'taste-consent-opt-out-'` |
| Web spec `POPULARITY_SCREEN_NAME` | `TASTE_PROFILE_SCREEN_NAME` (`'Taste Profile'`) |

Both new seed emails fit the column; seed emails are not `nano_id_v2` values. Update
`apps/mobile/e2e/scripts/auth-change-password.js`, which lists the undecided email among accounts
it must not touch.

### Maestro flows and area names

| Old | New |
| --- | --- |
| `popularity-tracking` area, `name: Popularity Tracking Gate` | `taste-profile-consent` area, `name: Taste Profile Consent Gate` |
| `terms-popularity` area, `name: Terms Then Popularity` | `terms-taste-profile-consent` area, `name: Terms Then Taste Profile Consent` |
| Screenshot names that start `popularity-tracking-` or `terms-popularity-` | `taste-profile-consent-`, `terms-taste-profile-consent-` |

Replace the two area names in `scripts/mobile/e2e-test.sh` `flow_needs_e2e_api` (put
`taste-profile-consent` after `taste-profile` and `terms-taste-profile-consent` after
`terms-account-access`), in `apps/mobile/e2e/HOW-TO-RUN.md`, in
`docs/testing/FULL-REPO-VERIFICATION-COMMANDS.md`, and in
`.cursor/skills/mobile-test-economics/SKILL.md`.

### i18n

| Old | New |
| --- | --- |
| Consumer namespace `popularity_tracking` | `taste_profile_consent` |
| `popularity_tracking.title` | dropped; use `taste_profile.title` |
| `popularity_tracking.learn_more`, `agreement_date`, `back_to_choice`, `change`, `dismiss_note` | dropped (no code reads them) |
| `taste_profile.description` | dropped; `taste_profile_consent.summary` takes its place |
| `settings.account.listen_stats_toggle`, `listen_stats_toggle_help`, `listen_stats_toggle_error`, `listen_stats_terms_link` | dropped (no code reads them, and they name the old opt-in) |
| `authentication.listen_stats_opt_in`, `listen_stats_opt_in_help` | dropped (same reason) |
| Mobile `e2e.quick_login_popularity` | `e2e.quick_login_taste_profile_undecided` (values unchanged) |

Keys that move into `taste_profile_consent` with the same name: `summary`, `yes`, `no`,
`how_it_works`, `retry`, `already_agreed`, `error`, `load_error`, `status_opted_out`,
`status_stale`, `status_undecided`, `opt_out_confirm_title`, `opt_out_confirm_body`,
`opt_out_confirm_action`. Every `useTranslations('popularity_tracking')` and every
`t('popularity_tracking.…')` becomes the new namespace, and every former `title` read becomes
`taste_profile.title`.

Edit only the four `originals/` files in the consumer and mobile layers. Never hand-edit
`overrides/`. Run `npm run i18n:compile` after editing originals; it rewrites the override files
so the old namespace's slots go away and the new ones appear empty. Every override value under
`popularity_tracking` and `taste_profile` is empty today, so nothing is lost. Commit the
regenerated overrides.

## Names that stay (R39)

These name public counts or stored columns, not the opt-in:

- Tables `stats_popularity_*` and every other `stats_*` table, column, and service, including
  `popularity_counted` and ranking code added by later plans.
- Migration files `0007_popularity_tracking_consent.sql` and `0025_popularity_tracking_foundation.sql`.
  Applied history; never rename or edit them.
- API `config.popularityTracking` with `dailyListenCap`, and the keys later plans add there
  (`listenMinIntervalSeconds`, `dailyOpenCap`, `flagTooSoonMinutes`, `allTimeRecountDays`).
- The startup-validation section label `'Popularity Tracking'` on `STATS_*` keys, and every
  `STATS_*` env key. The `STATS_LISTEN_DAILY_CAP` lines in `apps/api/ENV.md` and
  `dev/env-overrides/local/rate-limit.env.example` belong to plan 11; do not touch them.
- `account_settings` columns `allow_listen_stats`, `listen_stats_accepted`,
  `listen_stats_agreement_version`, `listen_stats_decided_at`, and the matching DTO fields.
- `PATCH /account-settings/listen-stats`, `reqAccountSettingsListenStatsUpdate`,
  `AccountSettingsListenStatsService`, `assertListenStatsAllowed`, `ListenStatsOptedOutError`,
  `syncAllowListenStatsToAccountSettings`, `shouldSkipListenStatsForAccount`,
  `isTrackingAllowedForUpdate`, and the top-level `allow_listen_stats` and `listen_stats_*` fields
  of the account data export.
- `POST /stats/listen`, `POST /stats/open`, `apps/web/src/utils/statsTracking/`, and
  `stats.track.test.ts`.
- The management Flagged Listeners page and the public sort labels such as
  `features.browse.sort_popularity`.
- The comment on line 3 of `0025_popularity_tracking_foundation.sql` keeps citing
  `docs/features/POPULARITY-TRACKING.md`. Applied migrations are never edited, so that one
  citation stays on the old path.
- `.cursor/rules/popularity-listener-id-separation.mdc` keeps its name; its doc citation moves
  (see Docs and guidance).
- The test `describe` in `stats-foundation-schema.integration.test.ts`, which names the 0025
  migration.
- `misc/aicasts/listener-privacy-1-popularity-tracking.md`, a published episode.
- Existing `release-notes/scratchpad.md` entries.
- The file names of `docs/proposals/mobile/_master-plan_/phase-2/details/722-popularity-tracking-consent.md`
  and its link in `001-MASTER-PLAN-PHASE-2.md`.

Lowercase "tracking" as an activity ("new records stop … until tracking is on again") stays in the
legal text. Only the capitalized feature name changes.

## Web Settings: one Taste Profile section

`SettingsAccount.tsx` drops `<SettingsListenStats />` and the `Divider` after it. Order becomes
Membership, Divider, Terms, Divider, Taste Profile, Divider.

`SettingsTasteProfileConsentSwitch` (renamed from `SettingsListenStats`) renders only the
`SwitchButton` and `ModalTasteProfileConsentOptOut`. No `SettingsSection`, no heading. Props:
`{ describedById: string }`. The switch:

- `id: 'taste-profile-consent'`, `label: t('title')` from `useTranslations('taste_profile')`,
  and the `SwitchButton` prop `'aria-describedby': describedById`.
- Keeps today's status popover when the choice is not `'allowed'`: `helpAriaLabel` stays
  `tMisc('more_info')`, and `helpText` reads `tasteProfileConsentStatusKey(choice)` from
  `taste_profile_consent`.
- Turning it on for an undecided or stale account still routes to `ROUTES.TASTE_PROFILE`.
- The version comes from `config.public.legal.tasteProfileAgreement.version`.

`SettingsTasteProfile.tsx` becomes one `SettingsSection` with two sibling `section` regions and no
`Divider` between them:

```tsx
<SettingsSection>
  <section aria-labelledby="settings-taste-profile-heading">
    <h3 className={styles.heading} id="settings-taste-profile-heading">
      {t('title')}
    </h3>
    <SettingsTasteProfileConsentSwitch describedById="settings-taste-profile-summary" />
    <p className={styles.description} id="settings-taste-profile-summary">
      {tConsent('summary', { brand_name: config.public.brand.name })}
    </p>
    {/* existing action-failed alert, then the Taste Profile list */}
  </section>
  <section aria-labelledby="settings-taste-profile-hidden-heading" className={styles.hiddenSection}>
    <h4 className={styles.subheading} id="settings-taste-profile-hidden-heading">
      {t('hidden_title')}
    </h4>
    <p className={styles.description}>{t('hidden_description')}</p>
    {/* existing hidden list */}
  </section>
</SettingsSection>
```

- `tConsent` is `useTranslations('taste_profile_consent')`. It replaces `tPopularity` and also
  supplies `retry`.
- Keep the two sibling regions. `settings-taste-profile.spec.ts` scopes lists by region name, and
  a nested region would put the hidden rows inside the profile region.
- In `SettingsTasteProfile.module.scss`, add `.subheading` matching `.heading` one font step
  smaller, and `.hiddenSection { margin-top: var(--spacing-3xl); }`. That gap matches the
  `SwitchButton` wrapper's bottom margin, so the section's spacing stays even. Use tokens only;
  no `var()` fallbacks.

## Mobile: the renamed screen

`MoreSettingsTasteProfileScreen` keeps the stack title `taste_profile.title` ("Taste Profile") and
this order:

1. `SettingsSwitchRow`, title `taste_profile.title`.
2. The summary `Text`: `t('taste_profile_consent.summary', { brand_name: mobileBrandName() })`.
3. More Info and its disclosures (`TasteProfileAgreementBody` or `CopyMarkdown`), unchanged.
4. `TasteProfileSections`, then the `ConfirmDialog`.

The switch row moves above the summary; today the summary comes first.

In `TasteProfileSections.tsx`, drop the profile block's `SectionHeading` and description `Text`.
The stack title already names the screen, and **mobile-screen-layout** forbids a second display
heading under it. The hidden block keeps its `SectionHeading` (`taste_profile.hidden_title`) and
its description. Both `View` test ids stay.

`MoreSettingsScreen.tsx` keeps its row (now `more-settings-taste-profile`), labeled
`taste_profile.title`. `navigation/index.tsx` renames the route, the screen import, and the param
list entry, and titles the screen `taste_profile.title`.

## Copy

English chrome is title case and sentences stay sentence case (**ui-copy-casing**). The localized
names are "Perfil de gustos", "Profil de goûts", and "Προφίλ γούστου". The catalogs write them in
lowercase mid-sentence ("tu perfil de gustos"), and the legal files capitalize them ("tu Perfil de
gustos"). Follow each file's existing casing.

### `taste_profile_consent` and the changed `taste_profile` keys

`already_agreed`, `how_it_works`, and `retry` keep today's values in every locale.

en-US:

| Key | Value |
| --- | --- |
| `summary` | {brand_name} tracks your listens to build your Taste Profile. Those listens also count toward public popularity rankings, without your name. |
| `yes` | Yes, Build My Taste Profile |
| `no` | No Thanks |
| `error` | Could not save your Taste Profile choice. Please try again. |
| `load_error` | Could not load how Taste Profile works. Please try again. |
| `status_opted_out` | Taste Profile is off. |
| `status_stale` | How Taste Profile works has changed. It stays off until you turn it on again. |
| `status_undecided` | You have not chosen whether to turn on Taste Profile. |
| `opt_out_confirm_title` | Turn Off Taste Profile? |
| `opt_out_confirm_body` | Your Taste Profile, your Hidden From Taste Profile list, and your stored listening history will be deleted right away. If you turn Taste Profile on again later, your recommendations will start from scratch. Public listen totals that already include your listens stay as they are. |
| `opt_out_confirm_action` | Turn Off and Delete |
| `taste_profile.empty` | No shows yet. Shows appear here after you listen with Taste Profile on. |
| `taste_profile.hidden_description` | Shows you removed. Removing a show deletes its listening data, and listening to it does not add it back. Unhide a show to add it back now or to let your next listen add it. |

es:

| Key | Value |
| --- | --- |
| `summary` | {brand_name} registra tus escuchas para crear tu perfil de gustos. Esas escuchas también cuentan para las clasificaciones públicas de popularidad, sin tu nombre. |
| `yes` | Sí, crear mi perfil de gustos |
| `no` | No, gracias |
| `error` | No se pudo guardar tu elección del perfil de gustos. Inténtalo de nuevo. |
| `load_error` | No se pudo cargar cómo funciona el perfil de gustos. Inténtalo de nuevo. |
| `status_opted_out` | El perfil de gustos está desactivado. |
| `status_stale` | Ha cambiado cómo funciona el perfil de gustos. Permanece desactivado hasta que lo vuelvas a activar. |
| `status_undecided` | Aún no has elegido si activas el perfil de gustos. |
| `opt_out_confirm_title` | ¿Desactivar el perfil de gustos? |
| `opt_out_confirm_body` | Tu perfil de gustos, tu lista Oculto del perfil de gustos y tu historial de escucha guardado se borrarán de inmediato. Si vuelves a activar el perfil de gustos más adelante, tus recomendaciones empezarán desde cero. Los totales públicos de escuchas que ya incluyen tus escuchas se quedan como están. |
| `opt_out_confirm_action` | Desactivar y borrar |
| `taste_profile.empty` | Aún no hay programas. Aparecen aquí cuando escuchas con el perfil de gustos activado. |
| `taste_profile.hidden_description` | Programas que quitaste. Quitar un programa borra sus datos de escucha, y escucharlo no lo vuelve a añadir. Muestra de nuevo un programa para añadirlo ahora o para que tu próxima escucha lo añada. |

fr:

| Key | Value |
| --- | --- |
| `summary` | {brand_name} enregistre vos écoutes pour créer votre profil de goûts. Ces écoutes comptent aussi dans les classements publics de popularité, sans votre nom. |
| `yes` | Oui, créer mon profil de goûts |
| `no` | Non merci |
| `error` | Impossible d'enregistrer votre choix pour le profil de goûts. Veuillez réessayer. |
| `load_error` | Impossible de charger le fonctionnement du profil de goûts. Veuillez réessayer. |
| `status_opted_out` | Le profil de goûts est désactivé. |
| `status_stale` | Le fonctionnement du profil de goûts a changé. Il reste désactivé jusqu'à ce que vous le réactiviez. |
| `status_undecided` | Vous n'avez pas encore choisi d'activer le profil de goûts. |
| `opt_out_confirm_title` | Désactiver le profil de goûts ? |
| `opt_out_confirm_body` | Votre profil de goûts, votre liste Masqué du profil de goûts et votre historique d'écoute enregistré seront supprimés immédiatement. Si vous réactivez le profil de goûts plus tard, vos recommandations repartiront de zéro. Les totaux d'écoute publics qui incluent déjà vos écoutes restent inchangés. |
| `opt_out_confirm_action` | Désactiver et supprimer |
| `taste_profile.empty` | Aucune émission pour l'instant. Elles apparaissent ici quand vous écoutez avec le profil de goûts activé. |
| `taste_profile.hidden_description` | Émissions que vous avez retirées. Retirer une émission supprime ses données d'écoute, et l'écouter ne l'ajoute pas à nouveau. Réaffichez une émission pour l'ajouter maintenant ou pour que votre prochaine écoute l'ajoute. |

el-GR:

| Key | Value |
| --- | --- |
| `summary` | Το {brand_name} καταγράφει τις ακροάσεις σας για να δημιουργήσει το προφίλ γούστου σας. Αυτές οι ακροάσεις μετρούν επίσης στις δημόσιες κατατάξεις δημοτικότητας, χωρίς το όνομά σας. |
| `yes` | Ναι, δημιουργήστε το προφίλ γούστου μου |
| `no` | Όχι, ευχαριστώ |
| `error` | Δεν ήταν δυνατή η αποθήκευση της επιλογής σας για το προφίλ γούστου. Δοκιμάστε ξανά. |
| `load_error` | Δεν ήταν δυνατή η φόρτωση του τρόπου λειτουργίας του προφίλ γούστου. Δοκιμάστε ξανά. |
| `status_opted_out` | Το προφίλ γούστου είναι απενεργοποιημένο. |
| `status_stale` | Ο τρόπος λειτουργίας του προφίλ γούστου άλλαξε. Παραμένει απενεργοποιημένο μέχρι να το ενεργοποιήσετε ξανά. |
| `status_undecided` | Δεν έχετε επιλέξει ακόμη αν θα ενεργοποιήσετε το προφίλ γούστου. |
| `opt_out_confirm_title` | Απενεργοποίηση του προφίλ γούστου; |
| `opt_out_confirm_body` | Το προφίλ γούστου σας, η λίστα Κρυμμένο από το προφίλ γούστου και το αποθηκευμένο ιστορικό ακρόασής σας θα διαγραφούν αμέσως. Αν ενεργοποιήσετε ξανά το προφίλ γούστου αργότερα, οι προτάσεις σας θα ξεκινήσουν από την αρχή. Τα δημόσια σύνολα ακροάσεων που περιλαμβάνουν ήδη τις ακροάσεις σας μένουν ως έχουν. |
| `opt_out_confirm_action` | Απενεργοποίηση και διαγραφή |
| `taste_profile.empty` | Δεν υπάρχουν ακόμη εκπομπές. Εμφανίζονται εδώ όταν ακούτε με ενεργό το προφίλ γούστου. |
| `taste_profile.hidden_description` | Εκπομπές που αφαιρέσατε. Η αφαίρεση μιας εκπομπής διαγράφει τα δεδομένα ακρόασής της, και η ακρόασή της δεν την προσθέτει ξανά. Επανεμφανίστε μια εκπομπή για να την προσθέσετε τώρα ή για να την προσθέσει η επόμενη ακρόασή σας. |

### Legal Markdown

Each paragraph is one line; keep it one line. Do not change `TASTE_PROFILE_AGREEMENT_VERSION` or
`TERMS_OF_SERVICE_VERSION`: the documents describe the same recording under a new name.

Later plans find their edits by these anchors, so keep them word for word: the "How a Listen Is
Counted" and "What the Lists Show" headings and their paragraphs, the "There is a daily limit on
how many listens count." sentence, and the terms paragraph that starts "When it is on" (`es`
"Cuando está activado", `fr` "Lorsqu'il est activé"). The one anchor that changes is el-GR's:
"Όταν είναι ενεργή" becomes "Όταν είναι ενεργό" so it agrees with the neuter name. Change only
that word on el-GR terms line 27.

**Agreement, `apps/api/legal/taste-profile-agreement/<locale>.md`.** Replace line 1 with:

- en-US: "Taste Profile is optional. It is available with a Premium membership. When it is on,
  {brand_name} tracks your listens to build your Taste Profile, so recommendations can reflect the
  shows you listen to. Those listens also count toward public popularity rankings without your
  name, which helps listeners find shows people are enjoying and helps creators see when their
  work is reaching people."
- es: "El Perfil de gustos es opcional. Está disponible con una membresía Premium. Cuando está
  activado, {brand_name} registra tus escuchas para crear tu Perfil de gustos, para que las
  recomendaciones puedan reflejar los programas que escuchas. Esas escuchas también cuentan para
  las clasificaciones públicas de popularidad sin tu nombre, lo que ayuda a los oyentes a
  encontrar programas que la gente está disfrutando y ayuda a los creadores a ver cuándo su
  trabajo llega a las personas."
- fr: "Le Profil de goûts est optionnel. Il est disponible avec un abonnement Premium. Lorsqu'il
  est activé, {brand_name} enregistre vos écoutes pour créer votre Profil de goûts, afin que les
  recommandations puissent refléter les émissions que vous écoutez. Ces écoutes comptent aussi
  dans les classements publics de popularité, sans votre nom, ce qui aide les auditeurs à trouver
  des émissions que les gens apprécient et aide les créateurs à voir quand leur travail atteint
  des personnes."
- el-GR: "Το Προφίλ γούστου είναι προαιρετικό. Είναι διαθέσιμο με συνδρομή Premium. Όταν είναι
  ενεργό, το {brand_name} καταγράφει τις ακροάσεις σας για να δημιουργήσει το Προφίλ γούστου σας,
  ώστε οι προτάσεις να μπορούν να αντικατοπτρίζουν τις εκπομπές που ακούτε. Αυτές οι ακροάσεις
  μετρούν επίσης στις δημόσιες κατατάξεις δημοτικότητας χωρίς το όνομά σας, κάτι που βοηθά τους
  ακροατές να βρίσκουν εκπομπές που απολαμβάνει ο κόσμος και τους δημιουργούς να βλέπουν πότε η
  δουλειά τους φτάνει σε ανθρώπους."

Then replace the remaining feature-name mentions: en-US line 11 "If Popularity Tracking is off" →
"If Taste Profile is off", line 41 "until you turn Popularity Tracking off" → "until you turn
Taste Profile off". In es, fr, and el-GR, the same sentences name "el seguimiento de popularidad",
"le suivi de popularité", and "η παρακολούθηση δημοτικότητας"; use "el Perfil de gustos", "le
Profil de goûts", and "το Προφίλ γούστου". Spanish and French keep their pronoun and adjective
genders. In Greek the name goes from feminine to neuter, so every pronoun and adjective that
refers to the feature changes with it (for example "την ενεργοποιήσετε" → "το ενεργοποιήσετε",
"απενεργοποιημένη" → "απενεργοποιημένο"). In the el-GR agreement that means line 3 ("Αν την
ενεργοποιήσετε", "να την απενεργοποιήσετε") and line 49 ("Αν την ενεργοποιήσετε αργότερα"). A
lowercase "η παρακολούθηση" that means the activity, as on lines 51 and 53, stays.

**Terms, `apps/api/legal/terms/<locale>.md`.**

- The heading on line 23: "## Popularity Tracking" → "## Taste Profile"; es "## Perfil de gustos";
  fr "## Profil de goûts"; el-GR "## Προφίλ γούστου".
- Line 25 en-US becomes: "Taste Profile is an optional feature. It is available with a Premium
  membership. It is built from your listens, and those listens also count toward public
  popularity rankings without your name. It stays off until you turn it on, and you can turn it
  off in account settings. Turning it off does not limit playback, your account, or a membership."
- Line 25 es: "El Perfil de gustos es una función opcional. Está disponible con una membresía
  Premium. Se crea a partir de tus escuchas, y esas escuchas también cuentan para las
  clasificaciones públicas de popularidad sin tu nombre. Permanece desactivado hasta que lo
  actives, y puedes desactivarlo en la configuración de la cuenta. Desactivarlo no limita la
  reproducción, tu cuenta ni una membresía."
- Line 25 fr: "Le Profil de goûts est une fonctionnalité optionnelle. Il est disponible avec un
  abonnement Premium. Il se construit à partir de vos écoutes, et ces écoutes comptent aussi dans
  les classements publics de popularité, sans votre nom. Il reste désactivé jusqu'à ce que vous
  l'activiez, et vous pouvez le désactiver dans les paramètres du compte. Le désactiver ne limite
  pas la lecture, votre compte, ni un abonnement."
- Line 25 el-GR: "Το Προφίλ γούστου είναι μια προαιρετική λειτουργία. Είναι διαθέσιμο με συνδρομή
  Premium. Δημιουργείται από τις ακροάσεις σας, και αυτές οι ακροάσεις μετρούν επίσης στις
  δημόσιες κατατάξεις δημοτικότητας χωρίς το όνομά σας. Παραμένει απενεργοποιημένο μέχρι να το
  ενεργοποιήσετε, και μπορείτε να το απενεργοποιήσετε στις ρυθμίσεις λογαριασμού. Η
  απενεργοποίησή του δεν περιορίζει την αναπαραγωγή, τον λογαριασμό σας ή μια συνδρομή."
- Line 35 en-US "until you turn Popularity Tracking off" → "until you turn Taste Profile off".
- Line 37 en-US "Turning Popularity Tracking off asks you to confirm." → "Turning Taste Profile off
  asks you to confirm."
- In es, fr, and el-GR lines 35 and 37, swap the name the same way. In el-GR also change the
  pronouns and adjectives on line 37 that refer to the feature ("Αν την ενεργοποιήσετε αργότερα",
  "Αν την απενεργοποιήσετε", "Αν την ενεργοποιήσετε") to the neuter "το".
- Line 37 el-GR opens "Η απενεργοποίηση της παρακολούθησης δημοτικότητας ζητά επιβεβαίωση." →
  "Η απενεργοποίηση του Προφίλ γούστου ζητά επιβεβαίωση." Its "μέχρι η παρακολούθηση να είναι
  ξανά ενεργή" and closing "η παρακολούθηση μένει απενεργοποιημένη" mean the activity and stay.
- Line 27 ("When it is on…") and line 29 ("{legal_name} also keeps a Taste Profile…") do not
  change, except the single el-GR word on line 27 named above.

## API, OpenAPI, and env

- `apps/api/src/config/index.ts`: add `tasteProfileAgreement`; remove `version` and `contentDir`
  from `popularityTracking`.
- `apps/api/src/lib/startup/validation.ts`: `validateRequired('TASTE_PROFILE_AGREEMENT_VERSION',
  'Legal')` and `validateOptional('TASTE_PROFILE_AGREEMENT_CONTENT_DIR', 'Legal')` in place of the
  old keys, same position.
- Rename the keys, keeping their position and values, in `apps/api/.env.example`,
  `apps/api/ENV.md` (rewrite those rows' prose to say "Taste Profile agreement"),
  `infra/k8s/base/api/source/api.env`, `dev/env-overrides/local/legal.env.example`,
  `packages/helpers-config/src/podverseTestEnv.ts`, `apps/web/sidecar/.env.example`,
  `apps/web/sidecar/src/server.ts` (required key list and runtime config output),
  `infra/k8s/base/web/source/web-sidecar.env`, `apps/web/playwright.e2e-server-env.ts`,
  `apps/web/src/config/index.ts`, and `apps/web/src/config/runtime-config.ts`.
- `scripts/local-env/setup.sh`: the legal var loop and the `NEXT_PUBLIC_…` upsert into the web env
  files use the new names.
- `apps/api/openapi.yml`: the path, operationId, schema name, and every description that names the
  opt-in (account settings `listen_stats_*` descriptions, the listen-stats PATCH, and the
  stats listen and open descriptions and their 403 code). Descriptions say "Taste Profile" for
  the opt-in and "public popularity counts" for the counts.
- `apps/api/src/controllers/stats/statsListen.ts`, `statsOpen.ts`, and
  `controllers/account/accountSettings/accountSettingsListenStats.ts`: read
  `config.tasteProfileAgreement.version`; `daily_cap` still reads
  `config.popularityTracking.dailyListenCap`.
- `apps/api/src/lib/legal/listenStats.ts`: `config.tasteProfileAgreement.version`.
- Comments in files this plan touches that call the opt-in "Popularity Tracking" now say "Taste
  Profile consent". Comments that cite `docs/features/POPULARITY-TRACKING.md` cite
  `docs/features/POPULARITY-AND-TASTE-PROFILE.md` (see Docs and guidance).

## Docs and guidance

- `git mv docs/features/POPULARITY-TRACKING.md docs/features/POPULARITY-AND-TASTE-PROFILE.md`, and
  change its H1 to `# Popularity and Taste Profile`. The intro describes the stats system and says
  the opt-in is called Taste Profile. The consent sections use the new symbol names, the route
  `GET /legal/taste-profile-agreement`, and the export key `listening_data`. Public counts keep the
  popularity wording.
- Point every citation of the old path at `docs/features/POPULARITY-AND-TASTE-PROFILE.md`, except
  migration 0025 (see Names that stay):
  - `.cursor/rules/popularity-listener-id-separation.mdc` line 35
  - `apps/management-api/src/routes/stats.ts`
  - `apps/workers/src/commands/stats/statsEventPartitionsMaintain.ts`,
    `apps/workers/src/commands/stats/statsPopularityRefresh.ts`
  - `packages/orm/src/entities/stats/statsListenEvent.ts`,
    `packages/orm/src/entities/stats/statsTasteProfile.ts`
  - `packages/orm/src/services/stats/listenerIdentity/{listeningDataDeletion,statsListenWrite,statsListener,statsOpenWrite,statsWriteGuard}.ts`
  - `packages/orm/src/services/stats/popularity/{statsPopularityAccount,statsPopularityChannel,statsPopularityClip,statsPopularityItem,statsPopularityPlaylist}.ts`
  - `packages/orm/src/services/stats/statsPopularityRefresh.ts`
- `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md` line 364: "allows
  Popularity Tracking" → "has Taste Profile on".
- `docs/proposals/mobile/_master-plan_/phase-2/details/722-popularity-tracking-consent.md`,
  `754-server-managed-copy-endpoint.md`, `755-mobile-faq-and-clip-how-to.md`, and
  `756-web-faq-and-clip-preview-parity.md`: update the feature name, routes, and paths in the
  text; keep the file names.
- `.cursor/rules/server-managed-copy.mdc`: the endpoint, the slug note (`taste-profile-agreement`),
  and the feature name.
- `.cursor/rules/mobile-auth-refresh-terminates.mdc`: the glob `apps/mobile/src/popularityTracking/**`
  → `apps/mobile/src/tasteProfileConsent/**`, and the prose on line 20.
- `.cursor/rules/mobile-overlays-in-tree.mdc` line 93 and `.cursor/rules/mobile-screen-layout.mdc`
  line 405: the new component and screen names.
- `.cursor/rules/rule-index.mdc`: the popularity trigger reads "Popularity tracking, Taste Profile
  consent, listener ids, stats or taste tables".
- `.cursor/skills/mobile-test-economics/SKILL.md` lines 56–57: the new flow names.

## Files

Renamed (with their edits): every path in "Files and folders" above.

Edited:

- `packages/helpers/src/index.ts`, `packages/helpers/src/dtos/index.ts`,
  `packages/helpers/src/dtos/account/accountDataExport.ts`, `packages/helpers/src/lib/appRoutes.ts`,
  `packages/helpers/src/lib/copyMarkdown.test.ts`
- `packages/helpers-requests/src/api/_request.ts`
- `packages/helpers-config/src/podverseTestEnv.ts`
- `packages/orm/src/entities/account/accountSettings/accountSettings.ts`
- `packages/orm/src/services/account/accountSettings/accountSettingsListenStats.ts`
- `packages/orm/src/services/stats/listenerIdentity/statsWriteGuard.ts`
- `packages/orm/src/services/stats/listenerIdentity/listeningDataExport.ts`
- `packages/orm/src/services/stats/listenerIdentity/listeningDataDeletion.ts`
- `packages/orm/src/services/account/accountDataExport.ts`
- `packages/i18n-catalog/consumer/originals/{en-US,es,fr,el-GR}.json`
- `packages/i18n-catalog/mobile/originals/{en-US,es,fr,el-GR}.json`
- `packages/i18n-catalog/consumer/overrides/*` and `packages/i18n-catalog/mobile/overrides/*`
  (regenerated by `npm run i18n:compile` only)
- `apps/api/src/config/index.ts`, `apps/api/src/lib/startup/validation.ts`, `apps/api/.env.example`,
  `apps/api/ENV.md`, `apps/api/openapi.yml`
- `apps/api/legal/terms/{en-US,es,fr,el-GR}.md`
- `apps/api/src/routes/legal.ts`, `apps/api/src/lib/legal/listenStats.ts`,
  `apps/api/src/lib/legal/termsContent.test.ts`
- `apps/api/src/controllers/stats/statsListen.ts`, `apps/api/src/controllers/stats/statsOpen.ts`,
  `apps/api/src/controllers/account/accountSettings/accountSettingsListenStats.ts`
- `apps/api/src/test/stats.track.test.ts`, `apps/api/src/test/terms-acceptance-gate.test.ts`,
  `apps/api/src/test/stats-listen-write.integration.test.ts`
- `apps/web/src/components/App/AppChrome.tsx`, `apps/web/src/contexts/Account.tsx`
- `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsAccount.tsx`,
  `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsTasteProfile.tsx`
- `apps/web/src/styles/components/Settings/Panels/SettingsAccount/SettingsTasteProfile.module.scss`
- `apps/web/src/config/index.ts`, `apps/web/src/config/runtime-config.ts`
- `apps/web/src/utils/statsTracking/statsTracking.ts`,
  `apps/web/src/utils/statsTracking/statsTracking.test.ts`
- `apps/web/src/components/MediaPlayer/MEDIA-PLAYER-DECISION-MATRIX.md`
- `apps/web/sidecar/.env.example`, `apps/web/sidecar/src/server.ts`,
  `apps/web/playwright.e2e-server-env.ts`
- `apps/web/e2e/settings-taste-profile.spec.ts`, `apps/web/e2e/helpers/legalConsent.ts`
- `apps/mobile/src/screens/more/TasteProfileSections.tsx`,
  `apps/mobile/src/screens/more/MoreSettingsScreen.tsx`, `apps/mobile/src/navigation/index.tsx`
- `apps/mobile/src/terms/TermsAcceptanceProvider.tsx`, `apps/mobile/src/terms/accountConsentPhase.ts`,
  `apps/mobile/src/terms/accountConsentPhase.test.ts`
- `apps/mobile/src/data/repositories/statsRepository.ts`, `apps/mobile/src/playback/PlaybackProvider.tsx`,
  `apps/mobile/src/hooks/useTasteProfileLists.ts`
- `apps/mobile/src/lib/e2e/e2eSeedConstants.ts`, `apps/mobile/src/lib/e2e/E2eQuickLogin.tsx`
- `apps/mobile/e2e/taste-profile.yaml`, `apps/mobile/e2e/terms-account-access.yaml`,
  `apps/mobile/e2e/scripts/auth-change-password.js`, `apps/mobile/e2e/HOW-TO-RUN.md`
- `infra/k8s/base/api/source/api.env`, `infra/k8s/base/web/source/web-sidecar.env`
- `dev/env-overrides/local/legal.env.example`, `scripts/local-env/setup.sh`,
  `scripts/mobile/e2e-test.sh`, `tools/web/seed-e2e.mjs`
- `docs/testing/FULL-REPO-VERIFICATION-COMMANDS.md`
- The sixteen source files and the rule listed under Docs and guidance that cite the feature doc
  (comment and citation edits only)
- `docs/proposals/mobile/_master-plan_/phase-2/details/{722-popularity-tracking-consent,754-server-managed-copy-endpoint,755-mobile-faq-and-clip-how-to,756-web-faq-and-clip-preview-parity}.md`
- `.cursor/rules/{server-managed-copy,mobile-auth-refresh-terminates,mobile-overlays-in-tree,mobile-screen-layout,rule-index}.mdc`
- `.cursor/skills/mobile-test-economics/SKILL.md`
- `release-notes/scratchpad.md`

### Self-check before finishing

From the repo root, this search must print only the kept names listed under "Names that stay"
(the two migration files and mentions of them, including migration 0025's doc citation,
`popularity-listener-id-separation`, `config.popularityTracking` and its cap keys, the
`'Popularity Tracking'` validation label, the aicast, the 722 file name and its link, the 0025
test `describe`, and old scratchpad entries):

```bash
rg -n -i 'popularity[-_ ]?tracking|PopularityAgreement|POPULARITY_TRACKING|popularity-agreement|quick_login_popularity|terms-popularity|E2E_POPULARITY' --hidden -g '!node_modules' -g '!.git' -g '!.llm' -g '!.artifacts' -g '!**/dist/**' .
```

Also check that no new name collides: `rg -n 'TasteProfileAgreement|TasteProfileConsent|taste_profile_consent'`
must show only the names in this plan.

And `rg -n 'POPULARITY-TRACKING\.md' --hidden -g '!node_modules' -g '!.git' -g '!.llm' .` must print
only line 3 of `0025_popularity_tracking_foundation.sql`.

## Tests

Agents write and update these; the operator runs them.

- `packages/helpers/src/lib/tasteProfileConsent.test.ts`: the renamed symbols; same cases.
- `packages/helpers/src/lib/copyMarkdown.test.ts`: the "# Popularity Tracking" fixture heading
  becomes "# Taste Profile".
- `apps/api/src/test/legal-taste-profile-agreement.test.ts`: `describe('GET
  /legal/taste-profile-agreement')`, the new path, and the opening sentences "Taste Profile is
  optional", "El Perfil de gustos es opcional", "Le Profil de goûts est optionnel", "Το Προφίλ
  γούστου είναι προαιρετικό". Add an assertion that the en-US markdown contains "count toward
  public popularity rankings".
- `apps/api/src/lib/legal/termsContent.test.ts`: the per-locale heading becomes "## Taste Profile",
  "## Perfil de gustos", "## Profil de goûts", "## Προφίλ γούστου", and the notice becomes each
  locale's new line-25 opening ("Taste Profile is an optional feature", and so on). Rename the
  test to "serves Taste Profile as optional in every locale".
- `apps/api/src/test/terms-acceptance-gate.test.ts`: `toContain('## Taste Profile')` and the new
  legal path.
- `apps/api/src/test/stats.track.test.ts`: code `taste_profile_consent_required` and
  `config.tasteProfileAgreement.version`.
- `apps/api/src/test/taste-profile-consent-opt-out.integration.test.ts`: the config path and email
  prefix.
- `apps/api/src/test/account-data-export-listening-data.integration.test.ts`:
  `result.listening_data.*`, and assert `result.popularity_tracking` is undefined.
- `apps/api/src/test/stats-listen-write.integration.test.ts`: the test title says "turned Taste
  Profile off".
- `apps/web/src/utils/statsTracking/statsTracking.test.ts`: the renamed functions.
- `apps/mobile/src/terms/accountConsentPhase.test.ts`: phase `'taste-profile-consent'` and the
  renamed inputs.
- `apps/web/e2e/taste-profile-consent.spec.ts`: main region "Taste Profile", the button "Yes,
  Build My Taste Profile", the text "Taste Profile is optional", URL `/taste-profile`, the route
  glob `**/api/v2/legal/taste-profile-agreement`, the dialog "Turn Off Taste Profile?", the new
  seed constants, and step text that says Taste Profile.
- `apps/web/e2e/settings-taste-profile.spec.ts`: the switch is found inside the Taste Profile
  region (`profile.getByRole('switch', { name: 'Taste Profile' })`), the summary text "tracks your
  listens to build your Taste Profile" is visible in that region, the new empty text and dialog
  title, and the Settings account panel shows no other heading named "Taste Profile". Pass the
  verified element to the capture helper.
- `apps/mobile/e2e/taste-profile-consent.yaml`, `terms-taste-profile-consent.yaml`, and
  `taste-profile.yaml`: the new test ids and screenshot names. `taste-profile.yaml` asserts
  `more-settings-taste-profile-consent-switch` is visible above `taste-profile-section`.

## Release scratchpad

Append:

```markdown
## Popularity Tracking opt-in renamed to Taste Profile

- Surfaces: api, web, web sidecar, mobile, k8s base env, local env
- Change: the opt-in that records listens is now called Taste Profile in web, mobile, the served
  explanation, and the terms, in all four locales. Its summary says the app tracks your listens
  to build your Taste Profile and that those listens also count toward public popularity rankings
  without your name. Web Settings shows one Taste Profile section (switch, summary, shows list,
  Hidden From Taste Profile); the mobile screen has the same layout and is renamed Taste Profile.
  The web consent page moved from `/popularity-tracking` to `/taste-profile` with no redirect. The
  API route moved from `GET /legal/popularity-tracking` to `GET /legal/taste-profile-agreement`.
  The listen and open 403 code is now `taste_profile_consent_required`. The account data export
  key `popularity_tracking` is now `listening_data`. Env keys renamed:
  `POPULARITY_TRACKING_AGREEMENT_VERSION` → `TASTE_PROFILE_AGREEMENT_VERSION`,
  `POPULARITY_TRACKING_CONTENT_DIR` → `TASTE_PROFILE_AGREEMENT_CONTENT_DIR`,
  `NEXT_PUBLIC_POPULARITY_TRACKING_AGREEMENT_VERSION` →
  `NEXT_PUBLIC_TASTE_PROFILE_AGREEMENT_VERSION`. No agreement or terms version change, so nobody
  is asked again.
- Who notices: listeners see the new name and the merged Settings section; operators must rename
  env keys; anyone parsing the data export sees the new key
- Operator steps: rename the three keys in home `legal.env` overrides and in every deployed API
  and web-sidecar env and overlay (values unchanged), then run `make local_env_setup` locally.
  The API fails startup validation until `TASTE_PROFILE_AGREEMENT_VERSION` is set.
```
