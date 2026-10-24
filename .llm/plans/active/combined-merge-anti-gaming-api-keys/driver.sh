#!/usr/bin/env bash
# Driver for the combined-merge-anti-gaming-api-keys plan set.
#
# Merges origin/develop, then feature/popularity-anti-gaming and feature/developer-api-keys into
# feature/combined, one plan-runner step per branch, then a whole-tree verification step. Agents
# resolve and stage; this script is the only thing that commits and pushes, after every step,
# with the operator's git credentials. It then starts Mobile E2E Metro, the mobile E2E API, and
# mobile test-assets from this checkout, installs the iOS E2E build, runs abcsmoketest, and pushes
# its fixes.
#
# Usage (Root tab of the podverse_combined window):
#   caffeinate -dims bash .llm/plans/active/combined-merge-anti-gaming-api-keys/driver.sh
#   caffeinate -dims bash .llm/plans/active/combined-merge-anti-gaming-api-keys/driver.sh --resume 'Answer.'
#
# --resume passes the answer to a smoke run that stopped with a question. Safe to rerun: ticked
# steps are skipped, a merge left open by an interrupted step is picked up by a fresh agent, and an
# open smoke run is continued.

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)" || exit 1
cd "$REPO_ROOT" || exit 1

SLUG=combined-merge-anti-gaming-api-keys
BRANCH=feature/combined
ACTIVE=".llm/plans/active"
PLAN_DIR="$ACTIVE/$SLUG"
COPY_PASTA="$PLAN_DIR/COPY-PASTA.md"
DEFERRED_DIR="$ACTIVE/$SLUG-deferred"
DEFERRED="$DEFERRED_DIR/00-SUMMARY.md"
RUNS_DIR=".artifacts/plan-runner/$SLUG"
LOG_DIR=".artifacts/$SLUG"
METRO_PID_FILE="$LOG_DIR/metro.pid"
STARTED_AT="$(date +%s)"

MERGES="01 feature/popularity-anti-gaming
02 feature/developer-api-keys"

SMOKE_ARGS=()
case "${1:-}" in
  "") ;;
  --resume)
    [ -n "${2:-}" ] || {
      echo "Usage: driver.sh [--resume 'Your answer.']" >&2
      exit 1
    }
    SMOKE_ARGS=(--resume "$2")
    ;;
  *)
    echo "Usage: driver.sh [--resume 'Your answer.']" >&2
    exit 1
    ;;
esac

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_DIR/driver.log") 2>&1

log() { printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() {
  log "STOPPED: $*"
  exit 1
}

defer() {
  mkdir -p "$DEFERRED_DIR"
  if [ ! -f "$DEFERRED" ]; then
    printf '# %s — deferred\n' "$SLUG" >"$DEFERRED"
  fi
  printf '\n## %s\n\n%s\n' "$1" "$2" >>"$DEFERRED"
  log "Deferred: $1"
}

step_ticked() { grep -q "^- \[[xX]\] \*\*$1 " "$COPY_PASTA"; }
tick_step() { perl -pi -e "s/^- \[ \] \*\*$1 /- [x] **$1 /" "$COPY_PASTA"; }
merge_in_progress() { git rev-parse -q --verify MERGE_HEAD >/dev/null; }

blocked_entries() {
  local state="$1/state.json"
  [ -f "$state" ] || return 0
  node -e '
    const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    for (const b of s.blocked || []) console.log(`${b.id}: ${b.reason}`);
  ' "$state"
}

push_branch() {
  local attempt
  for attempt in 1 2 3; do
    if git push -q -u origin "$BRANCH"; then
      log "Pushed $BRANCH ($(git rev-parse --short HEAD))."
      return 0
    fi
    log "Push attempt $attempt failed."
    sleep 60
  done
  defer "Push failed at $(git rev-parse --short HEAD)" \
    "Three pushes of \`$BRANCH\` failed. The commits are local; run \`git push origin $BRANCH\`."
  return 1
}

# Stages everything, but never a new .env file (only .env.example templates are committed).
stage_all() {
  git add -A
  git diff --cached --name-only --diff-filter=A |
    grep -E '(^|/)\.env(\.[^/]*)?$' | grep -v -E '\.example$' |
    while IFS= read -r f; do
      git reset -q -- "$f"
      log "Left $f unstaged: env files are not committed."
    done
}

commit_and_push() {
  stage_all
  if git diff --cached --quiet; then
    log "Nothing to commit for: $1"
    return 0
  fi
  git commit -q -m "$1" && log "Committed: $1" && push_branch
}

conflict_marker_files() {
  git diff --cached --name-only --diff-filter=AM -z HEAD |
    xargs -0 -r grep -lIE '^(<<<<<<<|>>>>>>>)( |$)' 2>/dev/null || true
}

# Drops a merge attempt and everything the step changed, but keeps the deferred file.
abort_merge() {
  local backup="$LOG_DIR/deferred.backup.md"
  rm -f "$backup"
  [ -f "$DEFERRED" ] && cp "$DEFERRED" "$backup"
  merge_in_progress && git merge --abort
  git reset -q --hard HEAD
  git clean -fdq -e "/$DEFERRED_DIR/"
  if [ -f "$backup" ]; then
    mkdir -p "$DEFERRED_DIR"
    mv "$backup" "$DEFERRED"
  fi
  log "Merge attempt dropped; $BRANCH is back at $(git rev-parse --short HEAD)."
}

# Runs one step and stops after it. A blocked entry left in state.json was already handled
# (aborted and ticked) or was an interrupted step, so --clear lets a fresh agent take the step.
run_step() {
  local id="$1" clear=""
  [ -n "$(blocked_entries "$RUNS_DIR")" ] && clear="--clear"
  ./scripts/abcplan/run.sh run "$SLUG" $clear --stop-after "$id"
}

run_step_with_retry() {
  local id="$1" rc
  run_step "$id"
  rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 2 ]; then
    log "Runner exited $rc on step $id. Retrying in two minutes."
    sleep 120
    run_step "$id"
    rc=$?
  fi
  return "$rc"
}

block_reason() { blocked_entries "$RUNS_DIR" | grep "^$1:" | head -1; }

finalize_merge() {
  local id="$1" ref="$2" outcome unmerged markers
  outcome="$(grep -E '^MERGE-OUTCOME: ABORT' "$RUNS_DIR/$id.md" 2>/dev/null | tail -1)"
  if [ -n "$outcome" ]; then
    abort_merge
    defer "$id — $ref was not merged" \
      "The step chose not to integrate it: ${outcome#MERGE-OUTCOME: }. Its final message is \`$RUNS_DIR/$id.md\` on the computer that ran the merge. Settle the question, then merge \`origin/$ref\` into \`$BRANCH\` by hand."
    commit_and_push "Record skipped merge of $ref"
    return
  fi
  unmerged="$(git diff --name-only --diff-filter=U)"
  stage_all
  markers="$(conflict_marker_files)"
  if [ -n "$unmerged$markers" ]; then
    abort_merge
    defer "$id — $ref left unresolved conflicts" \
      "Step $id reported done but left these unresolved, so the driver dropped the merge: $(echo $unmerged $markers). Final message: \`$RUNS_DIR/$id.md\`."
    commit_and_push "Record skipped merge of $ref"
    return
  fi
  git commit -q --no-edit && log "Committed the merge of $ref." && push_branch
}

