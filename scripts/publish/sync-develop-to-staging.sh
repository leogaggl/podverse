#!/usr/bin/env bash
# Fast-forward origin/staging to origin/develop (triggers Publish (staging) on push).
# Docker npm ci and the audit run in a temporary worktree. This checkout and its
# node_modules are not modified.
# Usage: sync-develop-to-staging.sh [--dry-run]

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

if ! git show-ref --verify --quiet refs/remotes/origin/develop; then
  echo -e "${RED}Error: Remote 'origin/develop' branch does not exist.${NC}"
  exit 1
fi

if ! git show-ref --verify --quiet refs/remotes/origin/staging; then
  echo -e "${RED}Error: Remote 'origin/staging' branch does not exist.${NC}"
  exit 1
fi

SHA="$(git rev-parse refs/remotes/origin/develop)"
echo -e "${YELLOW}Publishing ${SHA}.${NC}"

if git show-ref --verify --quiet refs/heads/develop; then
  if ! git merge-base --is-ancestor refs/heads/develop "$SHA"; then
    echo -e "${RED}Error: Local develop has commits that origin/develop does not. Push develop first.${NC}"
    git log --oneline "$SHA"..refs/heads/develop
    exit 1
  fi
fi

"$SCRIPT_DIR/require-release-notes.sh" "$SHA"
"$SCRIPT_DIR/require-empty-release-scratchpad.sh" "$SHA"

echo -e "${YELLOW}Running security audit on ${SHA} (moderate and above; low permitted)...${NC}"
echo -e "${YELLOW}Using Linux Docker so npm ci matches CI (linux-canonical lockfile / optional natives).${NC}"

if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}Error: Docker is required for this step. Install Docker and retry.${NC}"
  exit 1
fi

NODE_IMAGE="${SYNC_STAGING_NODE_IMAGE:-node:24}"
DOCKER_PLATFORM="${LOCKFILE_DOCKER_PLATFORM:-linux/amd64}"

if [[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" && "$DOCKER_PLATFORM" == "linux/amd64" ]]; then
  echo -e "${YELLOW}Note: emulated linux/amd64 on Apple Silicon can be slow or fail during optional native installs.${NC}"
  echo -e "${YELLOW}      If needed: LOCKFILE_DOCKER_PLATFORM=linux/arm64 (see docs/development/tooling/LOCKFILE-LINUX.md).${NC}"
  echo ""
fi

trap temp_worktree_cleanup EXIT
trap 'exit 130' INT TERM
temp_worktree_prune_stale
temp_worktree_create "$SHA"

if ! docker run --rm \
  --platform "$DOCKER_PLATFORM" \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e npm_config_cache=/tmp/.npm \
  -v "$TEMP_WORKTREE:/app" \
  -w /app \
  "$NODE_IMAGE" \
  bash -c 'npm ci && bash scripts/lib/check-audit-gate.sh "" "promote to staging"'; then
  echo -e "${RED}Error: npm ci or npm audit gate failed in Docker. Fix issues before syncing to staging.${NC}"
  exit 1
fi

echo -e "${YELLOW}Verifying origin/staging can fast-forward to ${SHA}...${NC}"
if ! git merge-base --is-ancestor refs/remotes/origin/staging "$SHA"; then
  echo -e "${RED}Error: origin/staging is not an ancestor of origin/develop. Fast-forward is not possible.${NC}"
  echo -e "${YELLOW}Commits in origin/staging but not in origin/develop:${NC}"
  git log --oneline "$SHA"..refs/remotes/origin/staging
  exit 1
fi

if [[ "$(git rev-parse refs/remotes/origin/staging)" == "$SHA" ]]; then
  echo -e "${GREEN}Staging is already up to date with develop. No push needed.${NC}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo -e "${YELLOW}Dry run: not waiting for the workflow.${NC}"
    exit 0
  fi
  temp_worktree_fast_forward_branch staging "$SHA"
  "$SCRIPT_DIR/wait-for-workflow.sh" publish-staging.yml staging "$SHA"
  print_tags_at "$SHA"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo -e "${YELLOW}Dry run: would push ${SHA} to origin/staging. Not pushing.${NC}"
  exit 0
fi

echo -e "${YELLOW}Pushing ${SHA} to origin/staging (bypassing hooks)...${NC}"
if ! git push --no-verify origin "${SHA}:refs/heads/staging"; then
  echo -e "${RED}Error: Failed to push to origin/staging${NC}"
  echo -e "${YELLOW}  1. Missing bypass permissions for protected branch 'staging'${NC}"
  echo -e "${YELLOW}  2. Or use a PR from develop to staging${NC}"
  exit 1
fi

echo -e "${YELLOW}Verifying staging matches develop after push...${NC}"
git fetch origin
FINAL_STAGING_COMMIT="$(git rev-parse refs/remotes/origin/staging)"
FINAL_DEVELOP_COMMIT="$(git rev-parse refs/remotes/origin/develop)"

if ! [[ "$FINAL_STAGING_COMMIT" == "$SHA" && "$FINAL_STAGING_COMMIT" == "$FINAL_DEVELOP_COMMIT" ]]; then
  echo -e "${RED}Error: After push, origin/staging (${FINAL_STAGING_COMMIT}) does not match origin/develop (${FINAL_DEVELOP_COMMIT}).${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Staging is now a perfect mirror of develop${NC}"
echo -e "${GREEN}✓ Changes pushed to origin/staging${NC}"

temp_worktree_fast_forward_branch staging "$SHA"

"$SCRIPT_DIR/wait-for-workflow.sh" publish-staging.yml staging "$SHA"
print_tags_at "$SHA"
