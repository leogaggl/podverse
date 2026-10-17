# JS surface — SDK 58 breaking changes

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Summary: [00-SUMMARY.md](./00-SUMMARY.md). Rules: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## Outcome

App TypeScript still type-checks against React Native 0.88's strict API. Behavior that this app
already chose stays: legacy file system, no notification handler, Pressable rather than the
removed touchable APIs.

## Already true — do not redo

- No `InteractionManager` imports.
- No `react-native/Libraries/*` imports.
- No `TouchableOpacity` / `TouchableWithoutFeedback` / `TouchableHighlight`.
- `StatusBar` in `App.tsx` is `expo-status-bar`, not React Native's `StatusBar`.
- File access goes through `expo-file-system/legacy` (`downloadManager.ts`, `PlaybackProvider.tsx`,
  `downloadStorageStats.ts`, `MoreOpmlScreen.tsx`, `useOpmlImport.ts`, `shareRemoteFile.ts`,
  `resolvePlaybackUrl.ts`, `AccountAccessPanel.tsx`). `File.write()` becoming async does not apply
  to that entry. Leave the imports on `legacy`.

## Steps

1. Search `apps/mobile` (exclude `node_modules`, `ios`, `android`) for the React Native 0.87
   removals and fix any hit in our source:
   - `InteractionManager`
   - `react-native/Libraries/`
   - `NativeMethods`
   - a `Modal` `animated` prop
   - React Native `StatusBar` props `backgroundColor`, `translucent`, `networkActivityIndicatorVisible`
   - `defaultProps` on function components
   - `useRef()` with no argument, where the SDK 58 `@types/react` now requires an argument

2. Confirm `expo-file-system/legacy` still exports the functions those eight files call
   (`documentDirectory`, `getInfoAsync`, `readAsStringAsync`, `writeAsStringAsync`,
   `deleteAsync`, `makeDirectoryAsync`, `copyAsync`, and whatever else a file imports). If the
   legacy entry is gone, stop and report. Do not migrate those files to `File` / `Directory`.

3. Do not add `Notifications.setNotificationHandler`. SDK 58 shows a foreground notification
   unless a handler says otherwise. This app has no handler. Leave that default. Mention it in
   the reply so prompt 05 can put it on the scratchpad.

4. `apps/mobile/tsconfig.json` extends the Expo base, which already sets the `react-native`
   custom condition. Do not add `react-native-legacy-deep-imports` unless `type-check:mobile`
   fails inside `node_modules` on a deep import and there is no import in our source to change.

5. Do not edit `app.config.ts`, plugins, or `src/billing/**` unless a type error in billing is
   a renamed `expo-iap` export. Keep the `BillingClient` interface. If `expo-iap` needs a new
   major, stop and report the type error instead of rewriting purchases.

6. Stop this turn. Ask the operator to run this in the **Mobile** tab, then wait:

```bash
npm run type-check:mobile
```

7. When they paste the result: fix errors in our source. If the only errors are inside
   `node_modules`, record the package and the line, and apply the legacy condition from step 4
   only in that case. Then tick `COPY-PASTA.md` and move this file to
   `.llm/plans/completed/mobile-expo-sdk-58-upgrade/`.

## Done when

The operator reports `type-check:mobile` succeeded, or the reply lists the `node_modules` errors
that the legacy condition was added to unblock.