merge_step() {
  local id="$1" ref="$2" rc reason
  if step_ticked "$id"; then
    merge_in_progress && finalize_merge "$id" "$ref"
    return
  fi
  git fetch -q origin "$ref" || git fetch -q origin "$ref" || die "Could not fetch $ref."
  if ! merge_in_progress && git merge-base --is-ancestor "origin/$ref" HEAD; then
    log "$ref is already in $BRANCH."
    tick_step "$id"
    return
  fi
  if ! merge_in_progress; then
    # npm install rewrites lockfiles; that churn would block the merge.
    git checkout -q -- package-lock.json apps/mobile/package-lock.json
    log "Step $id: merging origin/$ref."
    git merge --no-ff --no-commit -m "Merge $ref into $BRANCH" "origin/$ref" ||
      log "The merge has conflicts; step $id resolves them."
    merge_in_progress || die "git merge did not leave a merge in progress for $ref."
  fi
  run_step_with_retry "$id"
  rc=$?
  case "$rc" in
    0) finalize_merge "$id" "$ref" ;;
    2)
      reason="$(block_reason "$id")"
      abort_merge
      defer "$id — $ref was not merged (step blocked)" \
        "The step stopped with: ${reason:-no reason recorded}. Final message: \`$RUNS_DIR/$id.md\`. The driver dropped the merge and went on."
      tick_step "$id"
      commit_and_push "Record skipped merge of $ref"
      ;;
    *)
      die "plan-runner failed twice on step $id (exit $rc). The merge is left in progress; rerun this command to continue."
      ;;
  esac
}

verify_step() {
  local rc reason
  step_ticked 03 && return
  run_step_with_retry 03
  rc=$?
  case "$rc" in
    0) commit_and_push "Combined: whole-tree verification fixes" ;;
    2)
      reason="$(block_reason 03)"
      defer "03 — verification stopped" \
        "Step 03 stopped with: ${reason:-no reason recorded}. Final message: \`$RUNS_DIR/03.md\`. Its partial fixes are committed; the smoke run ran anyway."
      tick_step 03
      commit_and_push "Combined: partial whole-tree verification fixes"
      ;;
    *) die "plan-runner failed twice on step 03 (exit $rc). Rerun this command to continue." ;;
  esac
}

merge_develop() {
  git merge-base --is-ancestor origin/develop HEAD && {
    log "origin/develop is already in $BRANCH."
    return 0
  }
  git checkout -q -- package-lock.json apps/mobile/package-lock.json
  log "Merging origin/develop."
  if ! git merge -q --no-ff -m "Merge develop into $BRANCH" origin/develop; then
    git merge --abort
    die "Merging origin/develop conflicted. Merge it by hand, commit, then rerun this command."
  fi
  push_branch
}

port_pid() { lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -1; }

