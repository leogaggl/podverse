---
name: abcdeploysteps
description: When the operator says abcdeploysteps plus a repo and an environment (abcdeploysteps podverse alpha), check deploy blockers and, if alpha is clear and there is something to ship, write a local step-by-step deploy checklist. Use only for that keyword, and only when the repo word is podverse.
---

# abcdeploysteps

The operator is asking for a deploy checklist, not for the agent to deploy. Investigate, warn,
and write the steps. Do not run publish, push, EAS, Argo, or kubectl apply.

## The repo and the environment are required

`abcdeploysteps` is three words. The second word is the repo. The third word is the environment.

- `abcdeploysteps podverse alpha`
- `abcdeploysteps podverse beta`
- `abcdeploysteps podverse production`

This skill applies only when the repo word is `podverse`. `abcdeploysteps metaboost …` belongs to
the Metaboost repo's skill. Do not write a Podverse checklist for it, and do not add Metaboost
steps here.

If the repo word or the environment word is missing, ask for both and stop. Do not infer the repo
from the open workspace. Do not assume alpha.

## What the names mean right now

Only **alpha** is in use. Beta and production are real words for later. They are not aliases for
alpha.

| Word         | Right now                                                                 |
| ------------ | ------------------------------------------------------------------------- |
| `alpha`      | The live preprod cluster and the Podverse Next store app. See below.      |
| `beta`       | No cluster and no GitOps overlay. Stop.                                   |
| `production` | No production cluster. Stop. Do not promote `main` or use EAS production. |

**Alpha, server.** GitOps namespace `podverse-alpha` in the `k.podcastdj.com` checkout. Argo CD
tracks that repo's `main` branch. Public hosts:

- `https://alpha.podcastdj.com` (web)
- `https://api-alpha.podcastdj.com` (API)
- `https://management.alpha.podcastdj.com` (management web)
- `https://management-api.alpha.podcastdj.com` (management API)

**Alpha, mobile.** Podverse Next, bundle id `com.podverse.app.next`. Store builds use EAS profile
`beta` (the EAS `preview` environment). That is the alpha binary. It is not the old Podverse store
listing, and it is not `PROFILE=production`.

When the operator says this meaning has changed, update this skill before writing another
checklist.

`make alpha_*` in the Podverse repo is a **local Docker** alpha. It does not deploy
`alpha.podcastdj.com`. Never put those targets in an alpha checklist.

## Stop before writing a checklist

Write the temp file only when alpha is clear **and** at least one surface below has changes since
its last deploy. Otherwise say why and stop. Do not write a partial file that skips the warning.

### Hard stops

- Environment is `beta` or `production`. Say those environments are not stood up. Do not draft a
  promote-to-`main` or `PROFILE=production` run from this keyword.
- Nothing to ship (see **What changed**).
- Dirty worktree on Podverse (`git status --porcelain`). The staging sync and store builds refuse
  or prompt. List the paths. Commit or stash is the operator's step. Stop so the checklist is not
  written against unknown files.
- `release-notes/scratchpad.md` is missing or not empty. Tell the operator to run
  **abcreleasenotes**, commit that on `develop`, then say `abcdeploysteps podverse alpha` again.
- `release-notes/<X.Y.Z>.md` is missing or empty for the root `package.json` version. The staging
  sync refuses. Same for `release-notes/mobile/<X.Y.Z>.md` when mobile will build.
- `staging` is not a fast-forward ancestor of `develop`. Do not suggest a force push.
- The commits need a database wipe, a migration squash reload, a PVC delete, or a namespace
  teardown. Say so and wait. Do not put those commands in the file unless the operator confirms
  that wipe in this conversation.
- `gh auth status` is not logged in. The sync script needs it.
- The checklist would change the bundle id, ship EAS Update, or point a binary at the old Podverse
  store listing.

A docs-only, test-only, or `.cursor/`-only diff is nothing to ship.

### Warn, and leave the step out until they agree

These are significantly inadvisable on a routine alpha deploy. Name them and do not include them
unless the operator explicitly wants that step in this conversation:

- `./scripts/publish/bump-version.sh` (it rewrites every workspace version, pushes `develop`, and
  bypasses hooks). The next `X.Y.Z-staging.N` is chosen by **Publish (staging)** from the current
  base version. Do not bump just to deploy.
- `./scripts/publish/sync-staging-to-main.sh` or any `main` promote. That publishes production GHCR
  tags (`X.Y.Z` and `:latest`). Alpha pins stay on `X.Y.Z-staging.N`.
- `PROFILE=production`, or `make mobile_eas_env_set` (changes the URLs baked into later builds).
- Pinning GitOps to a tag that does not exist yet.
- Editing third-party image tags (Postgres, Valkey, ActiveMQ) while bumping Podverse.
- Deleting `db-data-podverse-db-0` or running `apps/podverse-alpha/scripts/ops/reset-alpha-db.sh`.
- A second paste in the same block as an EAS `build` or `submit`. Those commands read the next
  line as the prompt answer. A blank line is "no" and cancels the build.

## What changed

