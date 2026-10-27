import { describe, expect, it } from 'vitest';

import {
  addVisibleTab,
  addVisibleTabAt,
  applyTabBarDrop,
  DEFAULT_VISIBLE_TABS,
  moveVisibleTab,
  overflowTabs,
  parseVisibleTabs,
  removeVisibleTab,
} from './tabLayout';

describe('tabLayout', () => {
  it('uses the default bar when storage is empty or invalid', () => {
    expect(DEFAULT_VISIBLE_TABS).toEqual(['Home', 'Browse', 'Recommendations', 'My Library']);
    expect(parseVisibleTabs(null)).toEqual([...DEFAULT_VISIBLE_TABS]);
    expect(parseVisibleTabs('not-json')).toEqual([...DEFAULT_VISIBLE_TABS]);
    expect(parseVisibleTabs('[]')).toEqual([...DEFAULT_VISIBLE_TABS]);
    expect(parseVisibleTabs('["More"]')).toEqual([...DEFAULT_VISIBLE_TABS]);
    expect(parseVisibleTabs('["Home","Search","My Library","Browse"]')).toEqual([
      ...DEFAULT_VISIBLE_TABS,
    ]);
    expect(parseVisibleTabs('["Home","Search","Browse","My Library"]')).toEqual([
      ...DEFAULT_VISIBLE_TABS,
    ]);
    expect(parseVisibleTabs('["Home","Browse","Search","My Library"]')).toEqual([
      ...DEFAULT_VISIBLE_TABS,
    ]);
  });

  it('keeps a valid unique order, drops unknown ids, and turns a Search slot into Recommendations', () => {
    expect(parseVisibleTabs('["Recommendations","Home","Browse","Search","My Library"]')).toEqual([
      'Recommendations',
      'Home',
      'Browse',
      'My Library',
    ]);
    expect(parseVisibleTabs('["Home","My Library","Search","Browse"]')).toEqual([
      'Home',
      'My Library',
      'Recommendations',
      'Browse',
    ]);
    expect(parseVisibleTabs('["Home","Notifications","Search"]')).toEqual([
      'Home',
      'Recommendations',
    ]);
    expect(parseVisibleTabs('["Notifications"]')).toEqual([...DEFAULT_VISIBLE_TABS]);
    expect(parseVisibleTabs('["Home","Home","Wizard"]')).toEqual(['Home']);
  });

  it('treats tabs not on the bar as More overflow', () => {
    expect(overflowTabs([...DEFAULT_VISIBLE_TABS])).toEqual([]);
    expect(overflowTabs(['Home', 'Browse', 'My Library'])).toEqual(['Recommendations']);
  });

  it('reorders, adds, and refuses to empty the bar', () => {
    expect(moveVisibleTab(['Home', 'Recommendations', 'Browse'], 2, -1)).toEqual([
      'Home',
      'Browse',
      'Recommendations',
    ]);
    expect(addVisibleTab(['Home', 'Browse', 'My Library'], 'Recommendations')).toEqual([
      'Home',
      'Browse',
      'My Library',
      'Recommendations',
    ]);
    expect(removeVisibleTab(['Home'], 'Home')).toEqual(['Home']);
    expect(removeVisibleTab(['Home', 'Recommendations'], 'Recommendations')).toEqual(['Home']);
  });

  it('inserts a tab at an index and drops the last other tab when the bar is full', () => {
    expect(addVisibleTabAt(['Home', 'Browse'], 'Recommendations', 1)).toEqual([
      'Home',
      'Recommendations',
      'Browse',
    ]);
    expect(addVisibleTabAt(['Home', 'Browse', 'My Library', 'Recommendations'], 'Home', 0)).toEqual(
      ['Home', 'Browse', 'My Library', 'Recommendations']
    );
  });

  it('applies a drop across sections without emptying the bar', () => {
    expect(
      applyTabBarDrop([...DEFAULT_VISIBLE_TABS], {
        fromIndex: 3,
        fromSection: 'visible',
        id: 'My Library',
        toIndex: 0,
        toSection: 'overflow',
      })
    ).toEqual(['Home', 'Browse', 'Recommendations']);
    expect(
      applyTabBarDrop(['Home'], {
        fromIndex: 0,
        fromSection: 'visible',
        id: 'Home',
        toIndex: 0,
        toSection: 'overflow',
      })
    ).toEqual(['Home']);
    expect(
      applyTabBarDrop(['Home', 'Browse'], {
        fromIndex: 0,
        fromSection: 'overflow',
        id: 'Recommendations',
        toIndex: 1,
        toSection: 'visible',
      })
    ).toEqual(['Home', 'Recommendations', 'Browse']);
  });
});
