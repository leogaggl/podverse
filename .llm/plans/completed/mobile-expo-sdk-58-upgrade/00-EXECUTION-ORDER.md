# Execution order — Expo SDK 58 upgrade

Summary: [00-SUMMARY.md](./00-SUMMARY.md). Prompts: [COPY-PASTA.md](./COPY-PASTA.md).

## Before prompt 01

The working tree has unrelated mobile edits (billing screens, i18n overrides, navigation).
Commit or stash those **before** pasting prompt 01, so the SDK diff is reviewable on its own.
Agents do not commit.

`apps/mobile/ios/` is gitignored. A hand edit that set `EXPO_USE_PRECOMPILED_MODULES` to `false`
in `Podfile.properties.json` is not the durable fix. Prompt 03 puts that flag in `app.config.ts`.

## Order

| # | File | Depends on | Done when |
| - | ---- | ---------- | --------- |
| 01 | [01-dependency-bump.md](../../completed/mobile-expo-sdk-58-upgrade/01-dependency-bump.md) | Clean-enough tree | `expo` is 58.x, React Native is 0.88.x, `expo-modules-jsi` is ≥ 58.0.15 and its `sed` matches both spellings |
| 02 | [02-js-surface.md](../../completed/mobile-expo-sdk-58-upgrade/02-js-surface.md) | 01 | Operator `type-check:mobile` is clean, or the only remaining errors are inside `node_modules` and recorded |
| 03 | [03-ios-xcode-27.md](../../completed/mobile-expo-sdk-58-upgrade/03-ios-xcode-27.md) | 02 | Operator `mobile:ios` for `"iPhone 17 Pro"` compiles and installs |
| 04 | [04-android-local-modules.md](../../completed/mobile-expo-sdk-58-upgrade/04-android-local-modules.md) | 03 | Operator `mobile:android` for `Pixel_6_Pro_API_33` compiles and installs |
| 05 | [05-guidance.md](../../completed/mobile-expo-sdk-58-upgrade/05-guidance.md) | 04 | SDK 57 "current version" guidance matches SDK 58, scratchpad has an entry, the set is archived |

Nothing in this set runs in parallel. 03 and 04 both edit `app.config.ts`.

## Rules for the executing agent

1. Read [00-SUMMARY.md](./00-SUMMARY.md) locked decisions and follow them. Do not reopen the
   precompiled-modules or file-system choices.
2. Do not run type-check, unit tests, lint, Maestro, `mobile:ios`, or `mobile:android`. Give
   those commands to the operator and stop the turn when the plan says to wait.
3. `expo prebuild` and `npm run mobile:pod-install` are allowed in prompt 03. They regenerate
   gitignored native projects. Do not commit `apps/mobile/ios` or `apps/mobile/android`.
4. Do not run `git commit`, `git push`, or any `gh` write. Fish-safe commands only when the
   operator asked to commit in that message.
5. Do not run `eas build`, `eas submit`, or `make mobile_eas_*`.
6. Do not install `expo-updates` or add an `updates` config.
7. Do not change `bundleIdentifier` or Android `package`.
8. Expo CLI is `npm --prefix apps/mobile exec -- expo …` from the monorepo root. Never bare
   `npx expo` from the root.
9. Do not revert files you did not change. Unrelated dirty files stay dirty.
10. Do not accept an Xcode "Update to recommended settings" change if a generated project offers it.
11. When a prompt is done, tick it in `COPY-PASTA.md` and move that numbered file to
    `.llm/plans/completed/mobile-expo-sdk-58-upgrade/`. Prompt 05 archives the whole directory.

## Stop rules

- `expo install` cannot resolve a React Native 0.88 that matches Expo 58. Stop and report the
  resolver error. Do not pin 0.86 beside Expo 58.
- The resolved `expo-modules-jsi` is older than 58.0.15, or its `build-xcframework.sh` still
  matches only `extension __ObjC\.`. Stop in prompt 01. Do not add a `sed` workaround.
- `expo-file-system/legacy` is gone from the resolved package. Stop in prompt 02. Do not invent
  a File/Directory migration inside this set.
- Prompt 03 finds that keeping the phone scene on Expo's delegate cannot also route
  `.carTemplateApplication` to `PodverseCarPlaySceneDelegate`. Stop and describe both generated
  methods. Do not ship a CarPlay-only `UIApplicationSceneManifest`.
