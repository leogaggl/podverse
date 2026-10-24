#!/usr/bin/env bash
# Runs the abctestall sweep, the abcsmoketest run, or the abctestdeferred queue under plan-runner
# (sibling checkout), one fresh Cursor agent per step, one step at a time.
#
# Each run is a plan set at .llm/plans/active/abctest-<mode>-<timestamp>/ built from
# .cursor/prompts/abctest/<mode>-COPY-PASTA.md. While a run has an unticked step it is continued
# instead of replaced, so runner flags (--resume 'msg', --clear, --dry-run, --stop-after NN) apply
# to it. Finished runs are removed on the next start; their final messages stay in
# .artifacts/plan-runner/<set>/.
#
# Usage: ./scripts/abctest/run.sh {all|smoke|deferred} [runner flags]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

usage() {
  echo "Usage: ./scripts/abctest/run.sh {all|smoke|deferred} [--resume 'msg'] [--clear] [--dry-run] [--stop-after NN]" >&2
}

mode="${1:-}"
case "$mode" in
  all | smoke | deferred) shift ;;
  *)
    usage
    exit 1
    ;;
esac

RUNNER_DIR="$(cd "$REPO_ROOT/.." && pwd)/plan-runner"
RUNNER="$RUNNER_DIR/run-plan-set.mjs"
TEMPLATE=".cursor/prompts/abctest/$mode-COPY-PASTA.md"
ACTIVE_DIR=".llm/plans/active"
DEFERRED_FILE="$ACTIVE_DIR/abctestall-deferred.md"

if [ ! -f "$RUNNER" ]; then
  echo "plan-runner not found at $RUNNER. Clone it next to this repo." >&2
  exit 1
fi
if [ ! -d "$RUNNER_DIR/node_modules" ]; then
  echo "Install plan-runner first: npm --prefix ../plan-runner install" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "node is not on PATH. Run from the repo root with direnv loaded." >&2
  exit 1
fi

set_is_open() {
  grep -q '^- \[ \] \*\*' "$ACTIVE_DIR/$1/COPY-PASTA.md" 2>/dev/null
}

# abctest all and smoke always reach iOS Maestro. abctest deferred reaches it only when the
# deferred file names an iOS flow. Metro has to already be the E2E bundle: a Metro started inside
# a step dies with that step, and port 8081 may belong to the operator's dev Metro.
run_needs_e2e_metro() {
  if [ "$mode" = "all" ] || [ "$mode" = "smoke" ]; then
    return 0
  fi
  if [ ! -f "$DEFERRED_FILE" ]; then
    return 1
  fi
  if grep -E -q 'apps/mobile/e2e|mobile:e2e|iOS Maestro' "$DEFERRED_FILE"; then
    return 0
  fi
  return 1
}

process_tree() {
  local pid="$1" depth=0 cmd ppid seen='|'
  while [ -n "$pid" ] && [ "$pid" != "0" ] && [ "$depth" -lt 40 ]; do
    case "$seen" in
      *"|$pid|"*) break ;;
    esac
    seen="${seen}${pid}|"
    cmd="$(ps -ww -o command= -p "$pid" 2>/dev/null || true)"
    printf '%s\n' "$cmd"
    ppid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d '[:space:]' || true)"
    if [ -z "$ppid" ] || [ "$ppid" = "$pid" ] || [ "$ppid" = "0" ] || [ "$ppid" = "1" ]; then
      break
    fi
    pid="$ppid"
    depth=$((depth + 1))
  done
}

require_e2e_metro() {
  local tree="" pid line plain_dev=0
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    tree="${tree}
$(process_tree "$pid")"
  done < <(lsof -nP -t -iTCP:8081 -sTCP:LISTEN 2>/dev/null || true)

  if [ -z "${tree//[[:space:]]/}" ]; then
    echo "Mobile E2E Metro is not listening on port 8081." >&2
    echo "In Mobile E2E Metro, leave this running:" >&2
    echo "  npm run mobile:dev:e2e" >&2
    echo "Then run this command again." >&2
    exit 1
  fi

  while IFS= read -r line; do
    case "$line" in
      *scripts/mobile/dev-e2e.sh* | *mobile:dev:e2e*)
        echo "Mobile E2E Metro is listening on port 8081."
        return 0
        ;;
      *mobile:dev*)
        plain_dev=1
        ;;
    esac
  done <<< "$tree"

  if [ "$plain_dev" -eq 1 ]; then
    echo "Port 8081 is Mobile Metro (npm run mobile:dev), not the E2E bundle." >&2
    echo "Stop Mobile Metro. In Mobile E2E Metro, leave this running:" >&2
  else
    echo "Port 8081 is in use by a process that is not Mobile E2E Metro." >&2
    echo "Free port 8081. In Mobile E2E Metro, leave this running:" >&2
  fi
  echo "  npm run mobile:dev:e2e" >&2
  echo "Then run this command again." >&2
  exit 1
}

# Removes finished runs of this mode and prints the newest open one, if any.
find_open_set() {
  local prefix="$1" found="" dir name
  for dir in "$ACTIVE_DIR/$prefix"*/; do
    [ -d "$dir" ] || continue
    name="$(basename "$dir")"
    if set_is_open "$name"; then
      found="$name"
    else
      rm -rf "$dir"
    fi
  done
  echo "$found"
}

for other_mode in all smoke deferred; do
  [ "$other_mode" = "$mode" ] && continue
  other_open="$(find_open_set "abctest-$other_mode-")"
  if [ -n "$other_open" ]; then
    echo "Warning: abctest $other_mode run $other_open is still open. Do not let two runs use the" >&2
    echo "test databases at once. Discard it with: rm -rf $ACTIVE_DIR/$other_open" >&2
  fi
done

open_set="$(find_open_set "abctest-$mode-")"

if [ -n "$open_set" ]; then
  echo "Continuing abctest $mode run $open_set"
else
  case " $* " in
    *" --resume "* | *" --clear "*)
      echo "No open abctest $mode run to continue. Start one with: ./scripts/abctest/run.sh $mode" >&2
      exit 1
      ;;
  esac
  if [ "$mode" = "deferred" ] && [ ! -f "$DEFERRED_FILE" ]; then
    echo "Nothing deferred: $DEFERRED_FILE does not exist."
    exit 0
  fi
fi

if run_needs_e2e_metro; then
  require_e2e_metro
fi

if [ -z "$open_set" ]; then
  open_set="abctest-$mode-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$ACTIVE_DIR/$open_set"
  sed "s/{{SET}}/$open_set/g" "$TEMPLATE" >"$ACTIVE_DIR/$open_set/COPY-PASTA.md"
  echo "Started abctest $mode run $open_set"
fi

exec node "$RUNNER" "$open_set" "$@"
