# Plan self-check (trial)

A COPY-PASTA prompt that names this file is the operator asking you to run these checks before
handing back. For that prompt only, it replaces "do not run tests during agent work". The
operator still runs the full verification once, after the last prompt in the set.

## Load the toolchain once

In the first shell command that needs `node`, from the repo root:

```bash
eval "$(direnv export zsh)"
```

Shell state persists, so later commands call `npm` directly. If `node` is still missing, fall
back to `./scripts/nix/with-env <command>`. If the sandbox blocks a write (a cache or `dist`),
rerun that command with full permissions.

## Run only what this prompt changed

Find changed paths with `git status --porcelain`. When another prompt runs at the same time,
`git status` shows its changes too: check only the files your prompt owns in
`00-EXECUTION-ORDER.md`, and report a failure in the other prompt's files instead of fixing it.
Then, in this order:

1. Each changed `packages/<name>`, in build order (**build-order**):
   `npm run build -w packages/<name>`. That runs the package's lint and `tsc`, and dependents
   type-check against its `dist`. `packages/ui` has no build:
   `npm run type-check -w packages/ui`.
2. Each changed app: `npm run type-check -w apps/<app>`. Mobile: `npm run type-check:mobile`.
3. Unit tests for each changed workspace with a `test` script: `npm run test -w <workspace>`.
   Mobile: `npm --prefix apps/mobile run test`. Skip `apps/api` and `apps/management-api`; their
   suites need Postgres and Valkey and stay operator-run.
4. A changed i18n catalog: `npm run i18n:validate`.

Do not run full `npm run lint`, `npm run test:unit`, E2E (`make e2e_*`), Maestro,
`npm run test:e2e:api`, or anything that needs Docker.

## Fixing

- Fix failures this prompt caused, in at most two rounds. Then stop and report.
- A type error inside a package you did not change usually means a stale `dist`. Run
  `npm run build:packages` once and retry before treating it as real.
- Report failures that predate this prompt, look flaky, or need services. Do not chase them.
- Never weaken, skip, or delete a test to make it pass.

## Report

One line per command in the final message: the command, pass or fail, and what you fixed. No
operator verification block unless this is the last prompt in the set
(**response-ending-make-verify** § Plan sets).
