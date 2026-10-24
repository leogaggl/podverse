/**
 * Column width limits for management DB `admin_account_credentials`.
 * Keep aligned with:
 * - `varchar_email` (`VARCHAR(255)`) in
 *   `infra/k8s/base/ops/source/database/linear-migrations/management/0000_init_helpers.sql`
 * - `varchar_password` (`VARCHAR(60)`) — bcrypt hashes — in
 *   `infra/k8s/base/ops/source/database/linear-migrations/management/0000_init_helpers.sql`
 * - `username` `character varying(64)` and `admin_account_credentials_username_length_check` in
 *   `infra/k8s/base/ops/source/database/linear-migrations/management/0001_management_schema.sql`
 */
export const ADMIN_ACCOUNT_CREDENTIALS_EMAIL_MAX_LENGTH = 255;

/** Stored bcrypt hash length (`varchar_password` domain). */
export const ADMIN_ACCOUNT_CREDENTIALS_PASSWORD_HASH_MAX_LENGTH = 60;

export const ADMIN_ACCOUNT_CREDENTIALS_USERNAME_MAX_LENGTH = 64;
