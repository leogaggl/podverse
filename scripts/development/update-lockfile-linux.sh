#!/usr/bin/env bash
# Regenerate package-lock.json under Linux (Docker) so optional deps match CI.
# Copies the working tree to a temporary directory, installs there, and copies
# back only package-lock.json. Host node_modules is not touched.
# Run from repo root when adding or updating deps, or from bump-version.sh.
# Requires: Docker.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMP_WORKTREE=""

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/temp-worktree.sh"

cd "$REPO_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is required. Install Docker and run this script again." >&2
  exit 1
fi

# Use Node 24 to match .nvmrc and CI
NODE_IMAGE="node:24"

# Default linux/amd64 matches GitHub Actions (ubuntu-latest = x64) optional native deps.
# On Apple Silicon, emulated amd64 (QEMU) can crash with "Bus error" when optional
# packages run native postinstalls (e.g. next-intl's @swc/core). Mitigations:
# - Docker Desktop: enable "Use Rosetta for x86/amd64 emulation on Apple Silicon", or
# - Set LOCKFILE_DOCKER_PLATFORM=linux/arm64 (native container; see LOCKFILE-LINUX.md).
DOCKER_PLATFORM="${LOCKFILE_DOCKER_PLATFORM:-linux/amd64}"

if [[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" && "$DOCKER_PLATFORM" == "linux/amd64" ]]; then
  echo "Note: emulated linux/amd64 on Apple Silicon can fail with Bus error during @swc/core postinstall."
  echo "      If that happens: enable Rosetta for x86/amd64 in Docker Desktop (General), or run:"
  echo "      LOCKFILE_DOCKER_PLATFORM=linux/arm64 $0"
  echo ""
fi

copy_working_tree() {
  local dest="$1"
  git ls-files -z --cached --others --exclude-standard |
    while IFS= read -r -d '' path; do
      if [[ -e "$path" || -L "$path" ]]; then
        printf '%s\0' "$path"
      fi
    done |
    tar --null -T - -cf - |
    tar -C "$dest" -xf -
}

trap temp_worktree_cleanup EXIT
trap 'exit 130' INT TERM
temp_worktree_prune_stale
TEMP_WORKTREE="$(mktemp -d "$(temp_worktree_prefix)XXXXXX")"

echo "Copying the working tree to ${TEMP_WORKTREE}..."
copy_working_tree "$TEMP_WORKTREE"
rm -f "$TEMP_WORKTREE/package-lock.json"

echo "Regenerating package-lock.json under Linux ($NODE_IMAGE, platform $DOCKER_PLATFORM)..."
if ! docker run --rm \
  --platform "$DOCKER_PLATFORM" \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e npm_config_cache=/tmp/.npm \
  -v "$TEMP_WORKTREE:/app" \
  -w /app \
  "$NODE_IMAGE" \
  sh -c "npm install --include=optional"; then
  echo "" >&2
  echo "Docker/npm install failed. On Apple Silicon + linux/amd64, try Rosetta for amd64 in Docker Desktop," >&2
  echo "or: LOCKFILE_DOCKER_PLATFORM=linux/arm64 $0 (see docs/development/tooling/LOCKFILE-LINUX.md)." >&2
  exit 1
fi

if [[ ! -f "$TEMP_WORKTREE/package-lock.json" ]]; then
  echo "Error: Docker npm install did not write package-lock.json." >&2
  exit 1
fi

cp "$TEMP_WORKTREE/package-lock.json" "$REPO_ROOT/package-lock.json"

echo "Done. package-lock.json is now Linux-canonical; commit it so CI uses it."
echo "Host node_modules was not changed."
