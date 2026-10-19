# 03 — iOS build with store billing

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

The installed build 1 cannot be fixed by an env change; `EXPO_PUBLIC_*` values are compiled in.
This milestone ships build 2 of `5.5.3` with `EXPO_PUBLIC_MOBILE_BILLING=store`.

## 1. EAS preview environment (operator)

[expo.dev](https://expo.dev) → **podverse / podverse-next → Environment variables**, environment
**preview**. Edit `EXPO_PUBLIC_MOBILE_BILLING` from `unavailable` to `store`. Visibility stays
**Plain text**. Leave every other preview variable alone, including
`EXPO_PUBLIC_MOBILE_PUSH_PROVIDER=fcm` (a `unifiedpush` value would force billing off again).

## 2. Build and submit (operator, **Mobile** tab)

The tree must be clean, and `release-notes/mobile/5.5.3.md` must be committed. It already is.
Agent: before giving the commands, run `git status --short` in the Podverse repo and list
anything that would block the build.

```bash
make mobile_eas_ios_build
```

When the build-config printout appears, check that it says `EXPO_PUBLIC_MOBILE_BILLING: store`.
If the printout cannot read the env (its `eas env:list --json` call is a known script bug), check
the variable on expo.dev instead. Do not fix the script in this milestone.

After the build finishes:

```bash
make mobile_eas_ios_submit
```

Type the new build number when asked.

## 3. TestFlight (operator)

App Store Connect → **Podverse Next → TestFlight**. The **Internal** group has automatic
distribution, so build 2 reaches the tester once processing finishes. Paste the store note from
`release-notes/mobile/5.5.3.md` into the build's **What to Test**. Answer the encryption question
the same way as build 1 (**None of the algorithms mentioned above**).

Update the app on the iPhone from TestFlight.

## Done when

- Build 2 is installed on the iPhone from TestFlight.
- expo.dev preview shows `EXPO_PUBLIC_MOBILE_BILLING=store`.
