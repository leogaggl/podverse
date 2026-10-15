#!/usr/bin/env bash
# Require the user-facing store notes for one platform on a git revision.
#
# Shared notes: release-notes/mobile/<X.Y.Z>.md
# Optional override, used only for that store: release-notes/mobile/<X.Y.Z>.ios.md
# or release-notes/mobile/<X.Y.Z>.android.md
#
# The shared file is what both stores get until a platform file exists. Update
# these files in place across store builds of the same version. EAS submit
# uploads the binary only, so this script prints the text to paste.
#
# Store notes are capped at 500 characters (Play What's New).
#
# Usage: scripts/publish/require-mobile-release-notes.sh <ios|android> [rev]

set -euo pipefail

PLATFORM="${1:-}"
REV="${2:-HEAD}"

if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" ]]; then
  echo "Error: platform must be ios or android." >&2
  exit 1
fi

if ! git rev-parse --verify --quiet "$REV^{commit}" >/dev/null; then
  echo "Error: git revision not found: $REV" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/formal-version.sh
source "$SCRIPT_DIR/lib/formal-version.sh"

RESOLVED="$(git rev-parse "$REV^{commit}")"
BASE="$(formal_version_at "$RESOLVED")"
SHARED="release-notes/mobile/${BASE}.md"
SPECIFIC="release-notes/mobile/${BASE}.${PLATFORM}.md"

if git cat-file -e "$RESOLVED:$SPECIFIC" 2>/dev/null; then
  NOTES="$SPECIFIC"
elif git cat-file -e "$RESOLVED:$SHARED" 2>/dev/null; then
  NOTES="$SHARED"
else
  echo "Error: neither $SPECIFIC nor $SHARED is committed on ${REV} (${RESOLVED:0:7})." >&2
  echo "Write user-facing notes for ${BASE} in $SHARED, commit them, then build or submit." >&2
  echo "Add $SPECIFIC only when this store should say something different." >&2
  exit 1
fi

TEXT="$(
  git show "$RESOLVED:$NOTES" | NOTES_PATH="$NOTES" node --input-type=module -e '
import { readFileSync } from "node:fs";

const notesPath = process.env.NOTES_PATH ?? "release notes";
const text = readFileSync(0, "utf8").trim();
if (text.length === 0) {
  console.error("Error: " + notesPath + " is empty.");
  process.exit(1);
}
if (text.length > 500) {
  console.error(
    "Error: " +
      notesPath +
      " is " +
      text.length +
      " characters. Store notes must be 500 or fewer so they fit Play What'"'"'s New."
  );
  process.exit(1);
}
process.stdout.write(text);
'
)"

if [[ "$PLATFORM" == "android" ]]; then
  WHERE="Play Console → the release → Release notes (en-US)"
else
  WHERE="TestFlight What to Test, and App Store What's New when you submit that version"
fi

echo "Using $NOTES for ${BASE} (${PLATFORM})"
echo "EAS submit uploads the binary only. Paste these notes into ${WHERE}:"
echo "-----"
printf '%s\n' "$TEXT"
echo "-----"
