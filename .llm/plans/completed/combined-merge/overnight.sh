#!/usr/bin/env bash
# Overnight driver for the combined-merge plan set.
#
# Merges four feature branches into `feature/combined`, one plan-runner step per branch. Agents resolve
# and stage; this script is the only thing that commits and pushes, after every step, with the
# operator's git credentials. After the merges and the verification step it starts Mobile E2E
# Metro from this checkout, installs the iOS E2E build, runs abctestall, and pushes its fixes.
#
# Usage (Root tab of the podverse_combined window):
#   caffeinate -dims bash .llm/plans/active/combined-merge/overnight.sh
#
# Safe to rerun: ticked steps are skipped, a merge left open by an interrupted step is picked up by
# a fresh agent, and an open abctestall run is continued.

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)" || exit 1
cd "$REPO_ROOT" || exit 1

SLUG=combined-merge
BRANCH=feature/combined
PLAN_DIR=".llm/plans/active/$SLUG"
COPY_PASTA="$PLAN_DIR/COPY-PASTA.md"
DEFERRED_DIR=".llm/plans/active/$SLUG-deferred"
DEFERRED="$DEFERRED_DIR/00-SUMMARY.md"
RUNS_DIR=".artifacts/plan-runner/$SLUG"
LOG_DIR=".artifacts/$SLUG"
METRO_PID_FILE="$LOG_DIR/metro.pid"
STARTED_AT="$(date +%s)"

MERGES="01 feature/realtime-banner-notifications
02 feature/artist-album-attribution
03 feature/auth-sessions
04 feature/popularity-tracking-rebuild"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_DIR/overnight.log") 2>&1

log() { printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() {
  log "STOPPED: $*"
  exit 1
}

defer() {
  mkdir -p "$DEFERRED_DIR"
  if [ ! -f "$DEFERRED" ]; then
    printf '# combined-merge — deferred\n' >"$DEFERRED"
  fi
  printf '\n## %s\n\n%s\n' "$1" "$2" >>"$DEFERRED"
  log "Deferred: $1"
}

step_ticked() { grep -q "^- \[[xX]\] \*\*$1 " "$COPY_PASTA"; }
tick_step() { perl -pi -e "s/^- \[ \] \*\*$1 /- [x] **$1 /" "$COPY_PASTA"; }
merge_in_progress() { git rev-parse -q --verify MERGE_HEAD >/dev/null; }

blocked_entries() {
  [ -f "$RUNS_DIR/state.json" ] || return 0
  node -e '
    const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    for (const b of s.blocked || []) console.log(`${b.id}: ${b.reason}`);
  ' "$RUNS_DIR/state.json"
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
  [ -n "$(blocked_entries)" ] && clear="--clear"
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

block_reason() { blocked_entries | grep "^$1:" | head -1; }

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
        "The step stopped with: ${reason:-no reason recorded}. Final message: \`$RUNS_DIR/$id.md\`. The driver dropped the merge and went on to the next branch."
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
  step_ticked 05 && return
  run_step_with_retry 05
  rc=$?
  case "$rc" in
    0) commit_and_push "Combined: whole-tree verification fixes" ;;
    2)
      reason="$(block_reason 05)"
      defer "05 — verification stopped" \
        "Step 05 stopped with: ${reason:-no reason recorded}. Final message: \`$RUNS_DIR/05.md\`. Its partial fixes are committed; abctestall ran anyway."
      tick_step 05
      commit_and_push "Combined: partial whole-tree verification fixes"
      ;;
    *) die "plan-runner failed twice on step 05 (exit $rc). Rerun this command to continue." ;;
  esac
}

metro_is_ours() {
  [ -f "$METRO_PID_FILE" ] && kill -0 "$(cat "$METRO_PID_FILE")" 2>/dev/null
}

port_8081_busy() { lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; }

