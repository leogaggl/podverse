import Constants from 'expo-constants';

/** Display name from the Expo config, so a fork's brand reaches `{brand_name}` strings. */
export const mobileBrandName = (): string => {
  const name = Constants.expoConfig?.name;
  if (typeof name === 'string') {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return 'Podverse Next';
};
