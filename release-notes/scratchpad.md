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