Last **server** deploy is the immutable tag pinned in `k.podcastdj.com`, not floating `:staging`.
Read `?ref=` under `apps/podverse-alpha/` (every Podverse base ref is the same tag). Compare:

```bash
git fetch origin
git log --oneline <pinned-tag>..origin/develop
```

Split that log:

- **Server** — anything that ships in GHCR images or in `infra/k8s/base/` (apps other than mobile,
  packages, Dockerfiles, Kustomize bases). This includes a base-manifest change with no app code
  change, because GitOps `?ref=` is that tag.
- **Mobile** — `apps/mobile/` and the workspace packages `apps/mobile/package.json` depends on.
  The last mobile deploy is the git commit on the newest finished EAS `beta` build for that
  platform, not the cluster pin. `make mobile_eas_ios_list` and `make mobile_eas_android_list`
  are read-only. If they fail, say mobile is unconfirmed and ask. Do not guess that mobile must
  ship.

Omit a lane whose paths did not change. Say that in the reply.

## Where the checklist file goes

When alpha is clear and a lane has changes, write one markdown file locally. Do not put it in the
git repo.

`/tmp/abcdeploysteps/podverse-alpha-<YYYYMMDD-HHMM>.md`

Create the directory if needed. No secrets, tokens, or decrypted env. Tell the operator the path.
The chat reply is the same checklist, with the blockers (or "clear") first.

## How to write the file

Short headings, ordered steps, copy-paste commands. Almost no explanation. Fill in the real pin,
version, and commit range. The new staging number does not exist until **Publish (staging)**
finishes. Until then write `<X.Y.Z-staging.N from the Publish (staging) log>` and use that same
placeholder in the GitOps steps.

Operator commands are fish-safe (**fish-operator-commands**): fence labeled `bash`, no heredoc,
no `VAR=value command`, no `[[ ]]`. One command per fence when the command prompts (every
`make mobile_eas_*` build, submit, and rollout).

Name the cwd in bold before each fence. Use **Root** and **Mobile** from
`.vscode/terminals.json` for Podverse commands. GitOps commands are a terminal whose cwd is the
`k.podcastdj.com` repo root. There is no GitOps tab.

### Step numbers

Label every operator step `<number><letter>`: `1a`, `1b`, `2a`, `3a`, `3b`, `3c`.

The number is one terminal. Letters in that number run there, in order. Do not paste `1b` into a
different terminal, and do not paste it until `1a` in that terminal has finished.

A different number is a different terminal. It can run beside the others when the start condition
on its first letter says so. Put that start condition on the first letter (`2a` starts when `1b`
prints the Linux `node_modules` line).

The recipes below use `1.` `2.` `3.` as content order. Those are not the labels in the file or the
reply. Translate them into `1a`, `1b`, `2a`, and so on when writing the checklist.

Commands run from the Podverse repo root or the GitOps repo root. Prefer `make mobile_eas_*`.
Publish has no Make target; use `scripts/publish/`. Do not invent a wrapper.

### File shape

```text
# abcdeploysteps podverse alpha — <local time>

Clear to deploy.
Server: <pinned tag> -> next staging tag of <X.Y.Z>
Mobile: <include, or "no mobile changes">
Commits: <range>

## Do not
<the inadvisable list that applies this time, one line each>

## Lanes
<which terminals run at the same time>

## Steps
<1a, 1b, 2a, 3a, 3b. Same number is one terminal, in letter order. A different number is a separate terminal.>
```

### Lanes that may run at the same time

Put this table in the file, dropping rows for lanes you omitted.

| Lane               | Starts when                                       | Terminal                             |
| ------------------ | ------------------------------------------------- | ------------------------------------ |
| Publish (staging)  | `develop` is clean, pushed, notes committed       | **Root**                             |
| Mac `node_modules` | Sync script printed the Linux `node_modules` line | Second **Root**. Not the sync shell. |
| iOS build          | Same moment as publish, if mobile changed         | **Mobile**                           |
| Android build      | Same moment as the iOS build                      | Second **Mobile**                    |
| GitOps pin         | Publish (staging) succeeded and the tag exists    | `k.podcastdj.com` repo root          |
| iOS submit         | That iOS build finished                           | **Mobile** (after the build)         |
| Android submit     | That Android build finished                       | Second **Mobile**                    |

GitOps push and the two store submits may overlap. Do not start GitOps before the tag exists.
Do not sync Argo by hand while auto-sync is rolling out a later wave ahead of ops.

The Mac reinstall may start when the sync script prints
`node_modules now matches Linux optional deps`. Docker has exited by then. The script keeps
going (push `staging`, wait for the workflow). Do not reinstall in that same shell. `apps/mobile`
`node_modules` is not touched by this script. Do not run `npm run mobile:install` unless a version
bump ran `update-lockfile-linux.sh`.

### Server steps (only if server changed)

1. **Root.** Confirm `develop` matches what will ship. If it is ahead of `origin/develop`, the
   operator pushes `develop` before the sync. Do not push it yourself.

```bash
git status
git push origin develop
```

