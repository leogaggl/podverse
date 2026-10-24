'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
import { useRef, useState } from 'react';

import type {
  ApiKeyExpirationDays,
  ApiKeyPermissions,
  ApiKeyPresetId,
  ApiKeyResource,
  CrudAction,
  DTOAccountApiKey,
  DTOAccountApiKeyCreated,
} from '@podverse/helpers';
import {
  API_KEY_DEFAULT_EXPIRATION_DAYS,
  API_KEY_ERROR_CODES,
  API_KEY_EXPIRATION_DAYS_OPTIONS,
  API_KEY_MAX_PER_ACCOUNT,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_RESOURCES,
  apiKeyPermissionsForPreset,
  apiKeyPermissionsGrantSupported,
  CRUD_ACTIONS,
  crudMaskHas,
  getErrorResponseBodyCode,
  getErrorResponseStatus,
} from '@podverse/helpers';
import {
  Button,
  CheckboxField,
  CopyToClipboardButton,
  FormDropdown,
  Modal,
  RadioButton,
  StackForm,
  TextInput,
} from '@podverse/ui';

import { getApiRequestService } from '../../../../factories/apiRequestService';
import { useMembershipGate } from '../../../../hooks/useMembershipGate';
import { handleRateLimitAlert } from '../../../../utils/rateLimit/rateLimitAlert';
import { apiKeyActionLabelKey, apiKeyResourceLabelKey } from './apiKeyDisplay';
import {
  apiKeyCreateBody,
  apiKeyExpirationFromDropdownValue,
  apiKeyExpirationToDropdownValue,
  apiKeyPermissionCellKind,
  toggleApiKeyPermission,
} from './apiKeyForm';

import styles from '../../../../styles/components/Settings/Panels/SettingsDeveloper/ModalCreateApiKey.module.scss';

type ModalCreateApiKeyProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (apiKey: DTOAccountApiKey) => void;
  existingKeyCount: number | null;
};

type ApiKeyExpirationLabelKey =
  'expiration_30' | 'expiration_90' | 'expiration_365' | 'no_expiration';

type ApiKeyResourceHelpKey =
  | 'resources_help.account'
  | 'resources_help.settings'
  | 'resources_help.subscriptions'
  | 'resources_help.add_by_rss'
  | 'resources_help.playlists'
  | 'resources_help.queue'
  | 'resources_help.history'
  | 'resources_help.clips'
  | 'resources_help.notifications';

function apiKeyExpirationLabelKey(days: ApiKeyExpirationDays): ApiKeyExpirationLabelKey {
  switch (days) {
    case 30:
      return 'expiration_30';
    case 90:
      return 'expiration_90';
    case 365:
      return 'expiration_365';
    case null:
      return 'no_expiration';
    default: {
      const unexpected: never = days;
      throw new Error(`Unknown API key expiration: ${String(unexpected)}`);
    }
  }
}

function apiKeyResourceHelpKey(resource: ApiKeyResource): ApiKeyResourceHelpKey {
  switch (resource) {
    case 'account':
      return 'resources_help.account';
    case 'settings':
      return 'resources_help.settings';
    case 'subscriptions':
      return 'resources_help.subscriptions';
    case 'add_by_rss':
      return 'resources_help.add_by_rss';
    case 'playlists':
      return 'resources_help.playlists';
    case 'queue':
      return 'resources_help.queue';
    case 'history':
      return 'resources_help.history';
    case 'clips':
      return 'resources_help.clips';
    case 'notifications':
      return 'resources_help.notifications';
    default: {
      const unexpected: never = resource;
      throw new Error(`Unknown API key resource: ${String(unexpected)}`);
    }
  }
}

type ApiKeyPresetChoice = ApiKeyPresetId | 'custom';

function isPresetChoice(value: string): value is ApiKeyPresetChoice {
  return value === 'read_only' || value === 'full_access' || value === 'custom';
}

