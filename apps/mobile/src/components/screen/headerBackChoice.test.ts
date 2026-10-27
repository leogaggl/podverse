import { describe, expect, it } from 'vitest';

import { headerBackChoice } from './headerBackChoice';

describe('headerBackChoice', () => {
  it('pops when the stack has history', () => {
    expect(
      headerBackChoice({
        focusedRouteName: 'MoreMembershipExtend',
        hasStackBack: true,
        initialRouteName: 'MoreRoot',
        parentStackCanGoBack: false,
      })
    ).toBe('goBack');
  });

  it("returns to the stack's first screen when this route was opened with nothing under it", () => {
    expect(
      headerBackChoice({
        focusedRouteName: 'MoreMembership',
        hasStackBack: false,
        initialRouteName: 'MoreRoot',
        parentStackCanGoBack: false,
      })
    ).toBe('resetToInitial');
  });

  it('uses the parent stack at the first screen of a nested navigator', () => {
    expect(
      headerBackChoice({
        focusedRouteName: 'SearchRoot',
        hasStackBack: false,
        initialRouteName: 'SearchRoot',
        parentStackCanGoBack: true,
      })
    ).toBe('parentGoBack');
    expect(
      headerBackChoice({
        focusedRouteName: 'MoreRoot',
        hasStackBack: false,
        initialRouteName: 'MoreRoot',
        parentStackCanGoBack: false,
      })
    ).toBe('none');
  });
});
