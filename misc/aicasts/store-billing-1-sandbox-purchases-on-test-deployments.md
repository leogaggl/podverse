# Store Billing 1: Sandbox Purchases on a Test Deployment

- **Version:** 2026-10-20T09:36-05:00
- **Episode ID:** store-billing-sandbox-purchases-on-test-deployments
- **Changed:** First version.
- **Description:** Why a TestFlight build showed no App Store purchase sheet, the three settings
  that must all be right before a sandbox purchase grants membership on a test deployment, and
  how to check a purchase end to end.
- **Status:** Built. The setup steps are operator work per deployment.
- **Group:** Store Billing, part 1
- **Sources:** `.llm/plans/completed/alpha-apple-sandbox-billing/`;
  `packages/billing/src/sandboxPolicy.ts`, `packages/billing/src/BillingEventProcessor.ts`,
  `packages/external-services-apple-app-store/src/AppStoreServerClient.ts`,
  `packages/helpers-config/src/billingProcessorEnv.ts`, `apps/mobile/src/config/billingEnv.ts`,
  `apps/api/src/lib/billing/checkoutOptions.ts`,
  `apps/workers/src/commands/billing/processorProductAddLib.ts`,
  `docs/billing/BILLING-APPLE-SANDBOX.md`
- **Length:** about 8 minutes (1,150 words)

## Directions for the voice service (do not read aloud)

- Two voices. **Claire** is a woman: warm, clear, measured. **Tom** is a man: relaxed, curious.
  Each line starts with the speaker's name and a colon. That name picks the voice. Never read it.
- About 150 words per minute. Natural turn-taking, no overlap.
- Read only the lines under **Script**, exactly as written. Do not read headings or these
  directions.
- A line that says `(pause)` is about one and a half seconds of silence. Never say "pause".
- No music, sound effects, intro, or outro.
- Pronunciation: **Podverse** "POD-verse". **TestFlight** "TEST-flight". **PayPal** "PAY-pal".
  **StoreKit** "STORE-kit". **Node** as the word "node". Spell out **EAS** and **FOSS** letter by
  letter.
- If your service writes its own script from this one, keep every number and every claim
  exactly, keep both voices, and add nothing the text does not say.

## Script

CLAIRE: This is part one of Store Billing. It covers how a test build on a real iPhone buys a membership through Apple's sandbox, against a test deployment that runs in production mode. The code is built. Getting a deployment ready is a few settings an operator makes, and this part explains why each one matters.

TOM: What was the symptom?

CLAIRE: A TestFlight build of Podverse Next, on a real iPhone. Pressing Extend Membership never opened the App Store purchase sheet.

TOM: One bug?

CLAIRE: Three gaps. And fixing any one of them alone still shows no Apple purchase. That's the part worth remembering.

(pause)

TOM: Walk me through them.

CLAIRE: First, the build itself. It was made with mobile billing set to unavailable. Values that start with expo public are compiled into the app. So the installed build had no store checkout. It showed only the link out to pay with PayPal on the website.

TOM: Can an environment change fix an installed build?

CLAIRE: No. It needs a new store build. No over-the-air update. The variable is set to store on the EAS preview environment, explicitly, so it shows up in the build-config printout.

TOM: Isn't store the default?

CLAIRE: It is. Billing is unavailable only when that variable says unavailable, or when the push provider is UnifiedPush. UnifiedPush builds are the FOSS flavor, and they never open a store sheet, even if billing says store. So setting the variable explicitly makes the build's choice visible.

TOM: Second gap?

CLAIRE: The products. The deployment's processor product table was empty. The Apple checkout channel was on, but checkout options for iOS returned Apple with no products to sell.

TOM: And third?

CLAIRE: The deployment runs Node in production mode. In production, a sandbox purchase is ignored unless the deployment says to accept it.

(pause)

TOM: That third one is a policy. Explain it.

CLAIRE: There's one rule, in one place, the sandbox policy in the billing package. The store adapters only report whether a purchase came from a sandbox. Then: outside production, every sandbox purchase counts. In production, every sandbox purchase counts when the billing sandbox grant all flag is true. Otherwise only accounts on a sandbox allowlist count. Live purchases always count.

TOM: Why accept sandbox purchases in production at all?

