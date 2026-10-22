#!/usr/bin/env bash
# Build a signed Podverse Next APK (FOSS flavour) for local install over adb.
#
# Usage: gaggl-build/build.sh [abi]        (default abi: arm64-v8a)
#
# The signing key lives outside the repo (default ~/.android/podverse-gaggl.jks) and is
# created on first run. Keep it and its password: every update must be signed with it.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
ABI="${1:-arm64-v8a}"
IMAGE="podverse-gaggl-build"
KEYSTORE="${PODVERSE_KEYSTORE:-$HOME/.android/podverse-gaggl.jks}"
KEY_ALIAS="${PODVERSE_KEY_ALIAS:-podverse-gaggl}"
# Resource caps so the build hits its own limit instead of a host-wide OOM kill (14 GB host).
# Pinning CPUs (not just a quota) also sizes Ninja's default -j for the native builds.
BUILD_MEMORY="${BUILD_MEMORY:-9g}"
BUILD_CPUS="${BUILD_CPUS:-8}"

docker build --progress=plain -t "$IMAGE" "$REPO/gaggl-build"

if [[ -z "${KEYSTORE_PASS:-}" ]]; then
  read -rsp "Keystore password: " KEYSTORE_PASS; echo
fi

if [[ ! -f "$KEYSTORE" ]]; then
  echo "No signing key at $KEYSTORE, creating one with that password."
  mkdir -p "$(dirname "$KEYSTORE")"
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -e KEYSTORE_PASS="$KEYSTORE_PASS" \
    --entrypoint keytool -v "$(dirname "$KEYSTORE")":/keystore "$IMAGE" \
    -genkeypair -keystore "/keystore/$(basename "$KEYSTORE")" -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Podverse gaggl personal build" \
    -storepass:env KEYSTORE_PASS -keypass:env KEYSTORE_PASS
  chmod 600 "$KEYSTORE"
fi

mkdir -p "$REPO/gaggl-build/out"
docker run --rm \
  --memory="$BUILD_MEMORY" --memory-swap="$BUILD_MEMORY" --cpuset-cpus="0-$((BUILD_CPUS - 1))" \
  -v "$REPO":/src:ro \
  -v "$REPO/gaggl-build/out":/out \
  -v "$(dirname "$KEYSTORE")":/keystore:ro \
  -v podverse-gaggl-gradle:/root/.gradle \
  -v podverse-gaggl-npm:/root/.npm \
  -e ABI="$ABI" -e KEYSTORE_FILE="$(basename "$KEYSTORE")" -e KEY_ALIAS="$KEY_ALIAS" \
  -e KEYSTORE_PASS="$KEYSTORE_PASS" -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  "$IMAGE"