function initialPermissions(): ApiKeyPermissions {
  return apiKeyPermissionsForPreset('read_only');
}

export function ModalCreateApiKey({
  isOpen,
  onClose,
  onCreated,
  existingKeyCount,
}: ModalCreateApiKeyProps) {
  const t = useTranslations('settings.developer');
  const tMisc = useTranslations('misc');
  const tFeatures = useTranslations('features');
  const locale = useLocale();
  const { tryHandleMembershipGateError } = useMembershipGate();
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<ApiKeyPermissions>(initialPermissions);
  const [presetChoice, setPresetChoice] = useState<ApiKeyPresetChoice>('read_only');
  const [expiresInDays, setExpiresInDays] = useState<ApiKeyExpirationDays>(
    API_KEY_DEFAULT_EXPIRATION_DAYS
  );
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [created, setCreated] = useState<DTOAccountApiKeyCreated | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const resetAndClose = () => {
    setName('');
    setPermissions(initialPermissions());
    setPresetChoice('read_only');
    setExpiresInDays(API_KEY_DEFAULT_EXPIRATION_DAYS);
    setNameError(undefined);
    setFormError(undefined);
    setCreated(null);
    onClose();
  };

  const requestClose = () => {
    if (submittingRef.current) {
      return;
    }
    resetAndClose();
  };

  const onNameChange = (value: string) => {
    setName(value);
    setNameError(undefined);
    setFormError(undefined);
  };

  const onExpirationChange = (value: string) => {
    setExpiresInDays(apiKeyExpirationFromDropdownValue(value));
    setFormError(undefined);
  };

  const onPresetChange = (value: string) => {
    if (!isPresetChoice(value)) {
      return;
    }
    setPresetChoice(value);
    if (value !== 'custom') {
      setPermissions(apiKeyPermissionsForPreset(value));
    }
    setFormError(undefined);
  };

  const onPermissionChange = (resource: ApiKeyResource, action: CrudAction, enabled: boolean) => {
    setPermissions((current) => toggleApiKeyPermission(current, resource, action, enabled));
    setFormError(undefined);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName === '') {
      setNameError(t('name_required'));
      return;
    }
    if (trimmedName.length > API_KEY_NAME_MAX_LENGTH) {
      setNameError(t('name_too_long', { max: API_KEY_NAME_MAX_LENGTH }));
      return;
    }
    if (!apiKeyPermissionsGrantSupported(permissions)) {
      return;
    }
    if (existingKeyCount !== null && existingKeyCount >= API_KEY_MAX_PER_ACCOUNT) {
      setFormError(t('limit_reached'));
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await getApiRequestService().reqAuthApiKeyCreate(
        apiKeyCreateBody({ name, permissions, expiresInDays })
      );
      onCreated(result.api_key);
      setCreated(result);
    } catch (error: unknown) {
      const rateLimitHandled = await handleRateLimitAlert(error, locale, tMisc);
      if (rateLimitHandled) {
        return;
      }
      if (tryHandleMembershipGateError(error)) {
        resetAndClose();
        return;
      }
      const code = getErrorResponseBodyCode(error);
      if (code === API_KEY_ERROR_CODES.permissionsEmpty) {
        return;
      }
      if (code === API_KEY_ERROR_CODES.limitReached) {
        setFormError(t('limit_reached'));
        return;
      }
      const status = getErrorResponseStatus(error);
      if (status === 400) {
        if (name.trim() === '') {
          setNameError(t('name_required'));
        } else {
          setFormError(t('create_error'));
        }
        return;
      }
      if (status === 401) {
        return;
      }
      setFormError(t('create_error'));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const title = created === null ? t('create') : t('created_title');

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      closeButtonAriaLabel={tMisc('close_modal')}
      header={title}
      ariaLabel={title}
    >
      <Modal.Body>
        {created === null ? (
          <StackForm onSubmit={handleSubmit}>
            <TextInput
              id="api-key-name"
              name="name"
              eyebrow={t('name')}
              placeholder={t('name_placeholder')}
              maxLength={API_KEY_NAME_MAX_LENGTH}
              autoComplete="off"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              infoError={nameError}
              aria-invalid={nameError !== undefined}
              aria-describedby={nameError !== undefined ? 'api-key-name-error' : undefined}
            />
            <FormDropdown
              id="api-key-expiration"
              eyebrow={t('expiration')}
              info={t('expiration_help')}
              value={apiKeyExpirationToDropdownValue(expiresInDays)}
              onChange={onExpirationChange}
              options={API_KEY_EXPIRATION_DAYS_OPTIONS.map((days) => ({
                value: apiKeyExpirationToDropdownValue(days),
                label: t(apiKeyExpirationLabelKey(days)),
              }))}
            />
            <RadioButton
              name="api-key-preset"
              eyebrow={t('presets')}
              selectedValue={presetChoice}
              onChange={onPresetChange}
              options={[
                { value: 'read_only', label: t('preset_read_only') },
                { value: 'full_access', label: t('preset_full_access') },
                { value: 'custom', label: t('preset_custom') },
              ]}
            />
            {presetChoice === 'custom' ? (
              <div className={styles.resources}>
                {API_KEY_RESOURCES.map((resource) => {
                  const helpId = `api-key-help-${resource}`;
                  const resourceLabel = t(apiKeyResourceLabelKey(resource));
                  return (
                    <fieldset key={resource} className={styles.resource} aria-describedby={helpId}>
                      <legend>{resourceLabel}</legend>
                      <p id={helpId} className={styles.help}>
                        {t(apiKeyResourceHelpKey(resource))}
                      </p>
                      <div className={styles.actions}>
                        {CRUD_ACTIONS.map((action) => {
                          const actionLabel = t(apiKeyActionLabelKey(action));
                          if (apiKeyPermissionCellKind(resource, action) === 'unsupported') {
                            const unavailableLabel = t('action_unavailable', {
                              resource: resourceLabel,
                              action: actionLabel,
                            });
                            return (
                              <span
                                key={action}
                                className={styles.unsupported}
                                role="img"
                                aria-label={unavailableLabel}
                              >
                                <span aria-hidden="true">—</span>
                              </span>
                            );
                          }
                          return (
                            <CheckboxField
                              key={action}
                              label={actionLabel}
                              checked={crudMaskHas(permissions[resource], action)}
                              name={`api-key-${resource}-${action}`}
                              onChange={(enabled) => onPermissionChange(resource, action, enabled)}
                            />
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            ) : null}
            {presetChoice === 'custom' && !apiKeyPermissionsGrantSupported(permissions) ? (
              <p role="alert">{t('permissions_empty')}</p>
            ) : null}
            {formError !== undefined ? <p role="alert">{formError}</p> : null}
            <Modal.Actions>
              <Button
                type="button"
                variant="secondary"
                onClick={requestClose}
                disabled={isSubmitting}
              >
                {tMisc('cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                disabled={isSubmitting}
              >
                {t('create')}
              </Button>
            </Modal.Actions>
          </StackForm>
        ) : (
          <>
            <p aria-live="polite">{t('shown_once')}</p>
            <div className={styles.tokenRow}>
              <div className={styles.tokenInput} spellCheck={false}>
                <TextInput
                  id="api-key-token"
                  readOnly
                  value={created.token}
                  eyebrow={t('token_label')}
                  autoComplete="off"
                />
              </div>
              <CopyToClipboardButton
                textToCopy={created.token}
                idleLabel={tFeatures('copy')}
                copiedLabel={tFeatures('copied')}
                errorLabel={t('copy_failed')}
              />
            </div>
            <Modal.Actions>
              <Button type="button" variant="primary" onClick={requestClose}>
                {tMisc('done')}
              </Button>
            </Modal.Actions>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