CLAIRE: Store review and staff testing use sandbox purchases against production servers. The allowlist covers that on a live server. A test deployment sets the grant-all flag instead and leaves the allowlist empty.

TOM: What happens to an ignored one?

CLAIRE: It's marked processed, with the outcome ignored sandbox. No grant. If the server log says a sandbox purchase was ignored, the flag isn't true on the running API.

TOM: Where does the flag go?

CLAIRE: On the API, the workers, and the management API. All three process billing. Never on a live server. And don't change the Node mode to get this effect. The flag is the switch.

TOM: After setting it?

CLAIRE: Restart the API and management API deployments so they read it. The billing reconcile job picks it up on its next run. Then check that the running API actually prints true for that variable.

(pause)

TOM: You said don't change the Node mode. Doesn't production mode pick live payments?

CLAIRE: No. That's a rule worth saying out loud. Payment environments are explicit. An empty PayPal environment or Apple environment stays sandbox. Production Node does not select the live PayPal API or the production App Store. Live and production are values you set on purpose.

TOM: What values does Apple accept?

CLAIRE: Production, prod, or live select the production App Store. Empty stays sandbox. There's also an Xcode mode, for local testing. It trusts a transaction the device sends without Apple confirming it, so anyone could grant themselves a membership. That mode is refused when Node runs in production.

TOM: So staging can run production Node with sandbox payments.

CLAIRE: Exactly.

(pause)

TOM: Now the products. Which ones?

CLAIRE: Two, both Non-Renewing Subscription products on the Podverse Next app record: a monthly and an annual. Never on the older Podverse app record. The exact ids are in the StoreKit configuration file in the mobile app and in the Apple sandbox billing doc.

TOM: How do they get into the table?

CLAIRE: Two ways. In management web, under Billing, then Processor Products, add a row for each, with the processor set to Apple and the matching cadence. Or run the one-off ops job that adds a processor product. That command only inserts a missing row. It never changes a row management already saved.

TOM: And the app sees them right away?

CLAIRE: Within a minute. Checkout options are cached for up to sixty seconds.

(pause)

TOM: Then the test on the phone.

CLAIRE: Install the new build from TestFlight and sign in. Go to More, then Membership, then the purchase button. It says Buy Membership for an account that isn't Premium, and Extend Membership for a Premium one. Either opens the same checkout. The pass is the App Store sheet, not the word on the button.

TOM: What should the screen show?

CLAIRE: Monthly and Annual, with App Store prices, and a Complete Purchase button. If it shows only Pay with PayPal on the Web, the build still has billing off. Go back to the build. If it shows the plans but says a plan is unavailable, the products didn't load from Apple. Recheck App Store Connect: the agreement is active, the products are ready to submit, and the ids match exactly.

TOM: Does the tester get charged?

CLAIRE: No. TestFlight purchases already use Apple's sandbox. The sheet says it won't be charged. A separate sandbox Apple account is optional.

TOM: And how do we confirm the server side?

CLAIRE: In management web, open the tester's account, then Billing. There should be one Apple transaction, a grant, and the new expiry. The app shows the extended expiry date too.

TOM: What about Apple's notification to the server?

CLAIRE: A sandbox App Store Server Notification should arrive at the Apple billing webhook. It can lag the purchase by a minute. Its absence alone doesn't fail the check, because the purchase route grants first. Note whether it came.

TOM: Anything else?

CLAIRE: Restore. Under Troubleshooting, press Restore Purchases. It must not grant a second month. One transaction, not two.

(pause)

TOM: What's not covered?

CLAIRE: Google Play on a test deployment, which needs an internal-track upload first. PayPal product rows. The same empty table means PayPal web checkout had nothing to sell either. And the production notification address; only the sandbox one is set.

TOM: To remember. One: three things must all be right: a build with store billing, product rows in the table, and the grant-all flag on a production-mode test deployment. Two: build-time values are compiled in, so a fix to billing mode needs a new store build. Three: sandbox purchases in production count only with the grant-all flag or the allowlist, and live purchases always count. Four: payment environments are explicit, and empty means sandbox. Five: check the transaction, the grant, and that Restore doesn't grant twice.

CLAIRE: A sandbox purchase works when the build, the products, and the policy all agree.
