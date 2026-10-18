# iOS on Xcode 27 — precompiled modules and the phone scene

**Cursor model:** Opus 5.5 · **Reasoning:** high

Summary: [00-SUMMARY.md](./00-SUMMARY.md). Rules: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## Outcome

A dev client compiles and installs on **"iPhone 17 Pro"** with Xcode 27.1. Expo modules compile
from source. CarPlay still gets its own scene. The phone window is the one Expo's scene delegate
creates.

## Precompiled modules

`expo-modules-core` 58.0.22's shipped `ExpoModulesCore.xcframework` is still Swift 6.3.1. Swift
6.4 will not import it. The durable switch is `expo-build-properties`, which prebuild writes into
`Podfile.properties.json`.

In `apps/mobile/app.config.ts`, inside the existing `expo-build-properties` plugin:

```ts
ios: {
  deploymentTarget: '16.4',
  usePrecompiledModules: false,
},
```

Keep `deploymentTarget` at `16.4`. Update the comment on that block so it describes the Swift
6.4 prebuild mismatch, not "SDK 57 / RN 0.86".

Before writing `false`, open the resolved
`node_modules/expo-modules-core` prebuilt simulator `arm64-apple-ios-simulator.swiftinterface`
(under `prebuilds/`). If its `swift-compiler-version` is Apple Swift 6.4 or newer, omit
`usePrecompiledModules` so the default prebuilds stay on. Say which version you found.

Do not edit `Podfile.properties.json` by hand. Prebuild regenerates it.

## Phone scene and CarPlay

SDK 58's prebuild emits `SceneDelegate.swift` and a `UIApplicationSceneManifest`, and creates the
`UIWindow` in the scene delegate. `plugins/withPodverseCarPlay.js` was written for SDK 57, where
that manifest was absent. It injects `PodversePhoneSceneDelegate` and a
`configurationForConnecting` that sends the phone role to that class, then assigns
`appDelegate.window`. On SDK 58 that window is no longer created in `didFinishLaunching`, so this
injection fights the generated scene delegate.

1. Regenerate, then read. From the monorepo root:

```bash
npm --prefix apps/mobile exec -- expo prebuild --clean
```

   `ios/` and `android/` are gitignored. Read the generated `AppDelegate.swift`,
   `SceneDelegate.swift`, and the `UIApplicationSceneManifest` in Info.plist. Names may differ;
   search under `apps/mobile/ios`.

2. Rewrite `withPodverseCarPlay.js` against that template:
   - The phone scene delegate stays the one Expo generated. Delete the injected
     `PodversePhoneSceneDelegate` and stop assigning `appDelegate.window`.
   - `.carTemplateApplication` still returns a configuration whose `sceneClass` is
     `CPTemplateApplicationScene` and whose `delegateClass` is `PodverseCarPlaySceneDelegate`
     (`modules/podverse-media-engine/ios/PodverseCarPlaySceneDelegate.swift`).
   - If the template already implements `configurationForConnecting`, extend that method.
     Do not declare a second one.
   - The manifest keeps the phone scene entry and gains a CarPlay scene entry. A manifest that
     contains only the CarPlay scene is the failure mode that leaves the phone with no window.

3. Replace the comment in `app.config.ts` `ios.infoPlist` that says not to declare a CarPlay-only
   `UIApplicationSceneManifest`. State the current rule: Expo generates the phone scene, and the
   CarPlay plugin adds a scene beside it.

4. `plugins/withPodverseIosPodBuildSettings.js` looks for the Podfile ending
   `  end\nend\n`. After prebuild, confirm that ending still exists. If the SDK 58 Podfile wraps
   `post_install` differently, update the marker so the snippet in
   `plugins/ios-pod-build-settings.rb` still lands inside `post_install`. Keep both settings:
   deployment target floor `16.4`, and `SWIFT_ENABLE_EXPLICIT_MODULES = NO` on pod targets. Do
   not set that flag on the app target.

5. Re-run prebuild so the edited plugins are what the project contains. Then:

```bash
npm run mobile:pod-install
```

   Confirm `apps/mobile/ios/Podfile.properties.json` has `"EXPO_USE_PRECOMPILED_MODULES": "false"`
   when step 1 of "Precompiled modules" kept the flag. Confirm the Podfile contains the generated
   podverse ios build-settings block.

6. `plugins/withPodverseSplashScreen.js` repairs an empty storyboard `<subviews/>`. Read the
   generated splash storyboard. Adjust the plugin only if that empty-subviews shape is gone and
   the plugin would no longer find its insertion point. Do not restyle the splash.

7. Stop this turn. Tell the operator:
   - **Mobile Metro** must already be running `npm run mobile:dev` (the iOS command does not
     start Metro).
   - **Mobile iOS** tab:

```bash
npm run mobile:ios -- --device "iPhone 17 Pro"
```

   Do not pass a bare `--device`. Do not tell them to download the iOS 27.1 simulator. This
   device is on the iOS 26.5 runtime, and the SDK inside Xcode 27.1 is enough to compile.

8. When they paste the result: fix compile errors that come from the plugins, the local Swift
   modules, or Expo module import (`__ObjC::expo`, "SDK is not supported by the compiler").
   Then tick `COPY-PASTA.md` and move this file to
   `.llm/plans/completed/mobile-expo-sdk-58-upgrade/`.

## Done when

The operator reports the dev client installed on **"iPhone 17 Pro"**, and
`usePrecompiledModules: false` (or the recorded "prebuild is already Swift 6.4" exception) is in
`app.config.ts`.
