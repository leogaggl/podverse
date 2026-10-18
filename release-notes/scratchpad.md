## Page call-to-action buttons use the tall decision style

- Surfaces: mobile
- Change: Buy Membership, Sign Up, Add Podcast, OPML import and export, account download / export /
  delete / change email, and Check Feed for Updates use the form button (52pt tall, 17pt type)
  instead of the compact default.
- Who notices: people on those screens see a taller button with larger type

## Bottom status strips no longer show the list through them

- Surfaces: mobile (phone layout)
- Change: the bottom chrome stack above the tab bar (sync bar, offline / "Can't Reach the Server"
  strip, clip/chapter strip, mini player) now paints an opaque screen-background base. The offline
  strip's warning tint is translucent, so list rows scrolling behind it used to show through and
  collide with its text. Tablet already had this base.
- Who notices: anyone who sees the offline or server-unreachable strip while scrolling a list

## Mobile Expo SDK 58

- Surfaces: mobile
- Change: Expo SDK 58 / React Native 0.88. iOS compiles Expo modules from source
  (`ios.usePrecompiledModules: false`) so Xcode 27.1's Swift 6.4 can build them. Phone scene
  comes from the SDK 58 template; CarPlay is an additional scene.
- Who notices: local iOS builds on Xcode 27. Foreground notifications use the SDK 58 default
  (shown unless a handler hides them); this app still has no handler.
- Operator steps: new dev client (`npm run mobile:ios` / `mobile:android`). No EAS build in this change.

## Stacked form fields use one even gap

- Surfaces: web, management-web
- Change: Processor product, account billing, and feed flag forms space each field and the
  action row with the shared form gap. Add-by-RSS username and password fields, and the change
  email and delete account dialogs, use that same gap. Fields no longer sit in one tight block
  with the button on the last field.
- Who notices: operators on those management forms, and people adding a private feed or changing
  or deleting an account on web

## List rows use the same space above and below the artwork

- Surfaces: mobile
- Change: text-bearing list rows (`HomeFeedRow`, `ListRow`, browse category rows, downloads, and
  settings text rows) use the same vertical padding on the top and bottom. Cover art on Browse,
  Home, and the other lists that share those rows has equal space above and below.
- Who notices: anyone looking at a list row with a cover image

## Mobile membership after a store purchase

- Surfaces: mobile
- Change: a store purchase that was recorded without extending membership says so and offers
  View Membership, instead of the "extended by 1 month" card. A purchase that did extend
  membership writes the purchase response's expiry onto the account immediately, and Membership
  reloads that standing from the primary billing status when the screen is shown. Membership
  opened from elsewhere keeps the More menu underneath it, so Back and a second press of the
  More tab return to that menu. The success card also has View Membership.
- Who notices: anyone who buys or restores a membership in the app, including an Apple sandbox
  purchase on a deployment that records the charge without granting Premium
