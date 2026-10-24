'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  getTasteProfileConsentChoice,
  isTasteProfileConsentOptOutDestructive,
  isTasteProfileTrackingAllowed,
} from '@podverse/helpers';
import { SwitchButton } from '@podverse/ui';

import { ROUTES } from '../../../../constants/routes';
import { useAccount } from '../../../../contexts/Account';
import { useConfig } from '../../../../contexts/Config';
import { getApiRequestService } from '../../../../factories/apiRequestService';
import { tasteProfileConsentStatusKey } from '../../../../lib/tasteProfileConsentStatus';
import { ModalTasteProfileConsentOptOut } from '../../../Legal/ModalTasteProfileConsentOptOut';
import { showToast } from '../../../Toast/Toast';

type SettingsTasteProfileConsentSwitchProps = {
  describedById: string;
};

export function SettingsTasteProfileConsentSwitch({
  describedById,
}: SettingsTasteProfileConsentSwitchProps) {
  const t = useTranslations('taste_profile_consent');
  const tTasteProfile = useTranslations('taste_profile');
  const tMisc = useTranslations('misc');
  const router = useRouter();
  const { loggedInAccount, setLoggedInAccount } = useAccount();
  const config = useConfig();
  const [isSaving, setIsSaving] = useState(false);
  const [isOptOutConfirmOpen, setIsOptOutConfirmOpen] = useState(false);
  const version = config.public.legal.tasteProfileAgreement.version;
  const choice = getTasteProfileConsentChoice(loggedInAccount?.account_settings, version);
  const allowed = isTasteProfileTrackingAllowed(loggedInAccount?.account_settings, version);

  const turnOff = async () => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      const updatedAccount = await getApiRequestService().reqAccountSettingsListenStatsUpdate({
        accepted: false,
      });
      setLoggedInAccount(updatedAccount);
    } catch (error) {
      console.error('[SettingsTasteProfileConsentSwitch] update failed', error);
      showToast(t('error'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const showStatusHelp = choice !== 'allowed';
  const switchProps = {
    'aria-describedby': describedById,
    checked: allowed,
    hideLabel: true,
    id: 'taste-profile-consent',
    label: tTasteProfile('title'),
    loading: isSaving,
    onChange: (next: boolean) => {
      if (!next) {
        if (isTasteProfileConsentOptOutDestructive(loggedInAccount?.account_settings)) {
          setIsOptOutConfirmOpen(true);
          return;
        }
        void turnOff();
        return;
      }
      router.push(ROUTES.TASTE_PROFILE);
    },
    stateOffLabel: tMisc('off'),
    stateOnLabel: tMisc('on'),
  };

  return (
    <>
      {showStatusHelp ? (
        <SwitchButton
          {...switchProps}
          helpAriaLabel={tMisc('more_info')}
          helpText={t(tasteProfileConsentStatusKey(choice))}
        />
      ) : (
        <SwitchButton {...switchProps} />
      )}
      <ModalTasteProfileConsentOptOut
        isOpen={isOptOutConfirmOpen}
        onCancel={() => {
          setIsOptOutConfirmOpen(false);
        }}
        onConfirm={() => {
          setIsOptOutConfirmOpen(false);
          void turnOff();
        }}
      />
    </>
  );
}
