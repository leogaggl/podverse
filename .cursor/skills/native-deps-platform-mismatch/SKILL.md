---
name: native-deps-platform-mismatch
description: Detect and surface missing-native-binary errors (e.g. @rollup/rollup-darwin-arm64) without mutating node_modules or the lockfile.
version: 1.1.0
---

# Native deps platform mismatch

The Podverse lockfile is Linux-canonical but lists optional deps for every platform (see [LOCKFILE-LINUX.md](/docs/development/tooling/LOCKFILE-LINUX.md)). A host-mounted Linux `npm ci` or `npm install` (staging sync, lockfile regeneration, version bump) leaves the Mac `node_modules` without darwin binaries. When you recommend one of those commands, include the restore in that same step list. See **reinstall-node-modules-after-linux-npm**.

## When to use

Errors like:

- `Cannot find module @rollup/rollup-darwin-arm64`
- `Cannot find module @next/swc-darwin-arm64`
- `Cannot find module @parcel/watcher-darwin-arm64`
- `Cannot find module sharp` (when prebuilt platform binary is missing)

## Do

- Surface the error to the user with the missing package name and host platform.
- Recommend the host restore from **reinstall-node-modules-after-linux-npm**: `rm -rf node_modules && npm install` in **Root**. It materializes the platform-specific optional deps already listed in the lockfile and does not modify `package-lock.json`.
- If the user recently ran `update-lockfile-linux.sh` or `bump-version.sh`, also give **Mobile** `npm run mobile:install`, and point them at the "After running on macOS" section of [LOCKFILE-LINUX.md](/docs/development/tooling/LOCKFILE-LINUX.md).

## Do not

- Do not run `npm install`, `npm ci`, `npm rebuild`, `npm install --no-save`, or `npm install --no-save --no-package-lock` autonomously. These mutate `node_modules` and may mutate `package-lock.json` in subtle ways across platforms.
- Do not modify [package-lock.json](/package-lock.json), [package.json](/package.json), or [scripts/development/update-lockfile-linux.sh](/scripts/development/update-lockfile-linux.sh) unless the user explicitly asks for that work.
- Do not blame the lockfile. The lockfile entries are correct; the host `node_modules` is the broken artifact.

## Why a rule, not a "ban npm ci"

`npm ci` itself is fine. The CI Dockerfiles (e.g. [apps/api/Dockerfile](/apps/api/Dockerfile), [apps/workers/Dockerfile](/apps/workers/Dockerfile)) use it intentionally. The agent failure mode this skill prevents is running mutating commands speculatively while debugging a missing-binary error – which can corrupt the lockfile or hide the underlying environment problem from the user.
