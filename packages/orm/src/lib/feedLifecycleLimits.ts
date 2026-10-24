/**
 * VARCHAR lengths for feed lifecycle columns (`feed_lifecycle_state_type`,
 * `feed_lifecycle_state`, `feed_lifecycle_event`).
 *
 * `state_key` and `reason_key` are `character varying(64)`. `updated_by_source` and
 * `feed_lifecycle_event.source` are `character varying(16)`. Keep in sync with
 * `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql`.
 * That file is the DDL source of truth; these values are shared across ORM entities and API
 * validation in TypeScript.
 */
export const FEED_LIFECYCLE_REASON_KEY_MAX_LENGTH = 64;

export const FEED_LIFECYCLE_STATE_KEY_MAX_LENGTH = 64;

export const FEED_LIFECYCLE_UPDATE_SOURCE_MAX_LENGTH = 16;