start_metro() {
  local waited=0
  if port_8081_busy; then
    metro_is_ours && log "Mobile E2E Metro from this checkout is already running." && return 0
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
  if port_8081_busy && ! metro_is_ours; then
    die "Port 8081 is in use. Stop Mobile Metro and Mobile E2E Metro in every window; this run starts its own from this checkout."
  fi
  if ! merge_in_progress && [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    die "Tracked files have uncommitted changes. Commit or stash them first."
  fi
  git fetch -q origin || die "git fetch failed. Check your network and SSH key."
}

publish_plan_set() {
  merge_in_progress && return 0
  if [ -n "$(git status --porcelain -- "$PLAN_DIR")" ]; then
    git add -- "$PLAN_DIR"
    git commit -q -m "Update combined-merge plan set" -- "$PLAN_DIR"
    log "Committed the plan set."
  fi
  if ! git push -q -u origin "$BRANCH"; then
    die "The first push of $BRANCH failed. Fix git push access and rerun."
  fi
  log "Pushed $BRANCH; it is on GitHub now."
}

setup_once() {
  [ -f "$LOG_DIR/setup.done" ] && return 0
  log "Setting up env and dependencies."
  make local_env_worktree_setup || die "make local_env_worktree_setup failed."
  npm run deps:init || die "npm run deps:init failed."
  touch "$LOG_DIR/setup.done"
}

mobile_prep() {
  [ -f "$LOG_DIR/mobile-prep.done" ] && start_metro && return 0
  log "Installing dependencies and the native iOS project for the merged tree."
  bash scripts/dev/deps-init.sh --skip-clean --with-native ||
    defer "Mobile native prep failed" "\`bash scripts/dev/deps-init.sh --skip-clean --with-native\` failed; see $LOG_DIR/overnight.log."
  if ! start_metro; then
    defer "Mobile E2E Metro did not start" "Port 8081 never listened, or another process held it. See \`$LOG_DIR/metro.log\`. abctestall stops before any step without it."
    return 1
  fi
  log "Building and installing the iOS E2E app."
  npm run mobile:e2e:ios </dev/null ||
    defer "iOS E2E build failed" "\`npm run mobile:e2e:ios\` failed; see $LOG_DIR/overnight.log. abctestall step 08 retries the install."
  touch "$LOG_DIR/mobile-prep.done"
}

run_abctestall() {
  local rc
  if [ -f "$LOG_DIR/abctest.done" ]; then
    log "abctestall already finished in an earlier run."
    return 0
  fi
  log "Running abctestall."
  ./scripts/abctest/run.sh all
  rc=$?
  if [ "$rc" -eq 0 ]; then
    touch "$LOG_DIR/abctest.done"
    commit_and_push "Combined: abctestall fixes"
    return 0
  fi
  defer "abctestall stopped (exit $rc)" \
    "The sweep stopped before finishing. Its open run is under \`.llm/plans/active/abctest-all-*\` and its messages under \`.artifacts/plan-runner/abctest-all-*/\`. Fix the cause, then run \`./scripts/abctest/run.sh all --resume 'What you changed.'\`. When it finishes, commit and push its fixes."
  commit_and_push "Combined: partial abctestall fixes"
  return 1
}

archive_plan_set() {
  mkdir -p .llm/plans/completed
  git mv "$PLAN_DIR" ".llm/plans/completed/$SLUG" &&
    commit_and_push "Archive combined-merge plan set"
}

summary() {
  local minutes=$((($(date +%s) - STARTED_AT) / 60)) close
  log "Finished in $minutes minutes."
  echo "Commits on $BRANCH since develop:"
  git log --oneline --first-parent "origin/develop..HEAD"
  [ -f "$DEFERRED" ] && echo "Deferred items: $DEFERRED"
  [ -f .llm/plans/active/abctestall-deferred.md ] &&
    echo "abctestall deferred: .llm/plans/active/abctestall-deferred.md"
  close="$(ls -t .artifacts/plan-runner/abctest-all-*/Close.md 2>/dev/null | head -1)"
  [ -n "$close" ] && echo "abctestall summary: $close"
  metro_is_ours && echo "Mobile E2E Metro is still running (pid $(cat "$METRO_PID_FILE"))."
  echo "Full log: $LOG_DIR/overnight.log"
}

main() {
  log "combined-merge overnight run starting in $REPO_ROOT."
  preflight
  publish_plan_set
  setup_once

  local id ref
  while read -r id ref; do
    merge_step "$id" "$ref" </dev/null
  done <<<"$MERGES"

  verify_step

  if mobile_prep && run_abctestall; then
    archive_plan_set
  fi
  summary
}

main
