#!/usr/bin/env bash
# Build a signed Podverse Next APK (FOSS flavour) for local install over adb.
#
# Usage: gaggl-build/build.sh [abi]        (default abi: arm64-v8a)
#
# The signing key lives outside the repo (default ~/.android/podverse-gaggl.jks) and is
# created on first run. Keep it and its password: every update must be signed with it.
# The password comes from KEYSTORE_PASS, else the login keyring (secret-tool), else a prompt;
# a prompted password is saved to the keyring once it's known to be right.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
ABI="${1:-arm64-v8a}"
IMAGE="podverse-gaggl-build"
KEYSTORE="$(realpath -m "${PODVERSE_KEYSTORE:-$HOME/.android/podverse-gaggl.jks}")"
KEY_ALIAS="${PODVERSE_KEY_ALIAS:-podverse-gaggl}"
# Resource caps so the build hits its own limit instead of a host-wide OOM kill (14 GB host).
# Pinning CPUs (not just a quota) also sizes Ninja's default -j for the native builds.
BUILD_MEMORY="${BUILD_MEMORY:-9g}"
BUILD_CPUS="${BUILD_CPUS:-8}"
SECRET_ATTRS=(service podverse-gaggl-keystore keystore "$KEYSTORE")

# A key in a temporary directory gets cleaned away, and without it no update can be installed
case "$KEYSTORE" in
  /tmp/* | /var/tmp/* | /run/* | /dev/shm/*)
    echo "Refusing keystore path $KEYSTORE: temporary directories get cleaned." >&2
    exit 1
    ;;
esac

docker build --progress=plain -t "$IMAGE" "$REPO/gaggl-build"

SAVE_PASS=0
if [[ -z "${KEYSTORE_PASS:-}" ]] && command -v secret-tool > /dev/null; then
  KEYSTORE_PASS="$(secret-tool lookup "${SECRET_ATTRS[@]}" 2> /dev/null || true)"
fi
if [[ -z "${KEYSTORE_PASS:-}" ]]; then
  read -rsp "Keystore password: " KEYSTORE_PASS; echo
  SAVE_PASS=1
fi
# Passed to containers by name, so it never appears in a process list
export KEYSTORE_PASS

keytool() {
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -e KEYSTORE_PASS \
    --entrypoint keytool -v "$(dirname "$KEYSTORE")":/keystore "$IMAGE" \
    "$@" -keystore "/keystore/$(basename "$KEYSTORE")" -storepass:env KEYSTORE_PASS
}

if [[ ! -f "$KEYSTORE" ]]; then
  if compgen -G "$REPO/gaggl-build/out/*.apk" > /dev/null; then
    echo "No signing key at $KEYSTORE, but gaggl-build/out has APKs signed with one." >&2
    echo "A new key can't update an installed build: uninstall it first (its data goes too)." >&2
    read -rp "Create a new key anyway? [y/N] " answer
    [[ "$answer" == [yY] ]] || exit 1
  fi
  if [[ "$SAVE_PASS" == 1 ]]; then
    read -rsp "Confirm password: " confirm; echo
    [[ "$confirm" == "$KEYSTORE_PASS" ]] || { echo "Passwords don't match." >&2; exit 1; }
  fi
  echo "Creating signing key at $KEYSTORE"
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -alias "$KEY_ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
    -dname "CN=Podverse gaggl personal build" -keypass:env KEYSTORE_PASS
  chmod 600 "$KEYSTORE"
  echo "Back up $KEYSTORE and its password now: see gaggl-build/README.md."
elif ! keytool -list > /dev/null 2>&1; then
  # Checked up front rather than failing at the signing step after a long build
  echo "Wrong password for $KEYSTORE." >&2
  exit 1
fi

if [[ "$SAVE_PASS" == 1 ]] && command -v secret-tool > /dev/null; then
  printf '%s' "$KEYSTORE_PASS" \
    | secret-tool store --label="Podverse gaggl signing key ($KEYSTORE)" "${SECRET_ATTRS[@]}"
  echo "Password saved to the login keyring."
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
  -e KEYSTORE_PASS -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  "$IMAGE"
