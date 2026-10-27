/**
 * Picture-in-picture and rotation for video fullscreen.
 *
 * The activity must accept orientation and size changes without restarting, and it must declare
 * picture-in-picture. A fixed `screenOrientation` would block that window on older Android.
 */
const { AndroidConfig, createRunOncePlugin, withAndroidManifest } = require('expo/config-plugins');

const CONFIG_CHANGE_TOKENS = [
  'keyboard',
  'keyboardHidden',
  'orientation',
  'screenLayout',
  'screenSize',
  'smallestScreenSize',
  'uiMode',
];

function withPodverseVideoPlayback(config) {
  return withAndroidManifest(config, (next) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(next.modResults);
    activity.$['android:supportsPictureInPicture'] = 'true';
    activity.$['android:resizeableActivity'] = 'true';
    const existing = activity.$['android:configChanges'] ?? '';
    const tokens = new Set(existing.split('|').filter((token) => token.length > 0));
    for (const token of CONFIG_CHANGE_TOKENS) {
      tokens.add(token);
    }
    activity.$['android:configChanges'] = [...tokens].join('|');
    return next;
  });
}

module.exports = createRunOncePlugin(withPodverseVideoPlayback, 'with-podverse-video-playback');
