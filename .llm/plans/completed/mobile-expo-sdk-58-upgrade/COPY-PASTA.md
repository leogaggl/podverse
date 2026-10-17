# Expo SDK 58 upgrade — COPY-PASTA

How to use:

1. Commit or stash the unrelated mobile edits first. Agents will not commit.
2. Select **Cursor model** and **Reasoning** in the Cursor UI (line above each fence).
3. Copy one fenced block, paste it, and wait until that prompt is ticked before the next.
4. Prompts that stop for a build continue when you paste the result back into the same chat.

Decisions: [00-SUMMARY.md](./00-SUMMARY.md). Order and rules:
[00-EXECUTION-ORDER.md](./00-EXECUTION-ORDER.md).

## Model per prompt

| Prompt | Cursor model | Reasoning | Why this tier |
| ------ | ------------ | --------- | ------------- |
| 01 | Cursor Grok 4.7 | high | Version pins are specified; the `sed` check is a fixed string |
| 02 | Cursor Grok 4.7 | high | Search-and-fix against a locked list of removals |
| 03 | Opus 5.5 | high | Scene lifecycle and CarPlay; the phone window depends on it |
| 04 | Cursor Grok 4.7 | extra high | Gradle alignment with the generated template, without rewriting the modules |
| 05 | Cursor Grok 4.7 | medium | Docs and scratchpad |

If 01 or 02 stalls or makes the same mistake twice, rerun it on **Codex 5.3**. If 03's scene
edit still leaves the phone with no window, stay on **Opus 5.5**.

## Prompts

- [x] **01 — Install SDK 58**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-expo-sdk-58-upgrade/01-dependency-bump.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md.
Install with expo install --fix. Do not edit app.config.ts or plugins.
Do not run type-check or a device build.
```

- [x] **02 — JS surface**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-expo-sdk-58-upgrade/02-js-surface.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md.
Stay on expo-file-system/legacy. Do not add a notification handler.
Give me the type-check command and stop this turn. When I paste the result, fix our
source and finish the prompt.
```

- [x] **03 — iOS on Xcode 27**

Operator: start **Mobile Metro** with `npm run mobile:dev` before the build step. Leave it
running. The agent will stop and ask for the iOS build.

**Cursor model:** Opus 5.5 · **Reasoning:** high

```
Read and execute .llm/plans/active/mobile-expo-sdk-58-upgrade/03-ios-xcode-27.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md.
Put usePrecompiledModules in app.config.ts. Keep Expo's phone scene delegate and add
CarPlay beside it. You may prebuild and pod-install. Give me the Mobile iOS command
and stop this turn. When I paste the build result, fix compile errors you own and
finish the prompt. Do not run mobile:ios yourself.
```

- [x] **04 — Android local modules**

Operator: **Mobile Metro** is still the `npm run mobile:dev` from prompt 03. The agent will
stop and ask for the Android build.

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

```
Read and execute .llm/plans/active/mobile-expo-sdk-58-upgrade/04-android-local-modules.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md.
Do not turn R8 off and do not rewrite the local modules onto Expo Modules 2.0.
Do not change the iOS keys in app.config.ts. Give me the Mobile Android command and
stop this turn. When I paste the build result, fix gradle or Kotlin errors you own
and finish the prompt. Do not run mobile:android yourself.
```

- [x] **05 — Guidance and archive**

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

```
Read and execute .llm/plans/active/mobile-expo-sdk-58-upgrade/05-guidance.md
Follow 00-EXECUTION-ORDER.md and the locked decisions in 00-SUMMARY.md.
Update current-version guidance to SDK 58, append the scratchpad entry, and archive
this whole directory to .llm/plans/completed/mobile-expo-sdk-58-upgrade/.
End with the operator verify commands for the set. Do not run them.
```
