# Expo SDK 57 → 58 upgrade — summary

Goal: `apps/mobile` builds a dev client on this Mac's Xcode 27.1 (Swift 6.4) without a
`node_modules` patch, on Expo SDK 58 / React Native 0.88.

Order: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md). Prompts: [COPY-PASTA.md](./COPY-PASTA.md).

## Why

Two Swift 6.4 failures block a local iOS build on SDK 57. Expo's prebuilt
`ExpoModulesCore.xcframework` (SDK 57 and, as of `expo-modules-core` 58.0.22, SDK 58) was compiled
with Swift 6.3.1, and Swift 6.4 refuses to import it. Turning precompiled modules off compiles
Expo from source, which then fails in `ExpoModulesJSI`: `build-xcframework.sh` deletes
`extension __ObjC.` blocks, and Swift 6.4 writes `extension __ObjC::expo.__ObjC::CppError`. The
block survives, and `ExpoModulesCore` cannot import the framework.

`expo-modules-jsi` 58.0.15 changes that `sed` to `__ObjC(\.|::)`. The newest SDK 57 package
(57.1.2) still has the old pattern. SDK 58 is also the release Expo built for iOS 27 (scene
lifecycle, Device Hub, React Native 0.88).

Installing the iOS 27.1 simulator runtime does not change the compiler. Xcode 27.1 already
contains `iPhoneOS27.1.sdk`. The **"iPhone 17 Pro"** device used for day-to-day builds is on the
installed iOS 26.5 runtime. Leave that device on 26.5.

## Locked decisions

| Decision | Choice |
| -------- | ------ |
| Target | `expo@^58.0.0` via `expo install --fix`. React Native 0.88 and React 19.3, whatever that command resolves. Do not stay on 0.86 |
| `expo-modules-jsi` | Must be **58.0.15 or newer** (transitive). Confirm the `sed` matches `__ObjC(\.|::)`. Do not patch `node_modules` |
| Precompiled Expo modules | `ios.usePrecompiledModules: false` in `app.config.ts` (`expo-build-properties`). Survives prebuild. Re-enable only if the resolved `ExpoModulesCore` swiftinterface says Swift 6.4 |
| iOS deployment target | Stay at `16.4`. Keep `withPodverseIosPodBuildSettings` (deployment floor + `SWIFT_ENABLE_EXPLICIT_MODULES = NO` on pods) |
| Phone scene | SDK 58 generates `SceneDelegate` and `UIApplicationSceneManifest`, and creates the `UIWindow` there. CarPlay is an extra scene configuration beside that phone scene. Do not replace the phone scene delegate |
| File system | Stay on `expo-file-system/legacy`. Do not move callers to `File` / `Directory` |
| Notifications | Do not add `setNotificationHandler`. There is no handler today. Foreground display follows the SDK 58 default |
| Strict RN types | Fix our imports. Add `react-native-legacy-deep-imports` only when a failure is inside `node_modules` and has no import fix |
| Android R8 | Leave the SDK 58 default (`android.enableMinifyInReleaseBuilds=true`). Add a keep rule only after a release build names a stripped class. Debug `mobile:android` does not exercise R8 |
| Native trees | `apps/mobile/ios` and `apps/mobile/android` stay gitignored. Regenerate; do not commit them |
| Identity | Bundle id and package stay `com.podverse.app.next`. Do not install `expo-updates` |
| Agent verify | Agents do not run type-check, unit tests, lint, or device builds. Each prompt that needs a gate stops and hands the operator the command |
| EAS | Out of this set. The same `usePrecompiledModules: false` flag is what a later Xcode 27 cloud image needs |

## Out of scope

- `expo-router` (this app uses React Navigation)
- Expo Modules 2.0 rewrite of `podverse-media-engine` or `podverse-perf-probe`
- Swift Package Manager instead of CocoaPods
- `expo-file-system` File/Directory API, `expo-background-task`, iPhone Duo layout, Noxcturnal
- A store build, TestFlight submit, or Play upload
- Downloading the iOS 27.1 simulator runtime

## What each prompt owns

| Prompt | Owns |
| ------ | ---- |
| 01 | `apps/mobile/package.json`, `apps/mobile/package-lock.json`, the install itself |
| 02 | JS/TS call sites under `apps/mobile` outside plugins, plus `apps/mobile/tsconfig.json` only if the legacy-import opt-out is required |
| 03 | `app.config.ts` iOS keys, `plugins/withPodverseCarPlay.js`, `plugins/withPodverseIosPodBuildSettings.js`, `plugins/ios-pod-build-settings.rb`, splash plugin only if the generated storyboard no longer matches it |
| 04 | `app.config.ts` Android keys inside the existing `expo-build-properties` block, both local modules' `build.gradle` / podspecs only when the SDK 58 template no longer compiles them |
| 05 | Guidance that still says the app is on SDK 57: `mobile-expo-monorepo` skill, `APPS-MOBILE.md`, `vscode-terminals-commands.mdc`, `CARPLAY-ENTITLEMENT.md`, the `downloadStorage.ts` comment, `release-notes/scratchpad.md` |

## Primary risks

| Risk | Where it is handled |
| ---- | ------------------- |
| CarPlay plugin replaces the phone scene and the phone window never attaches | 03. Phone scene stays Expo's. CarPlay is a second configuration |
| `usePrecompiledModules: false` is written only into gitignored `Podfile.properties.json` and prebuild turns it back on | 03 writes it in `app.config.ts` |
| An older `expo-modules-jsi` 58.0.x without the `sed` fix gets installed | 01 checks the script before any later prompt |
| Pod build-settings hook misses a changed Podfile `post_install` ending | 03 updates the marker; it does not delete the hook |
| R8 strips a local module in a later release build | 04 leaves R8 on and records that debug will not show it |
