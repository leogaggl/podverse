# Popularity Tracking rebuild: listen events, daily totals, and taste profiles

## Request

The operator's words, verbatim, split into paragraphs.

### First message (the question that led to this set)

How would you rate our analytics tracking for listener habits for popularity purposes on Podverse infrastructure? Down the road, we want to be able to use this data to help customize algorithms and let users know what they are most likely to like if they like something.

One of the most important requirements of this is that only paid premium members can have analytics tracked, and it's optional for them to do so to help maintain at least some integrity to prevent bots from being able to game the system for cheap or for free.

I am wondering if you think before we go live if we should improve our way of tracking to be more robust and long term than it is currently. Right now, we do an aggregate approach, which, while I think it may be practical, I am wondering if there is a better practice we should be investigating to. Have a more future-forward and more powerful way of using these analytics in the future.

Note that it is important that we have these anonymized IDs as we don't want to make it easy to see who is listening to what through this tracking method, but it can be tracked back to the user. So it's not ultimate privacy, but it is a layer of privacy. We need to maintain that. Do you think this system, as we have it designed, will be good enough for that approach?

We are also concerned about accumulating rows forever that could get costly. So, that is a big part of why we even have the aggregation approach, is because we thought if we just endlessly create rows for analytics events for tracking purposes, it may fill up the database with too much data. But it seems like that data will be useful potentially down the line. For purposes of designing algorithms for the user.

And also, it may be that we want algorithms that are not just designed around what they have listened to all time, but also what they have listened to in recent times. Since that may be even more likely to give them a recommendation they are looking for at that moment. Will our current system be able to support these use cases? What would you propose for a better system? And should we go ahead with this migration before we ship this product from our OGen to next gen Podverse? Ask if you have any questions. I am thinking you should be able to understand the gist of what I am saying.

### Second message (after the design proposal below)

The operator quoted the assistant's open question, "Should turning tracking off delete the taste profile right away? I'd say yes, since it's a profile rather than a log.", then wrote:

I would say yes, but it should warn the user that this data will be removed in their history; if they enable it later, their recommendations will have to begin from scratch.

Actively ask questions if you are unsure about any functionality and what we will ultimately want.

## Design proposed in the chat, accepted as the starting point

The assistant reviewed the current system and proposed the design below. The operator chose to build its data foundation before launch (see Operator answers). Planners own the details; change any of it with a reason in `## Decisions`.

Three stores, each with its own lifetime and growth limit:

| Store | Linked to a listener? | Kept for | Grows with |
| --- | --- | --- | --- |
| Listen events | Yes, by a pseudonymous listener id | Retention setting (90 days) | Time; old data dropped by whole month |
| Taste profile: one row per listener id and show | Yes | Until opt-out or account deletion | Listeners × shows they played |
| Anonymous totals: daily counts per entity | No | Forever | Catalog size × days |

- **Listen events.** One row per counted listen, carrying the item, its channel, and the clip when there is one, instead of separate per-entity event tables. Store seconds heard and whether it finished. Partition by month (Postgres partitions) so retention drops a whole month instead of deleting rows.
- **Taste profile.** Per listener id and channel: listen count, completion count, first and last listen time, and two decaying scores. On each counted listen, each score is first faded by its age and then the listen is added: `score = score × 0.5^(days since last update / half-life) + weight`. A short half-life (about 14 days) answers "what they like right now"; a long one (about 180 days) answers "long-term taste". This covers recent versus all-time taste without keeping old events.
- **Daily totals.** One row per entity per day (listeners, completions), replacing the 17 rolling count columns. Any window is a sum, so nothing goes stale. Existing range sorts (day, week, month, all time) read from it.
- **Listener id.** Permanent, no rotation. Rotation and long-term personalization cannot coexist: rotation only protects anyone if it breaks the link to past listening, and long-term taste needs that link. The account-to-listener-id mapping is the privacy layer: chart and recommendation code never reads it.
- **Later, not in this set.** A nightly job turning taste profiles into show-to-show "also listened" scores (no listener ids, kept forever), and "Listeners Also Like" / "For You" surfaces built on them.

