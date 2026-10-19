import { describe, expect, it } from 'vitest';

import { createMarqueeTurnRegistry } from './marqueeTurns';

describe('createMarqueeTurnRegistry', () => {
  it('gives a lone scrolling member a new token after each pass', () => {
    const turns = createMarqueeTurnRegistry();
    turns.join('mini-player', 'title', 0);
    turns.setScrolls('mini-player', 'title', true);

    const first = turns.getTurn('mini-player', 'title');
    expect(first).toEqual(expect.any(Number));

    turns.finishTurn('mini-player', 'title');
    const second = turns.getTurn('mini-player', 'title');
    expect(second).toEqual(expect.any(Number));
    expect(second).not.toBe(first);
  });

  it('alternates in order even when the higher order joins first', () => {
    const turns = createMarqueeTurnRegistry();
    turns.join('mini-player', 'segment', 1);
    turns.setScrolls('mini-player', 'segment', true);
    turns.join('mini-player', 'title', 0);
    turns.setScrolls('mini-player', 'title', true);

    const titleFirst = turns.getTurn('mini-player', 'title');
    expect(titleFirst).toEqual(expect.any(Number));
    expect(turns.getTurn('mini-player', 'segment')).toBeNull();

    turns.finishTurn('mini-player', 'title');
    expect(turns.getTurn('mini-player', 'segment')).toEqual(expect.any(Number));
    expect(turns.getTurn('mini-player', 'title')).toBeNull();

    turns.finishTurn('mini-player', 'segment');
    expect(turns.getTurn('mini-player', 'title')).toEqual(expect.any(Number));
    expect(turns.getTurn('mini-player', 'title')).not.toBe(titleFirst);
    expect(turns.getTurn('mini-player', 'segment')).toBeNull();
  });

  it('skips a member that does not scroll', () => {
    const turns = createMarqueeTurnRegistry();
    turns.join('mini-player', 'title', 0);
    turns.join('mini-player', 'segment', 1);
    turns.setScrolls('mini-player', 'title', true);

    const first = turns.getTurn('mini-player', 'title');
    expect(first).toEqual(expect.any(Number));
    expect(turns.getTurn('mini-player', 'segment')).toBeNull();

    turns.finishTurn('mini-player', 'title');
    expect(turns.getTurn('mini-player', 'segment')).toBeNull();
    expect(turns.getTurn('mini-player', 'title')).toEqual(expect.any(Number));
    expect(turns.getTurn('mini-player', 'title')).not.toBe(first);
  });

  it('passes the turn when the active member leaves', () => {
    const turns = createMarqueeTurnRegistry();
    turns.join('mini-player', 'title', 0);
    turns.join('mini-player', 'segment', 1);
    turns.setScrolls('mini-player', 'title', true);
    turns.setScrolls('mini-player', 'segment', true);

    turns.leave('mini-player', 'title');
    expect(turns.getTurn('mini-player', 'title')).toBeNull();
    expect(turns.getTurn('mini-player', 'segment')).toEqual(expect.any(Number));
  });

  it('passes the turn when the active member stops scrolling', () => {
    const turns = createMarqueeTurnRegistry();
    turns.join('mini-player', 'title', 0);
    turns.join('mini-player', 'segment', 1);
    turns.setScrolls('mini-player', 'title', true);
    turns.setScrolls('mini-player', 'segment', true);

    turns.setScrolls('mini-player', 'title', false);
    expect(turns.getTurn('mini-player', 'title')).toBeNull();
    expect(turns.getTurn('mini-player', 'segment')).toEqual(expect.any(Number));
  });

  it('ignores finishTurn from a member that is not active', () => {
    const turns = createMarqueeTurnRegistry();
    turns.join('mini-player', 'title', 0);
    turns.join('mini-player', 'segment', 1);
    turns.setScrolls('mini-player', 'title', true);
    turns.setScrolls('mini-player', 'segment', true);

    const token = turns.getTurn('mini-player', 'title');
    turns.finishTurn('mini-player', 'segment');
    expect(turns.getTurn('mini-player', 'title')).toBe(token);
    expect(turns.getTurn('mini-player', 'segment')).toBeNull();
  });

  it('returns null when no member scrolls', () => {
    const turns = createMarqueeTurnRegistry();
    turns.join('mini-player', 'title', 0);
    turns.join('mini-player', 'segment', 1);
    expect(turns.getTurn('mini-player', 'title')).toBeNull();
    expect(turns.getTurn('mini-player', 'segment')).toBeNull();

    turns.setScrolls('mini-player', 'title', true);
    turns.setScrolls('mini-player', 'title', false);
    expect(turns.getTurn('mini-player', 'title')).toBeNull();
    expect(turns.getTurn('mini-player', 'segment')).toBeNull();
  });

  it('keeps groups independent', () => {
    const turns = createMarqueeTurnRegistry();
    turns.join('mini-player', 'title', 0);
    turns.join('full-player', 'title', 0);
    turns.setScrolls('mini-player', 'title', true);
    turns.setScrolls('full-player', 'title', true);

    const miniToken = turns.getTurn('mini-player', 'title');
    const fullToken = turns.getTurn('full-player', 'title');
    turns.finishTurn('mini-player', 'title');
    expect(turns.getTurn('mini-player', 'title')).not.toBe(miniToken);
    expect(turns.getTurn('full-player', 'title')).toBe(fullToken);
  });

  it('notifies a subscriber when the turn passes', () => {
    const turns = createMarqueeTurnRegistry();
    turns.join('mini-player', 'title', 0);
    turns.setScrolls('mini-player', 'title', true);

    let notifications = 0;
    const unsubscribe = turns.subscribe(() => {
      notifications += 1;
    });
    turns.finishTurn('mini-player', 'title');
    expect(notifications).toBe(1);

    unsubscribe();
    turns.finishTurn('mini-player', 'title');
    expect(notifications).toBe(1);
  });
});
