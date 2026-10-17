# Strike

Strike sells Premium as a one-time month or a one-time year. The buyer pays a Lightning
invoice. Strike credits USD to the Podverse Strike account. Podverse records a grant when
the receive is `COMPLETED`. A `PENDING` receive grants nothing.

Sandbox purchases and the three walkthroughs are in
[BILLING-STRIKE-SANDBOX.md](BILLING-STRIKE-SANDBOX.md). How a purchase is recorded is in
[BILLING.md](BILLING.md). Day-to-day operations are in
[BILLING-OPERATIONS.md](BILLING-OPERATIONS.md).

## 1. What it sells

Checkout offers `podverse-premium-monthly` and `podverse-premium-annual`. The invoice
amount is the Premium price for that cadence, in USD. The invoice expires 15 minutes after
it is created. Web and the unavailable-billing mobile build show the invoice (QR, copy,
open wallet). An App Store or Play build does not. Those builds open web checkout.

`POST /api/v2/billing/strike/checkouts` accepts `web` and `foss` only. `ios` and `android`
answer 404. The store button is a link to the website.

## 2. Sandbox access, then a production key

Ask Strike for sandbox access at partners@strike.me. Sandbox keys work only against
`https://api.dev.strike.me`. When the sandbox walkthroughs pass, ask Strike for a
production key. Production calls `https://api.strike.me`. The `STRIKE_ENVIRONMENT` flag
selects which host the server uses.

## 3. API key scopes and the webhook secret

In the Strike dashboard, create a key with only these scopes:

- `partner.receive-request.create`
- `partner.receive-request.read`
- `partner.webhooks.manage`

Choose a webhook secret of 10 to 50 characters. Podverse sends that secret when it
registers the webhook. Strike signs each delivery with it. Do not commit the key or the
secret.

## 4. Local env

Strike uses the same home-override pattern as PayPal. PayPal keys live in `paypal.env`.
Strike keys live in `billing.env`.

Edit `~/.config/podverse/local-env-overrides/billing.env` (create it from
`dev/env-overrides/local/billing.env.example` if `make local_env_prepare` has not yet):

```text
BILLING_WEBHOOK_PUBLIC_BASE_URL="https://billing-local.example.com"
BILLING_STRIKE_ENABLED=
STRIKE_API_KEY="your-sandbox-key"
STRIKE_WEBHOOK_SECRET="a-secret-of-10-to-50-characters"
STRIKE_ENVIRONMENT="sandbox"
```

`billing-local.example.com` stands in for the hostname in
[BILLING-PAYPAL-SANDBOX.md](BILLING-PAYPAL-SANDBOX.md). No trailing slash.

Leave `BILLING_STRIKE_ENABLED` empty until you intend to sell. Empty keeps Strike
unregistered even when the key and secret are set. Set it to `true` only for the
walkthrough, then run setup again.

From **Root**:

```bash
make local_env_link
make local_env_setup
```

That copies the four Strike keys into the API, workers, and management API env files.
Restart **Dev** after setup so those processes reload them.

## 5. Kubernetes

Credential values stay out of ConfigMaps. From the monorepo root (GitOps checkouts use
their copy of the same script):

```bash
bash ./infra/k8s/scripts/secret-generators/create_billing_strike_secret.sh
```

| Secret                           | Contents                                  | Mount                                                                                     |
| -------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `podverse-billing-strike-opaque` | `STRIKE_API_KEY`, `STRIKE_WEBHOOK_SECRET` | optional `envFrom` on the API, the management API, and CronJob `worker-billing-reconcile` |

The long-running parser workers do not mount this secret. Set `BILLING_STRIKE_ENABLED` to
`true` on the API, workers, and management API together, and set `STRIKE_ENVIRONMENT` to
`sandbox` or `production`. A secret without the flag does not register Strike.

Apply the encrypted file the script writes with your usual SOPS apply. The script prints
the verify and apply commands when it finishes.

## 6. Webhook subscription and the local tunnel

Strike delivers `receive-request.receive-completed` to:

`<BILLING_WEBHOOK_PUBLIC_BASE_URL>/api/v2/billing/webhooks/strike`

