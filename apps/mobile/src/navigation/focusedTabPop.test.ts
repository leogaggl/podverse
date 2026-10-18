import { describe, expect, it } from 'vitest';

import { focusedTabPop } from './focusedTabPop';

const more = {
  moreRootName: 'MoreRoot',
  nestedKey: 'more-stack',
  tabName: 'More',
};

describe('focusedTabPop', () => {
  it('resets More to its menu unless that menu is already showing', () => {
    expect(
      focusedTabPop({
        ...more,
        focusedRouteName: 'MoreMembership',
        nestedIndex: 0,
      })
    ).toEqual({ action: 'resetTo', routeName: 'MoreRoot' });
    expect(
      focusedTabPop({
        ...more,
        focusedRouteName: 'MoreMembershipExtend',
        nestedIndex: 1,
      })
    ).toEqual({ action: 'resetTo', routeName: 'MoreRoot' });
    expect(
      focusedTabPop({
        ...more,
        focusedRouteName: 'MoreRoot',
        nestedIndex: 0,
      })
    ).toEqual({ action: 'none' });
    expect(
      focusedTabPop({
        ...more,
        focusedRouteName: undefined,
        nestedIndex: 0,
      })
    ).toEqual({ action: 'none' });
  });

  it('pops other tabs only when the stack is below its first screen', () => {
    expect(
      focusedTabPop({
        focusedRouteName: 'HomePodcast',
        moreRootName: 'MoreRoot',
        nestedIndex: 2,
        nestedKey: 'home-stack',
        tabName: 'Home',
      })
    ).toEqual({ action: 'popToTop' });
    expect(
      focusedTabPop({
        focusedRouteName: 'HomeRoot',
        moreRootName: 'MoreRoot',
        nestedIndex: 0,
        nestedKey: 'home-stack',
        tabName: 'Home',
      })
    ).toEqual({ action: 'none' });
    expect(
      focusedTabPop({
        focusedRouteName: 'MoreMembership',
        moreRootName: 'MoreRoot',
        nestedIndex: 0,
        nestedKey: undefined,
        tabName: 'More',
      })
    ).toEqual({ action: 'none' });
  });
});
