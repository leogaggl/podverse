import type { DTOBillingEventOutcome, DTOBillingStatus } from '@podverse/helpers';

import { billingErrorCode } from './billingGuards';
import { membershipGrantedFromOutcomes } from './purchaseStanding';

export type SettledStorePhase = 'confirmed' | 'failed' | 'unconfirmed' | 'waiting';

export type StorePurchasePostResult = {
  confirmed: boolean;
  outcomes?: readonly DTOBillingEventOutcome[];
  status?: DTOBillingStatus;
};

export type SettledStorePurchase = {
  billingStatus: DTOBillingStatus | null;
  errorCode: string | null;
  membershipGranted: boolean | null;
  phase: SettledStorePhase;
};

const emptyStanding = {
  billingStatus: null,
  membershipGranted: null,
};

/**
 * Posts the purchase, then finishes the store transaction only when the API says every event
 * was recorded. Pending purchases are not posted and not finished. A recorded sandbox charge
 * that did not extend membership still finishes, and reports that it was not applied.
 */
export const settleStorePurchase = async (params: {
  pending: boolean;
  post: () => Promise<StorePurchasePostResult>;
  finish: () => Promise<void>;
}): Promise<SettledStorePurchase> => {
  if (params.pending) {
    return { ...emptyStanding, errorCode: null, phase: 'waiting' };
  }

  try {
    const result = await params.post();
    const standing = {
      billingStatus: result.status ?? null,
      membershipGranted: membershipGrantedFromOutcomes(result.outcomes),
    };
    if (result.confirmed !== true) {
      return { ...standing, errorCode: null, phase: 'unconfirmed' };
    }
    await params.finish();
    return { ...standing, errorCode: null, phase: 'confirmed' };
  } catch (error) {
    return { ...emptyStanding, errorCode: billingErrorCode(error), phase: 'failed' };
  }
};
