import { handleGenericErrorResponse } from '@api/controllers/helpers/error.js';
import {
  countApiKeys,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '@api/lib/auth/apiKeyStore.js';
import { ensureAuthenticated, getAuthenticatedUser } from '@api/lib/auth/index.js';
import { getParamRequired } from '@api/lib/params.js';
import { validateBodyObject } from '@api/lib/validation/index.js';
import type { Request, Response } from 'express';
import Joi from 'joi';

import type { ApiKeyExpirationDays, DTOAccountApiKey } from '@podverse/helpers';
import {
  API_KEY_DEFAULT_EXPIRATION_DAYS,
  API_KEY_ERROR_CODES,
  API_KEY_EXPIRATION_DAYS_OPTIONS,
  API_KEY_MAX_PER_ACCOUNT,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_RESOURCES,
  apiKeyPermissionsGrantSupported,
  CRUD_MASK_ALL,
  CRUD_MASK_NONE,
  isApiKeyExpirationDays,
  normalizeApiKeyPermissions,
} from '@podverse/helpers';
import type { AccountApiKeyRow } from '@podverse/orm';
import { isValidNanoIdV2IdText } from '@podverse/orm';

const apiKeyNotFound = { message: 'API key not found' };

const permissionsSchema = Joi.object(
  Object.fromEntries(
    API_KEY_RESOURCES.map((resource) => [
      resource,
      Joi.number().integer().min(CRUD_MASK_NONE).max(CRUD_MASK_ALL),
    ])
  )
);

const createBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(API_KEY_NAME_MAX_LENGTH).required(),
  permissions: permissionsSchema.required(),
  expires_in_days: Joi.valid(...API_KEY_EXPIRATION_DAYS_OPTIONS).default(
    API_KEY_DEFAULT_EXPIRATION_DAYS
  ),
});

function toAccountApiKeyDto(row: AccountApiKeyRow): DTOAccountApiKey {
  return {
    id_text: row.id_text,
    name: row.name,
    token_hint: row.token_hint,
    permissions: row.permissions,
    created_at: row.created_at.toISOString(),
    expires_at: row.expires_at === null ? null : row.expires_at.toISOString(),
    last_used_at: row.last_used_at === null ? null : row.last_used_at.toISOString(),
  };
}

function readCreateApiKeyFields(value: unknown): {
  name: string;
  permissions: unknown;
  expiresInDays: ApiKeyExpirationDays;
} {
  if (typeof value !== 'object' || value === null) {
    throw new Error('API key create body is not an object');
  }
  const name = Reflect.get(value, 'name');
  const expiresInDays = Reflect.get(value, 'expires_in_days');
  if (typeof name !== 'string' || !isApiKeyExpirationDays(expiresInDays)) {
    throw new Error('API key create body is missing name or expiry');
  }
  return {
    name,
    permissions: Reflect.get(value, 'permissions'),
    expiresInDays,
  };
}

export class AccountApiKeyController {
  static async list(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        try {
          const user = getAuthenticatedUser(req);
          const rows = await listApiKeys(user.id);
          res.status(200).json({
            rows: rows.map((row) => toAccountApiKeyDto(row)),
          });
        } catch (error) {
          handleGenericErrorResponse(res, error);
          return;
        }
      },
      { skipMembershipStatus: true, skipTermsAcceptance: true }
    );
  }

  static async create(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        validateBodyObject(createBodySchema, req, res, async () => {
          try {
            const user = getAuthenticatedUser(req);
            const fields = readCreateApiKeyFields(req.body);
            const permissions = normalizeApiKeyPermissions(fields.permissions);
            if (!apiKeyPermissionsGrantSupported(permissions)) {
              res.status(400).json({
                message: 'Grant at least one permission.',
                code: API_KEY_ERROR_CODES.permissionsEmpty,
              });
              return;
            }
            // Checked per request. Two creates at the same time can both pass.
            if ((await countApiKeys(user.id)) >= API_KEY_MAX_PER_ACCOUNT) {
              res.status(409).json({
                message: 'This account already has the most API keys allowed. Revoke one first.',
                code: API_KEY_ERROR_CODES.limitReached,
              });
              return;
            }
            const created = await createApiKey({
              accountId: user.id,
              name: fields.name,
              permissions,
              expiresInDays: fields.expiresInDays,
            });
            res.status(201).json({
              api_key: toAccountApiKeyDto(created.apiKey),
              token: created.token,
            });
          } catch (error) {
            handleGenericErrorResponse(res, error);
            return;
          }
        });
      },
      { skipMembershipStatus: false }
    );
  }

  static async revoke(req: Request, res: Response): Promise<void> {
    ensureAuthenticated(
      req,
      res,
      async () => {
        try {
          const user = getAuthenticatedUser(req);
          const apiKeyIdText = getParamRequired(req, 'api_key_id_text');
          if (!isValidNanoIdV2IdText(apiKeyIdText)) {
            res.status(404).json(apiKeyNotFound);
            return;
          }
          const revoked = await revokeApiKey({ accountId: user.id, apiKeyIdText });
          if (!revoked) {
            res.status(404).json(apiKeyNotFound);
            return;
          }
          res.status(200).json({ message: 'API key revoked' });
        } catch (error) {
          handleGenericErrorResponse(res, error);
          return;
        }
      },
      { skipMembershipStatus: true, skipTermsAcceptance: true }
    );
  }
}
