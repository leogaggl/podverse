# Android — local modules on the SDK 58 template

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Summary: [00-SUMMARY.md](./00-SUMMARY.md). Rules: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## Outcome

The debug dev client compiles and installs on `Pixel_6_Pro_API_33`. Local Expo modules still use
the Expo Modules 1.0 DSL. R8 stays at the SDK 58 default.

## Steps

1. Read the generated Android template after prompt 03's prebuild (`apps/mobile/android`). Note
   `compileSdk`, `minSdk`, Kotlin, and AGP versions from the app module. Do not commit that tree.

2. Leave R8 on. SDK 58 sets `android.enableMinifyInReleaseBuilds=true` in `gradle.properties`.
   Do not set it to `false` in `expo-build-properties`. A debug `mobile:android` run will not
   show a missing keep rule. In the reply, say that a release build is the first time R8 runs,
   and that a keep rule waits until that build names a stripped class.

3. In `app.config.ts`, keep the existing `expo-build-properties` `android.usesCleartextTraffic:
   true`. Do not remove or rewrite the `ios` keys prompt 03 added (`deploymentTarget`,
   `usePrecompiledModules`).

4. Compile the local modules as they stand:
   - `apps/mobile/modules/podverse-media-engine/android/build.gradle`
   - `apps/mobile/modules/podverse-perf-probe/android/build.gradle`
   - their Kotlin sources

   Change a module gradle file only to match a version the generated app now requires (SDK,
   Kotlin, or the Expo modules plugin). Do not rewrite the modules onto Expo Modules 2.0
   annotations. Do not bump Media3 unless the compile error is a missing Media3 API.

5. iOS podspecs (`PodverseMediaEngine.podspec`, `PodversePerfProbe.podspec`) are prompt 03's
   concern if they failed the iOS build. Touch them here only when an Android-unrelated iOS
   failure is still open and the operator pasted it. Otherwise leave them.

6. Stop this turn. **Mobile Android** tab, with **Mobile Metro** already running
   `npm run mobile:dev`:

```bash
npm run mobile:android -- --device Pixel_6_Pro_API_33
```

7. When they paste the result, fix gradle or Kotlin errors in the two local modules or in
   `app.config.ts` Android keys. Then tick `COPY-PASTA.md` and move this file to
   `.llm/plans/completed/mobile-expo-sdk-58-upgrade/`.

## Done when

The operator reports the debug app installed on `Pixel_6_Pro_API_33`, and
`usePrecompiledModules` is still the value prompt 03 set.
