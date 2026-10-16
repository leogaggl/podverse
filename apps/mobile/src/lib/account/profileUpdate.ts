import type { DTOAccount } from '@podverse/helpers';
import { SharableStatusEnum } from '@podverse/helpers';

/** Body for `PUT /account`. */
export type AccountProfileUpdatePayload = {
  bio: string | null;
  display_name: string | null;
  locale: string;
  sharable_status: SharableStatusEnum;
};

/**
 * Blank display name and bio become null. Locale is copied through unchanged so the caller
 * decides which locale to keep.
 */
export function buildAccountProfileUpdatePayload(input: {
  bio: string;
  displayName: string;
  locale: string;
  sharableStatus: SharableStatusEnum;
}): AccountProfileUpdatePayload {
  const displayName = input.displayName.trim();
  const bio = input.bio.trim();

  return {
    bio: bio === '' ? null : bio,
    display_name: displayName === '' ? null : displayName,
    locale: input.locale,
    sharable_status: input.sharableStatus,
  };
}

/** Public, unlisted, or private. Any other id is private. */
export function toSharableStatus(value: number | undefined): SharableStatusEnum {
  if (
    value === SharableStatusEnum.Public ||
    value === SharableStatusEnum.Unlisted ||
    value === SharableStatusEnum.Private
  ) {
    return value;
  }
  return SharableStatusEnum.Private;
}

/**
 * Merge a profile save into the loaded account. The update response omits membership,
 * credentials, and follows, so callers persist this merged account.
 */
export function applyAccountProfileUpdate(
  account: DTOAccount,
  payload: AccountProfileUpdatePayload,
): DTOAccount {
  return {
    ...account,
    account_profile: {
      account_id: account.account_profile?.account_id ?? account.id,
      bio: payload.bio,
      display_name: payload.display_name,
      id: account.account_profile?.id ?? account.id,
    },
    sharable_status_id: payload.sharable_status,
  };
}
