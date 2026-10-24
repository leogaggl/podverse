**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# Stop local env setup from upgrading an older checkout

`make local_env_setup` runs `scripts/local-env/setup.sh`. Three pieces of that script exist only so a checkout from before the home-secrets layout keeps working:

- `migrate-local-secrets-to-home.sh` copies passwords out of repo env files into `~/.config/podverse/local-env-overrides/local-secrets.env` when the home keys are empty. `setup.sh` calls it before it generates secrets. `persist-local-secrets.sh`, which runs at the end of setup, already creates the home file and writes the resolved secrets. The migrate script is the same copy, run early so an older repo `db.env` wins over newly generated passwords.
- `load_overrides` sources `lightning.env` last so MetaBoost keys that older installs left only in `lightning.env` win over empty assignments in `metaboost.env`. Current examples define those keys only in `dev/env-overrides/local/metaboost.env.example`. `lightning.env` in that directory does not define them.
- After writing sidecar env files, setup deletes a `NODE_ENV=` line from `infra/config/local/web-sidecar.env` and `infra/config/local/management-web-sidecar.env` "from an older setup." The script never writes `NODE_ENV` into those two files. Do not touch the Kubernetes sidecar env files; `infra/k8s/base/web/source/web-sidecar.env` and `infra/k8s/base/management-web/source/management-web-sidecar.env` set `NODE_ENV=production` on purpose.

`make local_env_export_secrets_to_home` (`export-local-secrets-to-home.sh`) stays. That is the explicit copy from the current checkout into home, and it overwrites. A new setup still reads home `local-secrets.env` when the file exists, generates a secret when the value is empty or a placeholder, and persists the result.

Do not edit `docs/development/env/LOCAL-ENV-OVERRIDES.md` (area H) or `dev/env-overrides/**`.

## Rows

R13, R22

## Runs after

none

## Files

scripts/local-env/setup.sh
scripts/local-env/migrate-local-secrets-to-home.sh
scripts/local-env/local-secrets-lib.sh
makefiles/local/Makefile.local.env.mk

## Tests

none

## Release scratchpad

Append this to `release-notes/scratchpad.md` when this prompt is the only one in its phase. When it shares a phase, do not edit the scratchpad; put the same entry in the final message under "Release notes entry".

```markdown
## Local env setup no longer copies an older checkout's secrets

- Surfaces: ops
- Change: `make local_env_setup` no longer runs `migrate-local-secrets-to-home.sh`, no longer sources `lightning.env` last to keep MetaBoost keys that used to live there, and no longer strips `NODE_ENV` from the local web sidecar env files. Home secrets still come from `local-secrets.env`. `make local_env_export_secrets_to_home` still copies the current checkout into home when asked.
- Who notices: a machine whose real passwords exist only in repo env files, or whose MetaBoost values exist only in `lightning.env`
- Operator steps: put secrets in `~/.config/podverse/local-env-overrides/local-secrets.env`, or run `make local_env_export_secrets_to_home` from the checkout that has them, before `make local_env_setup`. Put MetaBoost values in `metaboost.env`.
```

## Edits

### setup.sh

1. Delete the line `bash "$SCRIPT_DIR/migrate-local-secrets-to-home.sh"`. Leave the block immediately after it that loads `HOME_LOCAL_SECRETS` when that file exists, and leave the later call to `persist-local-secrets.sh`.

2. Replace `load_overrides` so it sources every `$OVERRIDES_DIR/*.env` in one loop. Delete the `lightning_file` variable, the skip of `lightning.env`, the second source of `lightning.env`, and the comment that starts "This keeps migration-safe ordering". Keep the early return when the overrides directory is missing, and keep `set -a` / `set +a` around each source. The shellcheck `SC1090` disable stays on the source line.

3. Delete the comment "Sidecars do not use NODE_ENV; remove it if present (e.g. from an older setup)." and the `for file in "$WEB_SIDECAR_INFRA_ENV" "$MANAGEMENT_WEB_SIDECAR_INFRA_ENV"` loop that `sed`-deletes `^NODE_ENV=`. Those variables point at `infra/config/local/web-sidecar.env` and `infra/config/local/management-web-sidecar.env`. Do not edit the Kubernetes `web-sidecar.env` or `management-web-sidecar.env` under `infra/k8s/`.

### Delete the migrate script

Delete `scripts/local-env/migrate-local-secrets-to-home.sh`. Nothing else calls it. Do not delete `persist-local-secrets.sh` or `export-local-secrets-to-home.sh`.

### Comments that name the migrate script

In `scripts/local-env/local-secrets-lib.sh`, the second line says the file is sourced by setup.sh and persist/migrate scripts. Replace it with: "Sourced by setup.sh, persist-local-secrets.sh, and export-local-secrets-to-home.sh (not executed directly)."

In `makefiles/local/Makefile.local.env.mk`, the comment above `local_env_export_secrets_to_home` says "One-time: copy this checkout's infra secrets into ~/.config (use from primary checkout that owns Postgres)." Replace it with: "Copy this checkout's infra secrets into ~/.config (use from the checkout that owns Postgres)." Leave the target and the script it runs.