Rough cost from the chat: about 140 bytes per listen row with indexes; 10,000 opted-in listeners × 10 listens a day ≈ 14 MB a day, ≈ 1.3 GB at 90 days. Taste rows grow with listeners × shows, not time.

## Operator answers

- **Scope:** the data foundation only. Schedule the jobs, permanent listener id, listen events, daily totals, taste profiles, opt-out deletion with a warning, the taste profile settings UI below, and updated explanation and terms text. The "also listened" job and recommendation surfaces are later work.
- **What counts as a listen:** whichever comes first, 60 seconds heard or 25% of the item.
- **Turning tracking off:** asks first, with a warning that their listening data is removed and that recommendations would start from scratch if they turn it on later. On confirm, delete right away the taste profile, the Hidden From Taste Profile list, and that listener's raw listen events. Anonymous totals already counted stay.
- **Tracking stopping without the listener choosing it** (membership lapses, or a new explanation version is waiting to be confirmed): keep the taste profile paused. It resumes when tracking turns back on.
- **Raw listen event retention:** 90 days, as a server setting.
- **Taste profile granularity:** shows only (podcasts, albums, artists). Episodes and tracks are not profile rows.
- **Web profile and playlist opens:** keep recording them for popularity counts only. They never feed taste profiles. Mobile does not add them.
- **Anti-gaming:** a per-account rate limit on the tracking endpoints plus a daily cap on counted listens, both server settings. The planner picks the defaults.
- **Existing data:** drop the current stats tables and their data. Alpha testers' opt-ins reset when the explanation version changes. Import nothing from v4.
- **Listener-id separation:** a separate mapping table. Chart and recommendation jobs never read it, enforced in code and by a test. No new database role or credentials.
- **Taste profile visibility (operator's words):** "Yes, that list with per show removal, but if the user removes it, it should go into a separate section. That if they were to listen to that content in the future, it would not be automatically added back to their taste profile. But they will need the ability to see what is in their hidden from taste profile so that they can remove something they actually want in their taste profile in the future. When they press the remove from removed from taste profile feature, it should ask them, do you want to add it to your taste profile or do you just want to remove it from the blocked list? Or something to that effect."
- **Hiding a show deletes its taste data.** Its scores and counts are removed. "Add back" starts the show fresh, and later listens build it up again.
- **Listens to a hidden show still count toward public popularity totals.** Hiding affects only the taste profile.
- **Where the taste profile list appears:** web Settings and mobile Popularity Tracking settings, matching on both.
- **UI names:** "Taste Profile", with a "Hidden From Taste Profile" section.

### Review of the first planning pass

The operator reviewed D1–D55 in `00-SUMMARY.md` § Decisions to review.

- **Standing fact (applies to every plan):** "nothing is deployed to production; alpha and all devices can be wiped, so plan no compatibility paths or data migrations anywhere."
- **D14 kept:** "remove the five old routes as planned."
- **D26 changed (channel merge overlap):** "during a channel merge, remove duplicate listeners using stats_listen_event for every day still inside retention (count listeners with events on both copies on the same UTC day, per channel pair and per matched item pair, and subtract that overlap from the summed daily row); only days already past retention are summed without a check. Keep the journal so revert restores exact pre-merge rows."
- **D3 and D17 changed (one clock):** "use server receive time for both daily totals and taste score decay; remove listened_at from the listen request contract, the services, and the web and mobile senders."
- **D19 kept:** "keep 200 with daily_cap_reached."
- **D34 kept:** "keep client-only confirmation."
- **Everything else:** "All other decisions (D1-D55) are accepted as planned." D24 (listener-linked rows move on a merge without a journal) and D27 (the merge takes row locks, not per-listener locks) therefore stand alongside the D26 change.

## Glossary

- **OGen:** the legacy v4 Podverse (the `podverse-rn` app and its servers). "Next gen" is this monorepo.
- **Popularity Tracking:** the user-facing name of the opt-in. Stored fields keep the `listen_stats_*` names because mobile persists account snapshots on disk (**dto-changes-are-device-data-migrations**).
- **Anonymized id (the operator's term):** the pseudonymous listener id. User-facing copy must never call it anonymous or anonymized, because the company can link it back to the account. That rule comes from `.llm/plans/completed/popularity-tracking-how-it-works/` and `misc/aicasts/listener-privacy-1-popularity-tracking.md`.
- **Taste profile:** the per-listener, per-show rows described above. **Hidden From Taste Profile** is the listener's list of shows that listening never adds back.
- **Blocked list (the operator's term):** the Hidden From Taste Profile list.

## Orientation

Checked while writing this file; re-verify, since other work is landing in the tree.

### Current model

- Event tables `stats_track_event_{account,channel,clip,item,playlist}` and mapping `stats_track_account_guid` are in `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql` (search `CREATE TABLE public.stats_`). Each event row stores `account_guid`, the entity id, `created_at`, and `stats_track_account_guid_id`. Each table is unique on `(account_guid, <entity>_id)`. The mapping cascades from `account`, and events cascade from the mapping.
- `packages/orm/src/services/stats/statsTrackAccountGuid.ts` `getByAccountId` rotates `account_guid` when `updated_at` is over 7 days old. Event rows still carry the stable `stats_track_account_guid_id`, so rotation adds no privacy. It does let the same account count again for the same entity after each rotation, contradicting the explanation text.
- Aggregate tables `stats_aggregated_{account,channel,clip,item,playlist}` hold 17 rolling columns (`day_current_count` … `all_time_count`), maintained by `packages/orm/src/services/stats/baseStatsAggregated.ts`.
- `apps/workers/src/commands/stats/statsUpdateAggregated.ts` refreshes only the top 500 entities per type (`limit = 500`); anything that drops out keeps its last counts forever. It then calls `_deleteOldEvents` in `packages/orm/src/services/stats/baseStatsTrackEvent.ts`, which loads every expired row into memory before removing it. `statsUpdateAggregatedRolling.ts` is a partial variant with TODOs.
- **No schedule runs either command.** No CronJob in `infra/k8s/base/cron/` runs `statsUpdateAggregated`, and the alpha GitOps repo (`../k.podcastdj.com/apps/podverse-alpha`) has none either. Deployed counts never update and raw rows are never deleted, despite the explanation's retention promise. Cron pattern to copy: `infra/k8s/base/cron/worker-account-content-log-purge.cronjob.yaml`. Command registry: `packages/worker-commands/src/registry.ts`.

### Write path

- API routes: `apps/api/src/routes/stats.ts` (`POST /stats/{account,channel,clip,item,playlist}`), controllers in `apps/api/src/controllers/stats/`. Each checks `ensureAuthenticated` with `requiredCapability: ACCOUNT_ENTITLEMENT_CAPABILITY.trackStats`, then `assertListenStatsAllowed` (`apps/api/src/lib/legal/listenStats.ts`), which answers 403 when the account has not accepted the current version. These routes have no rate limit; the shared limiter is `apps/api/src/lib/rateLimiter.ts`.
- Entitlement defaults: `MEMBERSHIP_TRIAL_TRACK_STATS=false` and `MEMBERSHIP_PREMIUM_TRACK_STATS=true` in `infra/k8s/base/product-membership/source/product-membership-settings.env`. Resolution in `packages/helpers/src/lib/accountTrust.ts` (`trackStats`), with a per-account override in management-web.
- Web sends on `loadedmetadata`, not after listening: `apps/web/src/utils/statsTracking/statsTracking.ts`, called from `apps/web/src/components/MediaPlayer/Controller/NonLiveMediaOrchestrator.tsx` (see `MEDIA-PLAYER-DECISION-MATRIX.md` in that folder). Playlist opens: `apps/web/src/components/StatsTracking/StatsPageViewTrackers.tsx`.
- Mobile sends when playback-core's `shouldRecordPlaybackStat` is true (`packages/playback-core/src/resolvePlaybackLoadDecision.ts`; false for Add by RSS, music session restore, and enclosure switches): `apps/mobile/src/playback/PlaybackProvider.tsx` → `apps/mobile/src/data/repositories/statsRepository.ts`. Offline listens replay from `apps/mobile/src/data/repositories/playbackOutboxRepository.ts`, and the server stamps receive time, not listen time.
- Meaningful-playback rule and shared check: **playback-meaningful-events**, `isMeaningfulPlaybackEvent` in `@podverse/helpers`.

### Consent, copy, and settings

- Consent columns on `account_settings` (migration `0007_popularity_tracking_consent.sql`). `packages/orm/src/services/account/accountSettings/accountSettingsListenStats.ts` `update` records the decision and deletes nothing today. Gate helper: `packages/helpers/src/lib/popularityTracking.ts`.
- Version: `POPULARITY_TRACKING_AGREEMENT_VERSION` (`apps/api/src/config/index.ts`, `popularityTracking.version`). Bumping it turns every "yes" off until the listener confirms again; a "no" is never re-asked.
- Explanation text: `apps/api/legal/popularity-tracking/{en-US,es,fr,el-GR}.md`, served by `apps/api/src/lib/legal/popularityTrackingContent.ts` through `apps/api/src/routes/legal.ts`. `{retention_days}` comes from `STATS_TRACK_EVENT_RETENTION_DAYS` (`infra/k8s/base/api/source/api.env`, `infra/k8s/base/workers/source/workers.env`; web sidecar `NEXT_PUBLIC_STATS_TRACK_EVENT_RETENTION_DAYS` in `infra/k8s/base/web/source/web-sidecar.env`). Terms section: `apps/api/legal/terms/en-US.md` § Popularity Tracking. Training episode describing today's behavior: `misc/aicasts/listener-privacy-1-popularity-tracking.md`.
- Web settings: `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsListenStats.tsx`, `apps/web/src/app/popularity-tracking/page.tsx`, `apps/web/src/components/Legal/PopularityAgreementGate.tsx`, `apps/web/src/lib/popularityTrackingStatus.ts`. Playwright: `apps/web/e2e/popularity-tracking-consent.spec.ts`.
- Mobile settings: `apps/mobile/src/screens/more/MoreSettingsPopularityTrackingScreen.tsx`, `apps/mobile/src/popularityTracking/`, `syncAllowListenStatsToAccountSettings` in `apps/mobile/src/auth/syncAccountPrefs.ts`. Maestro: `apps/mobile/e2e/popularity-tracking.yaml`, `apps/mobile/e2e/terms-popularity.yaml`.

### Readers of the aggregate counts (all move to daily totals)

- Public range sorts: `apps/api/src/lib/stats.ts` `getStatsOrder` maps `day` / `week` / `month` / `all-time` to columns; `packages/helpers/src/lib/statsAggregatedCountField.ts`; `packages/orm/src/services/item/item.ts`.
- Management: `apps/management-api/src/routes/stats.ts` (raw SQL on `stats_aggregated_${entityType}`), `apps/management-api/src/lib/database/tablePolicy.ts`, `apps/management-web/src/app/(management)/stats/StatsPageClient.tsx`, `apps/management-web/e2e/stats-page.spec.ts`, `packages/management-api-requests/src/stats.ts`.
- Channel merge moves stats rows: `packages/orm/src/services/channel/applyChannelMerge.ts`, `channelMergeRowJournal.ts`.
- Dev seeding: `apps/workers/src/commands/stats/devStatsSeedSimulatedAggregated.ts`, `packages/helpers/src/lib/simulatedAggregatedStats.ts`.
- DTOs: `packages/helpers/src/dtos/stats/`.

### Rules that apply

- Linear migrations and generated baselines: **linear-baseline-0004**, **linear-sql-greenfield-only**, **migration-readiness-marker-sync**.
- Cross-surface: **cross-surface-change-impact**, **dto-changes-are-device-data-migrations** (`DTOAccount` is persisted on mobile).
- Copy: **server-managed-copy**, **i18n-user-facing-strings**, **ui-copy-casing**.
- API: **openapi-sync**, **api-testing**. Web: **e2e-page-tests**. Mobile: **mobile-test-economics**, **mobile-anonymous-vs-account-features** (expired membership is degraded, never frozen).
