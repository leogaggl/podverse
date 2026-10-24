import { describe, expect, it } from 'vitest';

import type { CrudAction } from './crudBitmask.js';
import {
  CRUD_ACTIONS,
  CRUD_BITS,
  CRUD_MASK_ALL,
  CRUD_MASK_NONE,
  crudMaskHas,
  crudMaskToActions,
  crudMaskWith,
  isCrudAction,
  isCrudMask,
} from './crudBitmask.js';

const CRUD_ACTION_BITS: ReadonlyArray<readonly [CrudAction, number]> = [
  ['create', 1],
  ['read', 2],
  ['update', 4],
  ['delete', 8],
];

describe('crudMaskHas', () => {
  it('matches each bit, including a zero mask, a full mask, and a combined mask', () => {
    const readAndUpdate = CRUD_BITS.read | CRUD_BITS.update;
    for (const [action, bit] of CRUD_ACTION_BITS) {
      expect(CRUD_BITS[action]).toBe(bit);
      expect(crudMaskHas(bit, action)).toBe(true);
      expect(crudMaskHas(CRUD_MASK_NONE, action)).toBe(false);
      expect(crudMaskHas(CRUD_MASK_ALL, action)).toBe(true);
      for (const other of CRUD_ACTIONS) {
        if (other !== action) {
          expect(crudMaskHas(bit, other)).toBe(false);
        }
      }
    }
    expect(crudMaskHas(readAndUpdate, 'read')).toBe(true);
    expect(crudMaskHas(readAndUpdate, 'update')).toBe(true);
    expect(crudMaskHas(readAndUpdate, 'create')).toBe(false);
    expect(crudMaskHas(readAndUpdate, 'delete')).toBe(false);
  });
});

describe('crudMaskWith', () => {
  it('turns each action on and off', () => {
    for (const [action, bit] of CRUD_ACTION_BITS) {
      expect(crudMaskWith(CRUD_MASK_NONE, action, true)).toBe(bit);
      expect(crudMaskWith(CRUD_MASK_ALL, action, false)).toBe(CRUD_MASK_ALL - bit);
      expect(crudMaskWith(bit, action, true)).toBe(bit);
      expect(crudMaskWith(CRUD_MASK_NONE, action, false)).toBe(CRUD_MASK_NONE);
    }
  });
});

describe('crudMaskToActions', () => {
  it('lists every action for 15, none for 0, and ignores bits above 8', () => {
    expect(CRUD_ACTIONS).toEqual(['create', 'read', 'update', 'delete']);
    expect(crudMaskToActions(CRUD_MASK_ALL)).toEqual(['create', 'read', 'update', 'delete']);
    expect(crudMaskToActions(CRUD_MASK_NONE)).toEqual([]);
    expect(crudMaskToActions(CRUD_BITS.read | 16)).toEqual(['read']);
  });
});

describe('isCrudMask', () => {
  it('accepts integers from 0 to 15 and rejects values outside that range', () => {
    expect(isCrudMask(CRUD_MASK_NONE)).toBe(true);
    expect(isCrudMask(CRUD_MASK_ALL)).toBe(true);
    expect(isCrudMask(CRUD_BITS.read | CRUD_BITS.update)).toBe(true);
    expect(isCrudMask(-1)).toBe(false);
    expect(isCrudMask(16)).toBe(false);
    expect(isCrudMask(2.5)).toBe(false);
    expect(isCrudMask('2')).toBe(false);
  });
});

describe('isCrudAction', () => {
  it('accepts the four CRUD actions and rejects anything else', () => {
    for (const action of CRUD_ACTIONS) {
      expect(isCrudAction(action)).toBe(true);
    }
    expect(isCrudAction('write')).toBe(false);
    expect(isCrudAction(2)).toBe(false);
  });
});