2. **Root.** Publish images. This fast-forwards `staging`, pushes, and waits for
   **Publish (staging)**. It bind-mounts the repo into Docker for `npm ci`.

```bash
./scripts/publish/sync-develop-to-staging.sh
```

3. **Second Root**, after the Linux `node_modules` line:

```bash
rm -rf node_modules && npm install
```

4. Read the immutable tag from the workflow log (`X.Y.Z-staging.N`). That string is the Git tag
   and every GHCR image tag.

### GitOps steps (only after that tag exists)

Repo is the local `k.podcastdj.com` checkout. Argo applications under `argocd/podverse-alpha/`
use `targetRevision: main` and automated sync. Pushing `main` is what rolls the cluster.
`?ref=` is the Podverse git tag. It is not the GitOps branch.

In one commit, set all of these to the new tag:

- Every `https://github.com/podverse/podverse//infra/k8s/base/...?ref=` under
  `apps/podverse-alpha/*/kustomization.yaml`
- Every `newTag` whose image name is `ghcr.io/podverse/podverse/` (apps and
  `extension-prometheus`)
- `READINESS_API_EXPECTED_RELEASE` in `apps/podverse-alpha/web/source/web-sidecar.env` and
  `apps/podverse-alpha/management-web/source/management-web-sidecar.env`

Leave Postgres, Valkey, and ActiveMQ tags as they are. If this release changes env or overlays
beyond the pin, include those file edits in the same commit. Skip secret generators unless a new
secret is required for startup. Never commit decrypted secrets.

**k.podcastdj.com repo root:**

```bash
bash ./scripts/check_podverse_alpha_version_contract.sh
bash ./scripts/secret-generators/check_db_secret_contract.sh alpha
```

Then the operator commits and pushes `main`. Fish-safe message, with the real tag filled in:

```bash
git add apps/podverse-alpha
git commit -m 'Pin podverse-alpha to X.Y.Z-staging.N.'
git push
```

Auto-sync follows sync waves: `common` (-3), `db` / `keyvaldb` / `mq` (-2), `ops` (-1),
`api` / `management-api` (0), then `workers` / `cron` / `web` / `management-web` (1). Do not add
manual `argocd app sync` commands unless an application is stuck. If one is stuck, sync in that
wave order, one app at a time (`podverse-alpha-common`, then `podverse-alpha-db`, and so on).

Before any `kubectl`, have the operator confirm the context. Put this in the file and wait if
they have not confirmed in this conversation:

```bash
kubectl config current-context
kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'
```

After `db` and `ops` are healthy:

```bash
kubectl -n podverse-alpha create job --from=cronjob/ops-db-verify-bootstrap-contract ops-db-verify-bootstrap-contract-manual
kubectl -n podverse-alpha logs -f job/ops-db-verify-bootstrap-contract-manual
```

Expect `Bootstrap contract verification passed for app and management databases.` If it fails,
the deploy is not done. Do not delete the PVC as the next step.

Smoke:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://alpha.podcastdj.com/
curl -fsS -o /dev/null -w '%{http_code}\n' https://api-alpha.podcastdj.com/api/v2/
curl -fsS -o /dev/null -w '%{http_code}\n' https://management.alpha.podcastdj.com/
curl -fsS -o /dev/null -w '%{http_code}\n' https://management-api.alpha.podcastdj.com/
```

### Mobile steps (only if mobile changed)

Profile stays `beta`. Copy the current prompt-answer table from
**mobile-store-builds-on-demand** into the file next to these steps. One command per fence.
Answers that stay the same: start the build with `y`; encryption `Y` when asked; decline
`expo-updates`; do not log in to Apple when remote credentials are already in use; do not
generate a new certificate, profile, or keystore.

**Mobile:**

```bash
make mobile_eas_ios_build
```

**Second Mobile** (same time as the iOS build and as **Publish (staging)**):

```bash
make mobile_eas_android_build
```

After that platform's build is FINISHED, and the printed commit matches the commit you meant to
ship:

```bash
make mobile_eas_ios_submit
```

```bash
make mobile_eas_android_submit
```

iOS submit goes to TestFlight. Paste the printed notes into What to Test. Android submit uploads
a Play internal draft. Testers see nothing until a separate rollout. Only include rollout when
the operator wants testers on this binary, in its own fence, and only for the versionCode printed
for the build just made:

```bash
make mobile_eas_android_submit ROLLOUT=1
```

Type that versionCode when asked. If the script prints an older finished build, the answer is
Return, which cancels.

Add the CarPlay or Android Auto manual check only when this diff touches that surface. Point at
the checklist path in `apps/mobile/modules/podverse-media-engine/`. Do not paste those steps.

## Reply shape

1. Clear, or the blockers. Blockers end the reply.
2. Which surfaces changed, from which tag or build, in a few commit subjects.
3. The lanes that run together.
4. The steps (same text as the file).
5. The temp file path.

Do not run the steps. If the operator later says to run one, still refuse push, EAS build or
submit, Argo, secret generation, and anything that deletes cluster data. Repeat the warning
before any step in the inadvisable list.