**Dev** must already be serving the API on `:3000`. Leave the named tunnel running in
**Billing Tunnel** so Strike can reach that API. If `podverse-local` does not exist yet,
create it once from **Root** after `cloudflared tunnel login` on the Cloudflare account
that owns the DNS zone (`billing-local.example.com` stands in for a hostname you control):

```bash
cloudflared tunnel create podverse-local
cloudflared tunnel route dns podverse-local billing-local.example.com
```

`~/.cloudflared/config.yml` routes that hostname to the local API. Do not commit the
credentials JSON.

```yaml
tunnel: podverse-local
credentials-file: ~/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: billing-local.example.com
    service: http://localhost:3000
  - service: http_status:404
```

The start command, in **Billing Tunnel**:

```bash
cloudflared tunnel run podverse-local
```

With `BILLING_STRIKE_ENABLED` true, build workers and register the subscription. From
**Workers**:

```bash
npm run build -w apps/workers
npm run billing_strike_ensure_webhook -w apps/workers
```

The log line is the subscription id and the webhook URL. The webhook secret is not logged.
Run the command again after the public URL or the secret changes. It updates the
subscription that already points at this URL.

The command exits when Strike is off, or when `BILLING_WEBHOOK_PUBLIC_BASE_URL` or
`STRIKE_WEBHOOK_SECRET` is empty.

## 7. Checkout channels

Turn channels on in management web under **Billing → Checkout Channels**, and only after
[BILLING-STRIKE-SANDBOX.md](BILLING-STRIKE-SANDBOX.md) passes. Do them in this order:

1. Enable `strike` / `web`.
2. Enable `strike` / `foss` when the unavailable-billing build should show the invoice
   inside the app.
3. Enable `strike` / `ios` only with storefront allowlist `US`.
4. Leave `strike` / `android` off.

`web` has to be on. The App Store button opens the website's checkout page. If `web` is
off, that page has no Strike method.

Checked 2026-10-11 against
[App Review Guidelines 3.1.1](https://developer.apple.com/app-store/review/guidelines/):
a button or external link in a United States storefront app does not need an entitlement.
Every other storefront still needs StoreKit External Purchase Link entitlements. This
deployment does not add those APIs, so the allowlist stays `US` only.
[Apple payment options in the EU](https://developer.apple.com/support/payment-options-on-the-app-store-in-the-eu)
still require the StoreKit External Purchases or Offers entitlement and the
ExternalPurchaseCustomLink disclosure APIs. EU is not a path this deployment sells.

Leave Android off. Checked 2026-10-11 against
[Google Play billing choice](https://developer.android.com/google/play/billing/billingchoice)
(page updated 2026-09-29): an external web link on Play has to use Play Billing Library
9.1+ choice and reporting APIs. This deployment does not add those APIs. Do not add other
country codes.

PayPal `ios` and `android` rows use the same rule. A store link cannot be saved on while
the allowlist is empty. The page says so on those PayPal and Strike rows. Apple and
Google Play rows are in-app purchases and do not get that sentence.

Saving a store link with an empty allowlist answers 422: `A store link needs at least one
storefront country.` The checkout channels page shows that message.

## 8. Production

When sandbox passes:

1. Put the production key and a new webhook secret in the Strike secret (or in
   `billing.env` for a local production-like process).
2. Set `STRIKE_ENVIRONMENT` to `production` and `BILLING_STRIKE_ENABLED` to `true` on the
   API, workers, and management API.
3. Set `BILLING_WEBHOOK_PUBLIC_BASE_URL` to the public API origin. No trailing slash.
4. Run `billing_strike_ensure_webhook` again so the production subscription points at
   `https://<that-origin>/api/v2/billing/webhooks/strike`.
5. Enable channels in the order in section 7.

Sandbox purchases in production grant membership when `BILLING_SANDBOX_GRANT_ALL` is `true`,
or for accounts listed in `BILLING_SANDBOX_ALLOWED_ACCOUNT_IDS` (account id or `id_text`,
comma-separated). Other
accounts are logged after the signature check, and the webhook still returns 200.

## 9. Refunds

Strike has no refund API and does not tell Podverse that a payment was refunded. Send the
refund from the Strike dashboard, then revoke the grant on the account Billing page in
management web. Steps and the limits for other processors are in
[BILLING-OPERATIONS.md](BILLING-OPERATIONS.md#manual-membership-management).
