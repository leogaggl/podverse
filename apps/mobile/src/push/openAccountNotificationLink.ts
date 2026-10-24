import { Linking } from 'react-native';

import { getMobileConfig } from '../config';
import { resolveAccountNotificationOpenPath } from './accountNotificationLink';

/**
 * Opens the notification's page. An http(s) path, or any path that already contains a scheme,
 * is opened as-is. Anything else is prefixed with the app's deep-link scheme. A failure is
 * logged and resolved; this does not throw.
 */
export async function openAccountNotificationLink(notification: {
  link_path: string | null;
  payload: Record<string, unknown> | null;
}): Promise<void> {
  let targetPath = '';
  try {
    targetPath = resolveAccountNotificationOpenPath(notification);
    const prefixedLink = targetPath.startsWith('http://') || targetPath.startsWith('https://');
    if (prefixedLink || targetPath.includes('://')) {
      await Linking.openURL(targetPath);
      return;
    }

    const scheme = getMobileConfig().deepLinkSchemes[0] ?? 'podverse-next';
    const inAppPath = targetPath.startsWith('/') ? targetPath.slice(1) : targetPath;
    await Linking.openURL(`${scheme}://${inAppPath}`);
  } catch (error: unknown) {
    console.warn('Could not navigate from notification link', targetPath, error);
  }
}
