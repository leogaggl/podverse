#!/usr/bin/env bash
# Require release-notes/<formal-version>.md on a git revision.
#
# The formal version is the root package.json version with any -suffix removed.
# Every X.Y.Z-staging.N prerelease and the X.Y.Z production release use that one
# file. Update the file in place between staging cuts. Do not add a file per
# staging tag.
#
# Usage: scripts/publish/require-release-notes.sh [rev]
# Default rev: HEAD

set -euo pipefail

REV="${1:-HEAD}"

if ! git rev-parse --verify --quiet "$REV^{commit}" >/dev/null; then
  echo "Error: git revision not found: $REV" >&2
  exit 1
fi

RESOLVED="$(git rev-parse "$REV^{commit}")"

BASE="$(
  git show "$RESOLVED:package.json" | node --input-type=module -e '
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(0, "utf8"));
const version = String(pkg.version ?? "");
const formal = version.split("-")[0];
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(formal)) {
  console.error("Error: package.json version is not X.Y.Z: " + version);
  process.exit(1);
}
process.stdout.write(formal);
'
)"

NOTES="release-notes/${BASE}.md"

if ! git cat-file -e "$RESOLVED:$NOTES" 2>/dev/null; then
  echo "Error: $NOTES is not committed on ${REV} (${RESOLVED:0:7})." >&2
  echo "Write the notes for ${BASE} in that file, commit them, and push before cutting a release." >&2
  echo "Staging builds and the production release of ${BASE} all use this same file." >&2
  exit 1
fi

if ! git show "$RESOLVED:$NOTES" | grep -q '[^[:space:]]'; then
  echo "Error: $NOTES on ${REV} is empty." >&2
  exit 1
fi

echo "Using $NOTES for ${BASE}"
