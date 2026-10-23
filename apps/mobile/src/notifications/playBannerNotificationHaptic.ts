import * as Haptics from 'expo-haptics';

/**
 * Light impact when a banner card appears. Reduce Motion skips it. A binary that does not
 * include the module yet rejects the call; the card still shows.
 */
export function playBannerNotificationHaptic(reduceMotion: boolean): void {
  if (reduceMotion) {
    return;
  }
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  } catch {
    // The call can throw when the installed binary does not include the module yet.
  }
}
