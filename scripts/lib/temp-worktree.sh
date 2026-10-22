#!/usr/bin/env bash
# Temporary directory under $TMPDIR for publish and lockfile scripts.
#
# Source this file after setting REPO_ROOT. The caller installs the traps:
#   trap temp_worktree_cleanup EXIT
#   trap 'exit 130' INT TERM
# A normal exit, a failing command under set -e, and Ctrl+C all remove the directory.
# The directory lives outside the repo so file watchers on the checkout do not see it.
#
# temp_worktree_prune_stale removes registered worktrees left under this prefix by a
# killed run. Do not run two of these scripts at once: prune treats every registered
# worktree under the prefix as leftover.

temp_worktree_require_root() {
  if [[ -z "${REPO_ROOT:-}" ]]; then
    echo "REPO_ROOT is not set." >&2
    return 1
  fi
}

temp_worktree_canon() {
  local target="$1"
  if [[ -d "$target" ]]; then
    (cd "$target" && pwd -P)
    return 0
  fi
  local parent
  parent="$(cd "$(dirname "$target")" && pwd -P)"
  printf '%s/%s\n' "$parent" "$(basename "$target")"
}

temp_worktree_prefix() {
  temp_worktree_require_root
  local tmp="${TMPDIR:-/tmp}"
  tmp="${tmp%/}"
  local parent
  parent="$(cd "$tmp" && pwd -P)"
  printf '%s/%s-publish-' "$parent" "$(basename "$REPO_ROOT")"
}

temp_worktree_prune_stale() {
  temp_worktree_require_root
  git -C "$REPO_ROOT" worktree prune
  local prefix path canon line
  prefix="$(temp_worktree_prefix)"
  while IFS= read -r line; do
    [[ "$line" == worktree\ * ]] || continue
    path="${line#worktree }"
    canon="$(temp_worktree_canon "$path")"
    [[ "$canon" == "$prefix"* ]] || continue
    printf 'Removing stale publish worktree %s\n' "$canon"
    if ! git -C "$REPO_ROOT" worktree remove --force "$canon"; then
      rm -rf "$canon"
    fi
  done < <(git -C "$REPO_ROOT" worktree list --porcelain)
  git -C "$REPO_ROOT" worktree prune
}

temp_worktree_create() {
  local sha="$1"
  temp_worktree_require_root
  local dir
  dir="$(mktemp -d "$(temp_worktree_prefix)XXXXXX")"
  if ! git -C "$REPO_ROOT" worktree add --detach "$dir" "$sha"; then
    rm -rf "$dir"
    return 1
  fi
  TEMP_WORKTREE="$(temp_worktree_canon "$dir")"
}

temp_worktree_cleanup() {
  local dir="${TEMP_WORKTREE:-}"
  TEMP_WORKTREE=""
  if [[ -n "$dir" ]]; then
    if ! git -C "$REPO_ROOT" worktree remove --force "$dir" 2>/dev/null; then
      rm -rf "$dir"
    fi
  fi
  if [[ -n "${REPO_ROOT:-}" ]]; then
    git -C "$REPO_ROOT" worktree prune || true
  fi
  return 0
}

# Move refs/heads/<branch> to <sha> when that branch is not checked out and the
# move is a fast-forward. A missing branch is left missing. A checked-out branch
# or a non-fast-forward is left as it is. The remote push does not depend on this.
temp_worktree_fast_forward_branch() {
  local branch="$1"
  local sha="$2"
  temp_worktree_require_root
  local line path=""
  while IFS= read -r line; do
    case "$line" in
      worktree\ *) path="${line#worktree }" ;;
      branch\ "refs/heads/${branch}")
        printf 'Local %s is checked out (%s); leaving it unchanged.\n' "$branch" "$path"
        return 0
        ;;
    esac
  done < <(git -C "$REPO_ROOT" worktree list --porcelain)

  if ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/${branch}"; then
    printf 'Local %s does not exist; leaving it. The remote is updated.\n' "$branch"
    return 0
  fi
  if ! git -C "$REPO_ROOT" merge-base --is-ancestor "refs/heads/${branch}" "$sha"; then
    printf 'Local %s cannot fast-forward to %s; leaving it unchanged.\n' "$branch" "$sha"
    return 0
  fi
  git -C "$REPO_ROOT" update-ref "refs/heads/${branch}" "$sha"
  printf 'Updated local %s.\n' "$branch"
}
