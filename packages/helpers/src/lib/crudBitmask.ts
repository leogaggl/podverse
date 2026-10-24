/** CRUD permission bits. A mask is their sum, 0-15. */
export const CRUD_BITS = { create: 1, read: 2, update: 4, delete: 8 } as const;

/** Display and iteration order. */
export const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'] as const;
export type CrudAction = (typeof CRUD_ACTIONS)[number];

export const CRUD_MASK_NONE = 0;
export const CRUD_MASK_ALL = 15;

export function isCrudAction(value: unknown): value is CrudAction {
  return CRUD_ACTIONS.some((action) => action === value);
}

/** An integer from 0 to 15. */
export function isCrudMask(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= CRUD_MASK_NONE &&
    value <= CRUD_MASK_ALL
  );
}

export function crudMaskHas(mask: number, action: CrudAction): boolean {
  return (mask & CRUD_BITS[action]) !== 0;
}

/** The mask with `action` turned on or off. */
export function crudMaskWith(mask: number, action: CrudAction, enabled: boolean): number {
  const bit = CRUD_BITS[action];
  if (enabled) {
    return mask | bit;
  }
  return mask & ~bit;
}

/** Actions in CRUD_ACTIONS order. Bits above 8 are ignored. */
export function crudMaskToActions(mask: number): CrudAction[] {
  const actions: CrudAction[] = [];
  for (const action of CRUD_ACTIONS) {
    if (crudMaskHas(mask, action)) {
      actions.push(action);
    }
  }
  return actions;
}
