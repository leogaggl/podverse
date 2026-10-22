---
name: native-deps-platform-mismatch
description: Detect and surface missing-native-binary errors (e.g. @rollup/rollup-darwin-arm64) without mutating node_modules or the lockfile.
version: 1.2.0
---

# Native deps platform mismatch

The Podverse lockfile is Linux-canonical but lists optional deps for every platform (see [LOCKFILE-LINUX.md](/docs/development/tooling/LOCKFILE-LINUX.md)). `sync-develop-to-staging.sh`, `sync-staging-to-main.sh`, `update-lockfile-linux.sh`, and `bump-version.sh` run npm in a temporary directory. They do not change host `node_modules`. A missing darwin binary comes from some other install that left Linux binaries or an incomplete tree.

## When to use

Errors like:

- `Cannot find module @rollup/rollup-darwin-arm64`
- `Cannot find module @next/swc-darwin-arm64`
- `Cannot find module @parcel/watcher-darwin-arm64`
- `Cannot find module sharp` (when prebuilt platform binary is missing)

## Do

- Surface the error to the user with the missing package name and host platform.
- Recommend `rm -rf node_modules && npm install` in **Root**. It materializes the platform-specific optional deps already listed in the lockfile and does not modify `package-lock.json`. Do not add that step after the publish or lockfile scripts. See **reinstall-node-modules-after-linux-npm**.

## Do not

- Do not run `npm install`, `npm ci`, `npm rebuild`, `npm install --no-save`, or `npm install --no-save --no-package-lock` autonomously. These mutate `node_modules` and may mutate `package-lock.json` in subtle ways across platforms.
- Do not modify [package-lock.json](/package-lock.json), [package.json](/package.json), or [scripts/development/update-lockfile-linux.sh](/scripts/development/update-lockfile-linux.sh) unless the user explicitly asks for that work.
- Do not blame the lockfile. The lockfile entries are correct; the host `node_modules` is the broken artifact.

## Why a rule, not a "ban npm ci"

`npm ci` itself is fine. The CI Dockerfiles (e.g. [apps/api/Dockerfile](/apps/api/Dockerfile), [apps/workers/Dockerfile](/apps/workers/Dockerfile)) use it intentionally. The agent failure mode this skill prevents is running mutating commands speculatively while debugging a missing-binary error – which can corrupt the lockfile or hide the underlying environment problem from the user.
