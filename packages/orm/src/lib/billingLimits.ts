/**
 * Billing-related VARCHAR/CHAR lengths.
 *
 * Keep in sync with
 * `infra/k8s/base/ops/source/database/linear-migrations/app/0001_app_schema.sql`:
 * `billing_price.currency_code` is `character(3)`, and `billing_domain_event.idempotency_key`
 * and `account_membership_status.last_extension_idempotency_key` are `character varying(128)`.
 * That file is the DDL source of truth.
 */
export const BILLING_IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/** ISO 4217 alphabetic currency codes (`billing_price.currency_code`). */
export const ISO_4217_CURRENCY_CODE_CHAR_LENGTH = 3;
