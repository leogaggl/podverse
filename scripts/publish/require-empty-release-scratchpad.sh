#!/usr/bin/env bash
# Require release-notes/scratchpad.md to exist and be blank on a git revision.
#
# Agents append change entries to the scratchpad during normal work. abcreleasenotes turns those
# entries into the GitHub, store, and web notes for the version, then empties the file in the same
# commit. A scratchpad with text means abcreleasenotes has not run since that work landed, so the
# notes about to ship are missing it.
#
# Usage: scripts/publish/require-empty-release-scratchpad.sh [rev]
# Default rev: HEAD

set -euo pipefail

REV="${1:-HEAD}"
SCRATCHPAD="release-notes/scratchpad.md"

if ! git rev-parse --verify --quiet "$REV^{commit}" >/dev/null; then
  echo "Error: git revision not found: $REV" >&2
  exit 1
fi

RESOLVED="$(git rev-parse "$REV^{commit}")"

if ! git cat-file -e "$RESOLVED:$SCRATCHPAD" 2>/dev/null; then
  echo "Error: $SCRATCHPAD is not committed on ${REV} (${RESOLVED:0:7})." >&2
  echo "Commit it as an empty file. Agents append change entries to it during normal work." >&2
  exit 1
fi

if git show "$RESOLVED:$SCRATCHPAD" | grep -q '[^[:space:]]'; then
  echo "Error: $SCRATCHPAD on ${REV} (${RESOLVED:0:7}) still has entries." >&2
  echo "Ask an agent to run abcreleasenotes. It moves those entries into the release notes and" >&2
  echo "empties the scratchpad. Commit that change, push it, then run this step again." >&2
  exit 1
fi

echo "Release scratchpad is empty on ${REV} (${RESOLVED:0:7})"
