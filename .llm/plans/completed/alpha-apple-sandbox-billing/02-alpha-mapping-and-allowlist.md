# 02 — Alpha product mapping and sandbox grants

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## 1. Grant every sandbox purchase

Alpha stays `NODE_ENV=production`. `BILLING_SANDBOX_GRANT_ALL=true` on the API, workers, and
management API makes every sandbox purchase grant Premium. `BILLING_SANDBOX_ALLOWED_ACCOUNT_IDS`
stays empty. Do not look up accounts, and do not set the flag on a live server.

The flag is already in `k.podcastdj.com` on:

- `apps/podverse-alpha/api/source/api.env`
- `apps/podverse-alpha/workers/source/workers.env`
- `apps/podverse-alpha/management-api/source/management-api.env`

It does nothing until the running images include the code that reads it. After that image is
deployed and Argo has synced, restart the two deployments that process billing. The
`worker-billing-reconcile` CronJob reads the new env on its next run.

```bash
kubectl --context al -n podverse-alpha rollout restart deploy/podverse-api deploy/podverse-management-api
kubectl --context al -n podverse-alpha rollout status deploy/podverse-api --timeout=180s
kubectl --context al -n podverse-alpha rollout status deploy/podverse-management-api --timeout=180s
kubectl --context al -n podverse-alpha exec deploy/podverse-api -c api -- printenv BILLING_SANDBOX_GRANT_ALL
```

The last command must print `true`.

## 2. Map the Apple products (operator, after 01)

Management web on alpha (`https://management.alpha.podcastdj.com`) → **Billing → Processor
Products**. Add two rows:

| Processor | External Product ID | Base Plan ID | Cadence |
| --- | --- | --- | --- |
| `apple` | `com.podverse.app.next.premium.nonrenewing.monthly` | empty | Monthly |
| `apple` | `com.podverse.app.next.premium.nonrenewing.annual` | empty | Annual |

Both active. Checkout options are cached for up to 60 seconds.

Agent check after the operator saves:

```bash
kubectl --context al -n podverse-alpha exec -i podverse-db-0 -- sh -c 'psql -U "$POSTGRES_USER" -d podverse_app -At -c "select processor_id, billing_cadence, external_product_id, is_active from billing_processor_product where processor_id = '\''apple'\'' order by billing_cadence;"'
curl -sS 'https://api-alpha.podcastdj.com/api/v2/billing/checkout-options?platform=ios&storefront=US'
```

The curl response must list `apple` with both products. If the route needs other query names,
read `apps/api/src/controllers/billing.ts` `getCheckoutOptions` and match it.

## Done when

- `BILLING_SANDBOX_GRANT_ALL` prints `true` on the running API.
- `checkout-options` for `ios` returns both Apple products.
