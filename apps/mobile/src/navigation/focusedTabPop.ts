export type FocusedTabPop =
  { action: 'none' } | { action: 'popToTop' } | { action: 'resetTo'; routeName: string };

/**
 * A press on the already-selected tab. More returns to its menu from any screen in that stack,
 * including when Membership is the only route. Other tabs pop to their first screen when the
 * stack is deeper than that screen.
 */
export const focusedTabPop = (input: {
  focusedRouteName: string | undefined;
  moreRootName: string;
  nestedIndex: number | undefined;
  nestedKey: string | undefined;
  tabName: string;
}): FocusedTabPop => {
  if (input.nestedKey === undefined) {
    return { action: 'none' };
  }
  if (input.tabName === 'More') {
    if (input.focusedRouteName === undefined) {
      if (input.nestedIndex === undefined || input.nestedIndex < 1) {
        return { action: 'none' };
      }
      return { action: 'resetTo', routeName: input.moreRootName };
    }
    if (input.focusedRouteName === input.moreRootName) {
      return { action: 'none' };
    }
    return { action: 'resetTo', routeName: input.moreRootName };
  }
  if (input.nestedIndex === undefined || input.nestedIndex < 1) {
    return { action: 'none' };
  }
  return { action: 'popToTop' };
};
