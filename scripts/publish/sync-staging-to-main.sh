#!/usr/bin/env bash
# Fast-forward origin/main to origin/staging (triggers Publish (main) — promote-only, no app rebuild).
# Intended flow: sync develop -> staging (build in GH), then this script: staging -> main (RTM).
# Do not use develop -> main; main should only advance from the pre-built staging line.
#
# The host npm ci and audit run in a temporary worktree, so this checkout and its
# node_modules are not modified.
# Usage: sync-staging-to-main.sh [--dry-run]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--dry-run]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMP_WORKTREE=""

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/temp-worktree.sh"

cd "$REPO_ROOT"

print_tags_at() {
  local sha="$1"
  echo -e "${YELLOW}Fetching tags...${NC}"
  git fetch origin --tags
  echo -e "${GREEN}Tags at ${sha}:${NC}"
  local tags
  tags="$(git tag --points-at "$sha")"
  if [[ -z "$tags" ]]; then
    echo "(none)"
  else
    printf '%s\n' "$tags"
  fi
}

echo -e "${YELLOW}Fetching latest from origin...${NC}"
git fetch origin

if ! git show-ref --verify --quiet refs/remotes/origin/staging; then
  echo -e "${RED}Error: Remote 'origin/staging' branch does not exist.${NC}"
  exit 1
fi

if ! git show-ref --verify --quiet refs/remotes/origin/main; then
  echo -e "${RED}Error: Remote 'origin/main' branch does not exist.${NC}"
  exit 1
fi

SHA="$(git rev-parse refs/remotes/origin/staging)"
echo -e "${YELLOW}Promoting ${SHA}.${NC}"

if git show-ref --verify --quiet refs/heads/staging; then
  if ! git merge-base --is-ancestor refs/heads/staging "$SHA"; then
    echo -e "${RED}Error: Local staging has commits that origin/staging does not. Push staging first.${NC}"
    git log --oneline "$SHA"..refs/heads/staging
    exit 1
  fi
fi

"$SCRIPT_DIR/require-release-notes.sh" "$SHA"

echo -e "${YELLOW}Running security audit on ${SHA} (moderate and above; low permitted)...${NC}"

trap temp_worktree_cleanup EXIT
trap 'exit 130' INT TERM
temp_worktree_prune_stale
temp_worktree_create "$SHA"

# apps/mobile is outside the root workspace lockfile (standalone install).
# Moderate+ audit; no allowlist (see NPM-AUDIT-ALLOWLIST.md).
if ! (
  cd "$TEMP_WORKTREE"
  npm ci
  "$REPO_ROOT/scripts/lib/check-audit-gate.sh" "" "promote to main (staging to main)"
); then
  echo -e "${RED}Error: npm audit found disallowed moderate or higher vulnerabilities. Fix them before promoting to main.${NC}"
  exit 1
fi
echo ""

echo -e "${YELLOW}Verifying origin/main can fast-forward to ${SHA}...${NC}"
if ! git merge-base --is-ancestor refs/remotes/origin/main "$SHA"; then
  echo -e "${RED}Error: origin/main is not an ancestor of origin/staging. Fast-forward is not possible.${NC}"
  echo -e "${YELLOW}Commits in origin/main but not in origin/staging:${NC}"
  git log --oneline "$SHA"..refs/remotes/origin/main
  exit 1
fi

if [[ "$(git rev-parse refs/remotes/origin/main)" == "$SHA" ]]; then
  echo -e "${GREEN}Main is already up to date with staging. No push needed.${NC}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo -e "${YELLOW}Dry run: not pushing.${NC}"
    exit 0
  fi
  temp_worktree_fast_forward_branch main "$SHA"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo -e "${YELLOW}Dry run: would push ${SHA} to origin/main. Not pushing.${NC}"
  exit 0
fi

echo -e "${YELLOW}Pushing ${SHA} to origin/main (bypassing hooks)...${NC}"
if ! git push --no-verify origin "${SHA}:refs/heads/main"; then
  echo -e "${RED}Error: Failed to push to origin/main${NC}"
  echo -e "${YELLOW}  1. Missing bypass permissions for protected branch 'main'${NC}"
  echo -e "${YELLOW}  2. Network/authentication issues${NC}"
  echo -e "${YELLOW}If you don't have bypass permissions, use a PR from staging to main.${NC}"
  exit 1
fi

echo -e "${YELLOW}Verifying main matches staging after push...${NC}"
git fetch origin
FINAL_MAIN_COMMIT="$(git rev-parse refs/remotes/origin/main)"
FINAL_STAGING_COMMIT="$(git rev-parse refs/remotes/origin/staging)"

if ! [[ "$FINAL_MAIN_COMMIT" == "$SHA" && "$FINAL_MAIN_COMMIT" == "$FINAL_STAGING_COMMIT" ]]; then
  echo -e "${RED}Error: After push, origin/main (${FINAL_MAIN_COMMIT}) does not match origin/staging (${FINAL_STAGING_COMMIT}).${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Main is now a perfect mirror of staging (RTM line)${NC}"
echo -e "${GREEN}✓ Changes pushed to origin/main${NC}"

temp_worktree_fast_forward_branch main "$SHA"

"$SCRIPT_DIR/wait-for-workflow.sh" publish-main.yml main "$SHA"

echo -e "${YELLOW}Verifying production tags in GHCR...${NC}"
"$SCRIPT_DIR/../ghcr/verifyProductionTags.sh"

print_tags_at "$SHA"
