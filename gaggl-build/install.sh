#!/usr/bin/env bash
# Install (or update) the newest built APK on the connected phone over adb.
set -euo pipefail

OUT="$(cd "$(dirname "$0")" && pwd)/out"
APK="$(ls -t "$OUT"/podverse-gaggl-*.apk 2>/dev/null | head -1)"
if [[ -z "$APK" ]]; then
  echo "No APK in $OUT. Run gaggl-build/build.sh first." >&2
  exit 1
fi

adb devices | grep -qw device || { echo "No phone in 'device' state. Check USB debugging." >&2; exit 1; }
echo "Installing $(basename "$APK")"
adb install -r "$APK"
