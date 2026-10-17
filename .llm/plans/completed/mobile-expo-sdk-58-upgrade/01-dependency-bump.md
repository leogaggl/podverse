# Dependency bump — Expo SDK 58

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Summary: [00-SUMMARY.md](./00-SUMMARY.md). Rules: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## Outcome

`apps/mobile` resolves Expo SDK 58, React Native 0.88, and React 19.3, with `expo-modules-jsi`
58.0.15 or newer. No call-site or plugin edits in this prompt.

## Steps

1. From the monorepo root, install SDK 58 and align every Expo package and native peer:

```bash
npm --prefix apps/mobile exec -- expo install expo@^58.0.0 --fix
```

Use `./scripts/nix/with-env` around that command if `npm` is not on the agent PATH. Do not wrap
later `mobile:*` scripts; they strip Nix themselves.

2. Read the resolved versions in `apps/mobile/package.json` and `apps/mobile/node_modules/expo-modules-jsi/package.json`.
   Required:
   - `expo` is `58.x`
   - `react-native` is `0.88.x` (not `0.86.3`)
   - `react` is `19.3.x`
   - `expo-modules-jsi` is `58.0.15` or newer

3. Point the `overrides` block at those same `expo` and `react-native` versions. Keep the
   `@xmldom/xmldom` override. Do not add overrides for packages `expo install` already aligned.

4. Confirm the Swift 6.4 fix is in the installed script
   `apps/mobile/node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh`. The `sed`
   pattern must contain `__ObjC(\.|::)`, so it strips both `extension __ObjC.` and
   `extension __ObjC::`. A pattern that is only `__ObjC\.` means the install is too old. Stop.
   Do not edit the script.

5. Do not set `usePrecompiledModules` here. Prompt 03 owns `app.config.ts`.
6. Do not run type-check or a device build.
7. Tick this prompt in `COPY-PASTA.md` and move this file to
   `.llm/plans/completed/mobile-expo-sdk-58-upgrade/`.

## Done when

- `apps/mobile/package.json` and `apps/mobile/package-lock.json` are the only intended edits.
- The version checks in step 2 and the `sed` check in step 4 both hold.
- The reply names the resolved `expo`, `react-native`, `react`, and `expo-modules-jsi` versions.