port_cwd() {
  local pid
  pid="$(port_pid "$1")"
  [ -n "$pid" ] || return 1
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

# True when the port is free or its listener runs from this checkout.
port_free_or_ours() {
  local cwd
  [ -n "$(port_pid "$1")" ] || return 0
  cwd="$(port_cwd "$1")"
  case "$cwd/" in
    "$REPO_ROOT"/*) return 0 ;;
  esac
  return 1
}

port_8081_busy() { [ -n "$(port_pid 8081)" ]; }

stop_own_metro() {
  local pid waited=0
  pid="$(port_pid 8081)"
  [ -n "$pid" ] || return 0
  port_free_or_ours 8081 || die "Port 8081 belongs to another checkout. Stop that Metro and rerun."
  log "Stopping this checkout's Metro (pid $pid) before reinstalling dependencies."
  kill "$pid" 2>/dev/null
  while port_8081_busy; do
    sleep 2
    waited=$((waited + 2))
    [ "$waited" -ge 60 ] && die "Metro on 8081 did not stop. Stop it by hand and rerun."
  done
}

start_metro() {
  local waited=0
  if port_8081_busy; then
    port_free_or_ours 8081 && log "Mobile E2E Metro from this checkout is already running." && return 0
    return 1
  fi
  log "Starting Mobile E2E Metro from this checkout (log: $LOG_DIR/metro.log)."
  nohup npm run mobile:dev:e2e </dev/null >"$LOG_DIR/metro.log" 2>&1 &
  echo $! >"$METRO_PID_FILE"
  while ! port_8081_busy; do
    sleep 5
    waited=$((waited + 5))
    [ "$waited" -ge 300 ] && return 1
  done
  log "Mobile E2E Metro is listening on 8081."
}

start_mobile_services() {
  if ! npm run -s mobile:e2e:api:health >/dev/null 2>&1; then
    log "Starting the mobile E2E API from this checkout."
    npm run mobile:e2e:api:bg </dev/null ||
      defer "Mobile E2E API did not start" "\`npm run mobile:e2e:api:bg\` failed; see $LOG_DIR/driver.log. The smoke iOS step retries it."
  fi
  if ! npm run -s mobile:e2e:test-assets:health >/dev/null 2>&1; then
    log "Starting mobile test-assets from this checkout."
    npm run mobile:e2e:test-assets:bg </dev/null ||
      defer "Mobile test-assets did not start" "\`npm run mobile:e2e:test-assets:bg\` failed; see $LOG_DIR/driver.log. The smoke iOS step retries it."
  fi
}

preflight() {
  [ "$(git branch --show-current)" = "$BRANCH" ] || die "Check out $BRANCH in this worktree first."
  if [ ! -f "$COPY_PASTA" ]; then
    [ -d ".llm/plans/completed/$SLUG" ] && die "The set is already archived; nothing left to run."
    die "Missing $COPY_PASTA."
  fi
  command -v node >/dev/null || die "node is not on PATH. Run from this repo's root with direnv loaded."
  docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop and rerun."
  [ -d ../plan-runner/node_modules ] || die "Run: npm --prefix ../plan-runner install"
  [ -f "$HOME/.cursor/sdk/auth.json" ] || [ -n "${CURSOR_API_KEY:-}" ] ||
    die "Run: node ../plan-runner/run-plan-set.mjs --login"
  port_free_or_ours 4230 ||
    die "Port 4230 is the mobile E2E API from $(port_cwd 4230). In that checkout run: npm run mobile:e2e:api:stop"
  port_free_or_ours 2111 ||
    die "Port 2111 is test-assets from $(port_cwd 2111). In that checkout run: npm run mobile:e2e:test-assets:stop"
  port_free_or_ours 8081 ||
    die "Port 8081 is Metro from $(port_cwd 8081). Stop Mobile Metro and Mobile E2E Metro in every other window."
  if ! merge_in_progress && [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    die "Tracked files have uncommitted changes. Commit or stash them first."
  fi
  git fetch -q origin || die "git fetch failed. Check your network and SSH key."
  git cat-file -e HEAD:.cursor/skills/abcsmoketest/SKILL.md 2>/dev/null ||
    git cat-file -e origin/develop:.cursor/skills/abcsmoketest/SKILL.md 2>/dev/null ||
    die "origin/develop has no abcsmoketest skill. Commit and push it to develop from the podverse checkout, then rerun."
}

# Removes last night's open abctestall run (gitignored), archives the finished combined-merge set,
# and drops its deferred file, whose only entry is that stopped run. Then commits this set and pushes.
retire_and_publish() {
  local d
  merge_in_progress && return 0
  for d in "$ACTIVE"/abctest-all-*/; do
    [ -d "$d" ] || continue
    rm -rf "$d"
    log "Removed the open abctestall run $(basename "$d")."
  done
  if [ -d "$ACTIVE/combined-merge" ] && [ ! -e .llm/plans/completed/combined-merge ]; then
    mkdir -p .llm/plans/completed
    git mv "$ACTIVE/combined-merge" .llm/plans/completed/combined-merge &&
      log "Archived the combined-merge set."
  fi
  if [ -d "$ACTIVE/combined-merge-deferred" ]; then
    git rm -rq "$ACTIVE/combined-merge-deferred" && log "Removed combined-merge-deferred."
  fi
  git add -- "$PLAN_DIR"
  if ! git diff --cached --quiet; then
    git commit -q -m "Start $SLUG plan set; archive combined-merge" &&
      log "Committed the plan set."
  fi
  git push -q -u origin "$BRANCH" || die "Pushing $BRANCH failed. Fix git push access and rerun."
  log "Pushed $BRANCH."
}

setup_once() {
  [ -f "$LOG_DIR/setup.done" ] && return 0
  log "Setting up env and dependencies."
  make local_env_worktree_setup || die "make local_env_worktree_setup failed."
  npm run deps:init || die "npm run deps:init failed."
  touch "$LOG_DIR/setup.done"
}

mobile_prep() {
  if [ -f "$LOG_DIR/mobile-prep.done" ]; then
    start_metro || return 1
    start_mobile_services
    return 0
  fi
  stop_own_metro
  log "Installing dependencies and the native iOS project for the merged tree."
  bash scripts/dev/deps-init.sh --skip-clean --with-native ||
    defer "Mobile native prep failed" "\`bash scripts/dev/deps-init.sh --skip-clean --with-native\` failed; see $LOG_DIR/driver.log."
  if ! start_metro; then
    defer "Mobile E2E Metro did not start" "Port 8081 never listened, or another process held it. See \`$LOG_DIR/metro.log\`. The smoke run does not start without it."
    return 1
  fi
  start_mobile_services
  log "Building and installing the iOS E2E app."
  npm run mobile:e2e:ios </dev/null ||
    defer "iOS E2E build failed" "\`npm run mobile:e2e:ios\` failed; see $LOG_DIR/driver.log. The smoke iOS step retries the install."
  touch "$LOG_DIR/mobile-prep.done"
}

newest_smoke_set() { ls -td "$ACTIVE"/abctest-smoke-*/ 2>/dev/null | head -1; }

smoke_finished() {
  local close
  [ -f "$LOG_DIR/smoke.started" ] || return 1
  close="$(ls -t .artifacts/plan-runner/abctest-smoke-*/Close.md 2>/dev/null | head -1)"
  [ -n "$close" ] && [ "$close" -nt "$LOG_DIR/smoke.started" ]
}

run_smoke() {
  local rc set reason
  [ -f "$LOG_DIR/smoke.done" ] && log "The smoke run already finished." && return 0
  if ! smoke_finished; then
    [ -f "$LOG_DIR/smoke.started" ] || touch "$LOG_DIR/smoke.started"
    log "Running abcsmoketest."
    ./scripts/abctest/run.sh smoke ${SMOKE_ARGS[@]+"${SMOKE_ARGS[@]}"}
    rc=$?
    if [ "$rc" -ne 0 ]; then
      set="$(newest_smoke_set)"
      reason=""
      [ -n "$set" ] && reason="$(blocked_entries ".artifacts/plan-runner/$(basename "$set")" | head -1)"
      commit_and_push "Combined: partial abcsmoketest fixes"
      log "The smoke run stopped (exit $rc) and needs you: ${reason:-see the runner output above}"
      echo "Fix or decide, then rerun:"
      echo "  caffeinate -dims bash $PLAN_DIR/driver.sh --resume 'What you changed or decided.'"
      return 1
    fi
  fi
  touch "$LOG_DIR/smoke.done"
  commit_and_push "Combined: abcsmoketest fixes"
}

archive_plan_set() {
  mkdir -p .llm/plans/completed
  git mv "$PLAN_DIR" ".llm/plans/completed/$SLUG" &&
    commit_and_push "Archive $SLUG plan set"
}

summary() {
  local minutes=$((($(date +%s) - STARTED_AT) / 60)) close
  log "Finished in $minutes minutes."
  echo "Commits on $BRANCH since develop:"
  git log --oneline --first-parent "origin/develop..HEAD"
  [ -f "$DEFERRED" ] && echo "Deferred items: $DEFERRED"
  [ -f "$ACTIVE/abctestall-deferred.md" ] && echo "Deferred tests: $ACTIVE/abctestall-deferred.md"
  close="$(ls -t .artifacts/plan-runner/abctest-smoke-*/Close.md 2>/dev/null | head -1)"
  [ -n "$close" ] && echo "Smoke summary: $close"
  echo "Web smoke report: .artifacts/e2e-reports/latest/index.html"
  echo "iOS smoke report: .artifacts/mobile-e2e-reports/latest/ios-phone/index.html"
  port_8081_busy && echo "Mobile E2E Metro is still running on 8081."
  echo "Full log: $LOG_DIR/driver.log"
}

main() {
  log "$SLUG driver starting in $REPO_ROOT."
  preflight
  retire_and_publish
  setup_once
  merge_in_progress || merge_develop

  local id ref
  while read -r id ref; do
    merge_step "$id" "$ref" </dev/null
  done <<<"$MERGES"

  verify_step

  if mobile_prep && run_smoke; then
    archive_plan_set
  fi
  summary
}

main
