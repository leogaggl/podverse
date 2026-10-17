# Guidance — say SDK 58 where the docs say "current"

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Summary: [00-SUMMARY.md](./00-SUMMARY.md). Rules: [00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## Outcome

A reader of the current-version guidance sees Expo SDK 58 / React Native 0.88, the precompiled
module flag, and the phone-scene rule. Historical notes that a past build used SDK 57 stay as
history.

## Edit

Update version numbers, peer pins, and the Xcode 27 compile note. Do not rewrite procedures that
are still accurate.

- `.cursor/skills/mobile-expo-monorepo/SKILL.md` — description, SDK 57 / RN 0.86.3 pins, the
  screens / gesture-handler / safe-area peer line. Replace those pins with the versions
  `package.json` resolved in prompt 01. Add the `ios.usePrecompiledModules: false` reason in one
  sentence: shipped Expo xcframeworks are Swift 6.3.1 until a resolved prebuild says 6.4, and
  Xcode 27.1's compiler will not import them.
- `apps/mobile/APPS-MOBILE.md` — the sections that call SDK 57 / RN 0.86.3 the current pin
  (package table, `expo install` examples, Device Hub paragraph). Leave sentences that describe
  an already-shipped SDK 57 behavior.
- `.cursor/rules/vscode-terminals-commands.mdc` — the line that says Expo lives under
  `apps/mobile` (SDK 57).
- `apps/mobile/modules/podverse-media-engine/CARPLAY-ENTITLEMENT.md` — the warning that a
  CarPlay-only scene manifest suppresses the phone window. State the SDK 58 shape: Expo generates
  the phone scene; the plugin adds CarPlay beside it.
- `apps/mobile/src/downloads/downloadStorage.ts` — the comment that says the file system ships
  with SDK 57. Say SDK 58, and that callers stay on `expo-file-system/legacy`.

Do not edit `.llm/plans/completed/mobile-expo-sdk-57-upgrade/`. Do not edit billing docs that
only say a past binary was built with SDK 57.

## Scratchpad

Append one entry to `release-notes/scratchpad.md`:

```markdown
## Mobile Expo SDK 58

- Surfaces: mobile
- Change: Expo SDK 58 / React Native 0.88. iOS compiles Expo modules from source
  (`ios.usePrecompiledModules: false`) so Xcode 27.1's Swift 6.4 can build them. Phone scene
  comes from the SDK 58 template; CarPlay is an additional scene.
- Who notices: local iOS builds on Xcode 27. Foreground notifications use the SDK 58 default
  (shown unless a handler hides them); this app still has no handler.
- Operator steps: new dev client (`npm run mobile:ios` / `mobile:android`). No EAS build in this change.
```

## Archive

Tick prompt 05 in `COPY-PASTA.md`. Move this file, `00-SUMMARY.md`, `00-EXECUTION-ORDER.md`, and
`COPY-PASTA.md` to `.llm/plans/completed/mobile-expo-sdk-58-upgrade/`.

End the reply with the operator commands for the whole set, in the **Mobile** tab unless noted.
Do not run them.

```bash
npm run type-check:mobile
npm --prefix apps/mobile run test
```

**Mobile Metro** is already running `npm run mobile:dev` before either device command.
**Mobile iOS:**

```bash
npm run mobile:ios -- --device "iPhone 17 Pro"
```

**Mobile Android:**

```bash
npm run mobile:android -- --device Pixel_6_Pro_API_33
```

Maestro is not part of this set. Do not paste a Maestro command unless a prompt edited an
`apps/mobile/e2e` flow.
