# Publish scripts

Operator scripts for the develop → staging → main release train. **Agents do not run git push
commands**; the operator runs these locally.

| Script                                                     | Purpose                                                                              | Triggers CI                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [`bump-version.sh`](bump-version.sh)                       | Bump `X.Y.Z` in root and workspace `package.json` files                              | None                                                        |
| [`sync-develop-to-staging.sh`](sync-develop-to-staging.sh) | Fast-forward `staging` from `develop`; waits for **Publish (staging)**               | [Publish (staging)](/.github/workflows/publish-staging.yml) |
| [`sync-staging-to-main.sh`](sync-staging-to-main.sh)       | Fast-forward `main` from `staging`; waits for **Publish (main)**; verifies GHCR tags | [Publish (main)](/.github/workflows/publish-main.yml)       |
| [`preflight-rtm-promote.sh`](preflight-rtm-promote.sh)     | Read-only RTM checks before main sync                                                | None                                                        |

## GHCR helpers

| Script                                                               | Purpose                                     |
| -------------------------------------------------------------------- | ------------------------------------------- |
| [`../ghcr/getLatestStagingTag.sh`](../ghcr/getLatestStagingTag.sh)   | Latest `X.Y.Z-staging.N` for one image path |
| [`../ghcr/verifyProductionTags.sh`](../ghcr/verifyProductionTags.sh) | Confirm `X.Y.Z` and `:latest` after RTM     |
| [`../ghcr/lib/podverse-images.sh`](../ghcr/lib/podverse-images.sh)   | Shared image list and tag helpers           |

## Documentation

- [PUBLISH.md](/docs/operations/deploy/PUBLISH.md) — tag patterns and workflow overview
- [PRODUCTION-RELEASE.md](/docs/operations/deploy/PRODUCTION-RELEASE.md) — RTM operator runbook
- [ALPHA-DEPLOYMENT.md](/docs/operations/deploy/ALPHA-DEPLOYMENT.md) — preprod and local alpha

## Release notes

One file per formal version: `release-notes/X.Y.Z.md`. Partytime uses the same
path. Podverse staging tags (`X.Y.Z-staging.N`) do not get their own files.

Edit that file as the version takes shape. Each staging publish uses whatever
is committed on `develop` at that moment as the GitHub prerelease body. The
production release of `X.Y.Z` uses the same file from the `staging` commit, so
finish the notes there before promoting `main`. Git history of the file is the
record of what each staging prerelease said. Do not concatenate those
prerelease bodies later.

`sync-develop-to-staging.sh`, `preflight-rtm-promote.sh`, and
`sync-staging-to-main.sh` refuse when the file is missing, empty, or not
committed on the revision being released. Publish workflows read the same file
for the GitHub release body.

Store notes are separate and shorter: `release-notes/mobile/X.Y.Z.md`, with
`X.Y.Z.ios.md` or `X.Y.Z.android.md` only when that store should differ. Store
builds and submits refuse without the resolved file. EAS cannot upload that
text; the script prints it to paste. See
[release-notes/mobile/README.md](/release-notes/mobile/README.md).

Web notes live in `release-notes/web/X.Y.Z.md`. Nothing displays or requires
them yet. See [release-notes/web/README.md](/release-notes/web/README.md).

### Release scratchpad

Agents append an entry to `release-notes/scratchpad.md` with each change that
ships. Before a staging sync, an agent runs **abcreleasenotes**: it moves those
entries into the GitHub, store, and web notes (or drops them) and empties the
scratchpad in the same commit.

`sync-develop-to-staging.sh` and store builds run
[`require-empty-release-scratchpad.sh`](require-empty-release-scratchpad.sh).
They refuse when the scratchpad is missing, or still has entries, on the
revision being released.

## Typical flow

Run from repo root on **`develop`**:

```bash
./scripts/publish/bump-version.sh
./scripts/publish/sync-develop-to-staging.sh
./scripts/publish/preflight-rtm-promote.sh
./scripts/publish/sync-staging-to-main.sh
```

Before each staging sync, run abcreleasenotes and commit its result on
`develop`. That keeps `release-notes/X.Y.Z.md` current and the scratchpad
empty. Finish the notes before the main promotion.

Requires `gh auth login` — sync scripts use `gh` internally to wait for publish workflows before
exiting.
