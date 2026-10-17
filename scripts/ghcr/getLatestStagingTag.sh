#!/usr/bin/env bash

# getLatestStagingTag.sh
# Determines the latest docker image tag matching X.Y.Z-staging.N (staging branch / staging line in CI).

set -euo pipefail

IMAGE_PATH="${GHCR_IMAGE_PATH}"
RAW_TOKEN="${GHCR_REGISTRY_TOKEN}"

# If the token is already a base64 string that decodes to a ghp_ prefix, keep it.
# Otherwise base64 encode the raw PAT.
is_base64_pat() {
  local decoded
  decoded=$(echo "$1" | base64 -d 2> /dev/null || true)
  [[ $decoded == ghp_* ]]
}

if is_base64_pat "$RAW_TOKEN"; then
  TOKEN_B64="$RAW_TOKEN"
else
  # Encode without newlines (macOS base64 wraps at 76 chars by default)
  TOKEN_B64=$(printf '%s' "$RAW_TOKEN" | base64 | tr -d '\n')
fi

if ! command -v jq > /dev/null 2>&1; then
  echo "jq is required but not found in PATH" >&2
  exit 1
fi

if [[ -z "$RAW_TOKEN" ]]; then
  echo "GHCR_REGISTRY_TOKEN is not set" >&2
  exit 1
fi

# GHCR returns at most 100 tags per page and the newest tags sit on the last page. Follow the
# Link rel="next" header until it runs out, or the newest staging tag is invisible.
fetch_all_tags() {
  local url="https://ghcr.io/v2/${IMAGE_PATH}/tags/list?n=1000"
  local headers body status next

  while [[ -n "$url" ]]; do
    headers=$(mktemp)
    body=$(mktemp)
    status=$(curl -s -D "$headers" -o "$body" -w '%{http_code}' \
      -H "Authorization: Bearer $TOKEN_B64" "$url" || true)
    if [[ "$status" != "200" ]]; then
      rm -f "$headers" "$body"
      echo "GHCR tags/list for ${IMAGE_PATH} returned HTTP ${status:-none}" >&2
      return 1
    fi
    jq -r '.tags[]? // empty' "$body"
    next=$(awk 'BEGIN{IGNORECASE=1} tolower($1)=="link:" && /rel="next"/{
      if (match($0, /<[^>]+>/)) print substr($0, RSTART+1, RLENGTH-2)
    }' "$headers")
    rm -f "$headers" "$body"
    url="$next"
  done
}

LATEST=$(fetch_all_tags \
  | grep -E '^[0-9]+\.[0-9]+\.[0-9]+-staging\.[0-9]+$' \
  | sort -V \
  | tail -n1 || true)

# If none found, exit silently (echo nothing)
if [[ -z "$LATEST" ]]; then
  exit 0
fi

echo "$LATEST"
