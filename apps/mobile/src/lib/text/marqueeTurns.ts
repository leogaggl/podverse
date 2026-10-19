export type MarqueeTurnGroup = 'full-player' | 'mini-player';

type Listener = () => void;

type Member = {
  joinedAt: number;
  order: number;
  scrolls: boolean;
};

type GroupState = {
  activeId: string | null;
  members: Map<string, Member>;
  turn: number;
};

export type MarqueeTurnRegistry = {
  /** Turn token while `id` holds the turn, otherwise null. A new token means start a new pass. */
  getTurn: (group: MarqueeTurnGroup, id: string) => number | null;
  /** Ends the pass of `id`. Ignored unless `id` holds the turn. */
  finishTurn: (group: MarqueeTurnGroup, id: string) => void;
  join: (group: MarqueeTurnGroup, id: string, order: number) => void;
  leave: (group: MarqueeTurnGroup, id: string) => void;
  setScrolls: (group: MarqueeTurnGroup, id: string, scrolls: boolean) => void;
  subscribe: (listener: Listener) => () => void;
};

const sortsBefore = (member: Member, other: Member): boolean => {
  if (member.order !== other.order) {
    return member.order < other.order;
  }
  return member.joinedAt < other.joinedAt;
};

const eligibleMembers = (state: GroupState): Array<{ id: string } & Member> => {
  const eligible: Array<{ id: string } & Member> = [];
  state.members.forEach((member, id) => {
    if (member.scrolls) {
      eligible.push({ id, joinedAt: member.joinedAt, order: member.order, scrolls: true });
    }
  });
  eligible.sort((left, right) => {
    if (sortsBefore(left, right)) {
      return -1;
    }
    if (sortsBefore(right, left)) {
      return 1;
    }
    return 0;
  });
  return eligible;
};

/**
 * One label in a group moves at a time, and labels hand off after each pass in turn order.
 * A label that starts overflowing takes the turn when nobody holds it, or when it sorts ahead
 * of the label that does.
 */
export const createMarqueeTurnRegistry = (): MarqueeTurnRegistry => {
  const groups = new Map<MarqueeTurnGroup, GroupState>();
  const listeners = new Set<Listener>();
  let nextJoinedAt = 0;

  const notify = (): void => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  const readGroup = (group: MarqueeTurnGroup): GroupState | undefined => {
    return groups.get(group);
  };

  const ensureGroup = (group: MarqueeTurnGroup): GroupState => {
    const existing = groups.get(group);
    if (existing !== undefined) {
      return existing;
    }
    const created: GroupState = { activeId: null, members: new Map(), turn: 0 };
    groups.set(group, created);
    return created;
  };

  const assignTurn = (state: GroupState, nextId: string | null): void => {
    state.activeId = nextId;
    state.turn += 1;
    notify();
  };

  /** Next eligible label after `from`, wrapping around so a lone label keeps the turn. */
  const passTurn = (state: GroupState, from: Member): void => {
    const sorted = eligibleMembers(state);
    const next = sorted.find((member) => sortsBefore(from, member));
    assignTurn(state, next?.id ?? sorted[0]?.id ?? null);
  };

  return {
    finishTurn: (group, id) => {
      const state = readGroup(group);
      const member = state?.members.get(id);
      if (state === undefined || member === undefined || state.activeId !== id) {
        return;
      }
      passTurn(state, member);
    },
    getTurn: (group, id) => {
      const state = readGroup(group);
      if (state === undefined || state.activeId !== id) {
        return null;
      }
      return state.turn;
    },
    join: (group, id, order) => {
      const state = ensureGroup(group);
      const existing = state.members.get(id);
      if (existing !== undefined) {
        existing.order = order;
        return;
      }
      nextJoinedAt += 1;
      state.members.set(id, { joinedAt: nextJoinedAt, order, scrolls: false });
    },
    leave: (group, id) => {
      const state = readGroup(group);
      const member = state?.members.get(id);
      if (state === undefined || member === undefined) {
        return;
      }
      const wasActive = state.activeId === id;
      state.members.delete(id);
      if (wasActive) {
        passTurn(state, member);
      }
    },
    setScrolls: (group, id, scrolls) => {
      const state = readGroup(group);
      const member = state?.members.get(id);
      if (state === undefined || member === undefined || member.scrolls === scrolls) {
        return;
      }
      member.scrolls = scrolls;
      if (!scrolls) {
        if (state.activeId === id) {
          passTurn(state, member);
        }
        return;
      }
      const active = state.activeId === null ? undefined : state.members.get(state.activeId);
      if (active === undefined || sortsBefore(member, active)) {
        assignTurn(state, id);
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

/** Process-wide registry for player chrome. */
export const marqueeTurns = createMarqueeTurnRegistry();
