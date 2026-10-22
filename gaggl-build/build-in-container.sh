#!/usr/bin/env bash
# Runs inside the build container: install, prebuild, Gradle release build, re-sign.
#
# Mounts: /src (repo, read-only), /out (APK output), /keystore (signing key, read-only)
# Env:    ABI, KEYSTORE_FILE, KEY_ALIAS, KEYSTORE_PASS, HOST_UID, HOST_GID
set -euo pipefail

ABI="${ABI:-arm64-v8a}"

# Work on a copy, owned by root, so the host checkout is never touched
rsync -a --no-owner --no-group --delete \
  --exclude node_modules --exclude .git \
  --exclude 'apps/mobile/android' --exclude 'apps/mobile/ios' --exclude 'gaggl-build/out' \
  /src/ /build/repo/
cd /build/repo

echo "=== Root workspaces and shared packages"
npm ci --no-audit --no-fund
npm run build:packages

echo "=== Mobile dependencies"
npm ci --prefix apps/mobile --no-audit --no-fund
bash scripts/mobile/ensure-expo-sqlite-vendored-sources.sh apps/mobile

cd apps/mobile

# FOSS flavour: keep the Play Billing module (expo-iap) out of the binary entirely
node -e '
  const fs = require("fs");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  pkg.expo = pkg.expo || {};
  pkg.expo.autolinking = pkg.expo.autolinking || {};
  pkg.expo.autolinking.exclude = [...new Set([...(pkg.expo.autolinking.exclude || []), "expo-iap"])];
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
'

# Build settings: exported for app.config.ts (prebuild) and written as .env for Metro bundling
cp /src/gaggl-build/mobile.env .env
set -a; source .env; set +a

npm run i18n-compile

echo "=== Expo prebuild (android)"
EXPO_NO_GIT_STATUS=1 CI=1 npx expo prebuild --platform android --clean --no-install

echo "=== Gradle release build ($ABI)"
cd android
# No SDK auto-download: every component is baked into the image.
# Heaps sized to fit the container's memory cap: the Kotlin daemon would otherwise inherit
# Gradle's -Xmx, and fewer workers means fewer CMake/Ninja native builds running at once.
export CMAKE_BUILD_PARALLEL_LEVEL=4
./gradlew --no-daemon -PreactNativeArchitectures="$ABI" -Pandroid.builder.sdkDownload=false \
  -Dorg.gradle.jvmargs="-Xmx3g -XX:MaxMetaspaceSize=1g" -Pkotlin.daemon.jvmargs=-Xmx2g \
  -Dorg.gradle.workers.max=4 assembleRelease

BUILD_TOOLS="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
APK=app/build/outputs/apk/release/app-release.apk
VERSION="$(node -p "require('../package.json').version")"
OUT="/out/podverse-gaggl-${VERSION}-${ABI}.apk"

# Expo's template signs release builds with the debug key: replace it with ours
"$BUILD_TOOLS/apksigner" sign --ks "/keystore/${KEYSTORE_FILE}" --ks-key-alias "${KEY_ALIAS}" \
  --ks-pass env:KEYSTORE_PASS --out "$OUT" "$APK"
"$BUILD_TOOLS/apksigner" verify --print-certs "$OUT" | head -3
"$BUILD_TOOLS/aapt2" dump badging "$OUT" | grep -E "^package:|^application-label:|native-code"

# apksigner also writes the v4 signature (.idsig) used by adb incremental install
chown "${HOST_UID}:${HOST_GID}" "$OUT" "$OUT.idsig"
echo "Built $OUT"
