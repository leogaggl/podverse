import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether this device has already asked a signed-in account about push on first Subscribe.
 * Keyed by account id text. Cleared only when the account answers; sign-out leaves it so the
 * same account is not asked again on this phone.
 */

const STORAGE_KEY_PREFIX = 'notifications.subscribe_push_prompt_answered:';

const storageKeyForAccount = (accountIdText: string): string => {
  return `${STORAGE_KEY_PREFIX}${accountIdText}`;
};

export const hasAnsweredFirstSubscribePushPrompt = async (
  accountIdText: string
): Promise<boolean> => {
  const raw = await AsyncStorage.getItem(storageKeyForAccount(accountIdText));
  return raw === '1';
};

export const markFirstSubscribePushPromptAnswered = async (
  accountIdText: string
): Promise<void> => {
  await AsyncStorage.setItem(storageKeyForAccount(accountIdText), '1');
};
