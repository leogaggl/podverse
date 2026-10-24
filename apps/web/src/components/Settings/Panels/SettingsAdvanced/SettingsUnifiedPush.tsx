'use client';

import { useTranslations } from 'next-intl';

import {
  Button,
  InlineForm,
  InlineFormButtons,
  InlineFormFieldGroup,
  InlineFormInfo,
  SwitchButton,
  TextInput,
} from '@podverse/ui';

import { usePushChannelControls } from '../SettingsNotifications/usePushChannelControls';

import styles from '../../../../styles/components/Settings/Panels/SettingsNotifications/SettingsNotifications.module.scss';

export function SettingsUnifiedPush() {
  const tMisc = useTranslations('misc');
  const tSettings = useTranslations('settings');
  const {
    cancelUPForm,
    handleUPToggle,
    loadingUnifiedPush,
    setUPAuthKeyInput,
    setUPEndpointError,
    setUPEndpointInput,
    showUPForm,
    upAuthKeyInput,
    upEndpoint,
    upEndpointError,
    upEndpointInput,
    upRegistered,
    validateAndEnableUP,
  } = usePushChannelControls();

  return (
    <>
      <SwitchButton
        id="unifiedpush"
        label={tSettings('notifications.unified_push')}
        checked={upRegistered}
        onChange={(next) => {
          void handleUPToggle(next);
        }}
        loading={loadingUnifiedPush}
        helpAriaLabel={tMisc('more_info')}
        helpText={tSettings('notifications.unified_push_help')}
        aria-describedby="unifiedpush-help"
        stateOffLabel={tMisc('off')}
        stateOnLabel={tMisc('on')}
      />

      {showUPForm && !upRegistered ? (
        <InlineForm>
          <InlineFormInfo>{tSettings('notifications.up_endpoint_info')}</InlineFormInfo>
          <TextInput
            id="up-endpoint"
            value={upEndpointInput}
            onChange={(event) => {
              setUPEndpointInput(event.target.value);
              setUPEndpointError(undefined);
            }}
            placeholder={tSettings('notifications.up_endpoint_placeholder')}
            eyebrow={tSettings('notifications.up_endpoint_label')}
            infoError={upEndpointError}
            aria-invalid={!!upEndpointError}
          />
          <InlineFormFieldGroup>
            <InlineFormInfo>{tSettings('notifications.up_auth_key_info')}</InlineFormInfo>
            <TextInput
              id="up-auth-key"
              value={upAuthKeyInput}
              onChange={(event) => setUPAuthKeyInput(event.target.value)}
              placeholder={tSettings('notifications.up_auth_key_placeholder')}
              eyebrow={tSettings('notifications.up_auth_key_label')}
              type="password"
            />
          </InlineFormFieldGroup>
          <InlineFormButtons>
            <Button variant="secondary" onClick={cancelUPForm}>
              {tSettings('notifications.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void validateAndEnableUP();
              }}
              disabled={!upEndpointInput.trim()}
            >
              {tSettings('notifications.enable')}
            </Button>
          </InlineFormButtons>
        </InlineForm>
      ) : null}

      {upRegistered && upEndpoint ? (
        <div className={styles.upEndpointDisplay}>
          <span className={styles.upEndpointLabel}>
            {tSettings('notifications.up_current_endpoint')}
          </span>
          <span className={styles.upEndpointValue}>{upEndpoint}</span>
        </div>
      ) : null}
    </>
  );
}
