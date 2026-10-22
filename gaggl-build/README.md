# Personal build: Podverse Next for Android (FOSS flavour)

An unofficial local build of [Podverse Next](https://github.com/podverse/podverse) for installing over `adb` while the official app is in alpha. It talks to the public alpha at [alpha.podverse.fm](https://alpha.podverse.fm).

## What's different from upstream

- `apps/mobile/app.config.ts` reads `PODVERSE_ANDROID_PACKAGE` and `PODVERSE_APP_NAME`, defaulting to upstream's `com.podverse.app.next` and "Podverse Next". That's the only source change.
- The build (not the source) uses the FOSS flavour: no Firebase push, no Play Billing, and `expo-iap` excluded from autolinking.
- Settings live in `gaggl-build/mobile.env`. This build installs as `com.podverse.gaggl`, "Podverse (gaggl)".

Android Auto comes from upstream's own native media library service (Media3). It needs no Google Play Services.

## Build and install

Requires Docker. The first run downloads Node packages, the Android SDK, NDK and Gradle dependencies (several GB). The SDK, Gradle and npm caches are kept in Docker volumes, so later builds are much faster.

```bash
gaggl-build/build.sh        # arm64-v8a, for current Pixels
gaggl-build/install.sh      # adb install -r the newest APK
```

`build.sh` asks for a keystore password and creates `~/.android/podverse-gaggl.jks` on first use. Keep that file and its password: updates must be signed with the same key. `PODVERSE_KEYSTORE` can point somewhere else, but not into a temporary directory (`/tmp`, `/run` and so on): an earlier key was lost that way.

### The signing password

Once a password has been typed in and checked, `build.sh` saves it to the GNOME login keyring with `secret-tool`, and later builds read it from there without asking. To look at it or change it:

```bash
secret-tool lookup service podverse-gaggl-keystore keystore ~/.android/podverse-gaggl.jks
secret-tool clear service podverse-gaggl-keystore keystore ~/.android/podverse-gaggl.jks
```

Setting `KEYSTORE_PASS` in the environment skips the keyring.

### Backing up the key

The keyring and `~/.android` are both on this machine, so they don't count as a backup. Keep a copy of `podverse-gaggl.jks` and its password together somewhere else, for example as an attachment to an entry in your password manager.

In Android Auto's developer settings, turn on **Unknown sources**, or the car will hide the app, since it didn't come from the Play Store.

## Licence

Podverse is AGPL-3.0, and so is this fork.
