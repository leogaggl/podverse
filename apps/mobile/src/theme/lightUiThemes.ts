import type { UITheme } from '@podverse/design-tokens';

/** Themes whose surfaces are light enough for dark system chrome. */
export const LIGHT_UI_THEMES: readonly UITheme[] = ['light', 'dawn'];

export const isLightUiTheme = (theme: UITheme): boolean => {
  return LIGHT_UI_THEMES.includes(theme);
};
