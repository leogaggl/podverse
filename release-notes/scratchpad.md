## Restore returns to Membership

- Surfaces: mobile
- Change: A restore that extends membership shows the result, then opens Membership after a few seconds, the same way a completed purchase does.
- Who notices: someone restoring a store purchase on Extend Membership

## Billing setup without management

- Surfaces: workers, api, management-api, k8s ops
- Change: `billingProcessorProductAdd` and `billingCheckoutChannelEnable` insert a missing
  Premium store-product row or turn a checkout channel on. They never update, reactivate, or
  remove an existing row. The same commands run locally or as a one-off Job from the suspended
  CronJob `ops-billing-setup` (`npm run billing:setup:k8s`). Apple and Google adapters map a
  purchase from `billing_processor_product` instead of `BILLING_PRODUCT_*` env. PayPal and
  Strike product ids stay the fixed ids in code (`--defaults`).
- Who notices: operators who set up billing without the management app; an Apple or Google
  purchase maps when the row exists in the database
- Operator steps: bump the alpha ops ref in `k.podcastdj.com` so the CronJob syncs
