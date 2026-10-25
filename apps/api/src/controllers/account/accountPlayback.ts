import { randomUUID } from 'node:crypto';

import { handleGenericErrorResponse } from '@api/controllers/helpers/error.js';
import { PlaybackStoreUnavailableError } from '@api/lib/accountPlayback/playbackRedis.js';
import {
  handlePlaybackPresenceChange,
  publishPlaybackState,
} from '@api/lib/accountPlayback/playbackService.js';
import {
  decidePlaybackStatePublish,
  toPlaybackStateDto,
} from '@api/lib/accountPlayback/playbackStatePolicy.js';
import type { StoredPlaybackState } from '@api/lib/accountPlayback/playbackStore.js';
import {
  compareAndSetPlaybackState,
  isPlaybackSessionPresent,
  readPlaybackCommand,
  readPlaybackDevices,
  readPlaybackState,
  savePlaybackCommand,
  touchPlaybackPresence,
} from '@api/lib/accountPlayback/playbackStore.js';
import { ensureAuthenticated, getAuthenticatedUser } from '@api/lib/auth/index.js';
import { getParamRequired } from '@api/lib/params.js';
import { validateBodyObject, validateParamsObject } from '@api/lib/validation/index.js';
import type { Request, Response } from 'express';
import Joi from 'joi';

import type {
  DTOPlaybackCommandEnvelope,
  DTOPlaybackDevice,
  PlaybackCommandSendBody,
  PlaybackCommandSendResponse,
  PlaybackErrorCode,
  PlaybackPresenceResponse,
  PlaybackStartFailedBody,
  PlaybackStatePublishBody,
  PlaybackStatePublishResponse,
} from '@podverse/helpers';
import {
  isDTOPlaybackCommand,
  isDTOPlaybackState,
  isPlainObject,
  isPlaybackCommandAllowed,
  PLAYBACK_COMMAND_TTL_MS,
  PLAYBACK_ERROR_CODES,
  PLAYBACK_IMAGE_URL_MAX_LENGTH,
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  PLAYBACK_START_FAILED_REASONS,
  PLAYBACK_STATUSES,
  PLAYBACK_TEXT_FIELD_MAX_LENGTH,
} from '@podverse/helpers';
import { publishAccountEvents } from '@podverse/orm';

/** A publish that loses this many revision races in a row answers 409; the client claims again. */
const PLAYBACK_STATE_WRITE_ATTEMPTS = 3;

const playbackIdTextSchema = Joi.string().max(PLAYBACK_TEXT_FIELD_MAX_LENGTH);
const playbackSecondsSchema = Joi.number().strict().min(0);
const playbackRateSchema = Joi.number().strict().min(PLAYBACK_RATE_MIN).max(PLAYBACK_RATE_MAX);

const playbackResourceRefSchema = Joi.alternatives().try(
  Joi.object({
    kind: Joi.string().valid('item').required(),
    item_id_text: playbackIdTextSchema.required(),
  }),
  Joi.object({
    kind: Joi.string().valid('clip').required(),
    clip_id_text: playbackIdTextSchema.required(),
  }),
  Joi.object({
    kind: Joi.string().valid('soundbite').required(),
    item_soundbite_id_text: playbackIdTextSchema.required(),
  }),
  Joi.object({
    kind: Joi.string().valid('add_by_rss').required(),
    add_by_rss_hash_id: playbackIdTextSchema.required(),
  })
);

const playbackResourceSummarySchema = Joi.object({
  ref: playbackResourceRefSchema.required(),
  /** A `MediumEnum` member; the guard rejects any other integer. */
  medium: Joi.number().integer().strict().required(),
  title: Joi.string().allow('', null).max(PLAYBACK_TEXT_FIELD_MAX_LENGTH).required(),
  channel_title: Joi.string().allow('', null).max(PLAYBACK_TEXT_FIELD_MAX_LENGTH).required(),
  image_url: Joi.string().allow('', null).max(PLAYBACK_IMAGE_URL_MAX_LENGTH).required(),
});

/** One branch per command type; unknown keys are stripped on every branch. */
const playbackCommandSchema = Joi.alternatives().try(
  Joi.object({ type: Joi.string().valid('play').required() }),
  Joi.object({ type: Joi.string().valid('pause').required() }),
  Joi.object({
    type: Joi.string().valid('seek').required(),
    position_seconds: playbackSecondsSchema.required(),
  }),
  Joi.object({
    type: Joi.string().valid('set_rate').required(),
    rate: playbackRateSchema.required(),
  }),
  Joi.object({ type: Joi.string().valid('next').required() }),
  Joi.object({ type: Joi.string().valid('previous').required() }),
  Joi.object({
    type: Joi.string().valid('play_item').required(),
    resource: playbackResourceRefSchema.required(),
    add_by_rss_resource_data: Joi.when('resource.kind', {
      is: 'add_by_rss',
      then: Joi.object().required(),
      otherwise: Joi.valid(null).required(),
    }),
    start_seconds: playbackSecondsSchema.allow(null).required(),
  }),
  Joi.object({ type: Joi.string().valid('take_over').required() })
);

/**
 * Joi schemas with the limits and live rules of the playback stream guards in `@podverse/helpers`.
 * Every handler runs the matching guard after Joi as well, so the two cannot drift apart.
 */
const playbackSchemas = {
  statePublishBody: Joi.object({
    claim: Joi.boolean().strict().required(),
    resource: playbackResourceSummarySchema.allow(null).required(),
    status: Joi.when('resource', {
      is: null,
      then: Joi.valid('paused').required(),
      otherwise: Joi.string()
        .valid(...PLAYBACK_STATUSES)
        .required(),
    }),
    is_live: Joi.boolean().strict().required(),
    position_seconds: Joi.when('is_live', {
      is: true,
      then: Joi.valid(null).required(),
      otherwise: Joi.when('resource', {
        is: null,
        then: Joi.valid(null).required(),
        otherwise: playbackSecondsSchema.allow(null).required(),
      }),
    }),
    duration_seconds: Joi.when('is_live', {
      is: true,
      then: Joi.valid(null).required(),
      otherwise: playbackSecondsSchema.allow(null).required(),
    }),
    rate: Joi.when('is_live', {
      is: true,
      then: Joi.valid(1).required(),
      otherwise: playbackRateSchema.required(),
    }),
  }),
  commandSendBody: Joi.object({
    target_session_id_text: playbackIdTextSchema.optional(),
    command: playbackCommandSchema.required(),
  }),
  startFailedBody: Joi.object({
    reason: Joi.string()
      .valid(...PLAYBACK_START_FAILED_REASONS)
      .required(),
  }),
  commandIdParams: Joi.object({
    command_id: Joi.string().guid().required(),
  }),
};

const PLAYBACK_ERROR_MESSAGES: Record<PlaybackErrorCode, string> = {
  [PLAYBACK_ERROR_CODES.notActiveDevice]: 'This device is not the active playback device.',
  [PLAYBACK_ERROR_CODES.noActiveDevice]: 'No device is playing.',
  [PLAYBACK_ERROR_CODES.deviceNotConnected]: 'That device is not connected.',
  [PLAYBACK_ERROR_CODES.targetAlreadyActive]: 'That device is already playing.',
  [PLAYBACK_ERROR_CODES.nothingToTransfer]: 'Nothing is loaded to transfer.',
  [PLAYBACK_ERROR_CODES.commandNotAllowedForLive]: 'That command is not available for a live item.',
  [PLAYBACK_ERROR_CODES.takeOverSelf]: 'Play locally to move playback to this device.',
  [PLAYBACK_ERROR_CODES.unavailable]: 'Playback is unavailable.',
};

const sendPlaybackError = (
  res: Response,
  status: 400 | 409 | 503,
  code: PlaybackErrorCode,
  extra?: { active_session_id_text: string | null }
): void => {
  res.status(status).json({ message: PLAYBACK_ERROR_MESSAGES[code], code, ...extra });
};

const isPlaybackStatePublishBody = (value: unknown): value is PlaybackStatePublishBody =>
  isPlainObject(value) &&
  typeof value.claim === 'boolean' &&
  isDTOPlaybackState({
    ...value,
    revision: 0,
    active_session_id_text: null,
    updated_at_ms: 0,
    sent_at_ms: 0,
  });

const isPlaybackCommandSendBody = (value: unknown): value is PlaybackCommandSendBody => {
  if (!isPlainObject(value) || !isDTOPlaybackCommand(value.command)) {
    return false;
  }
  const target = value.target_session_id_text;
  return (
    target === undefined ||
    (typeof target === 'string' &&
      target.length > 0 &&
      target.length <= PLAYBACK_TEXT_FIELD_MAX_LENGTH)
  );
};

const isPlaybackStartFailedBody = (value: unknown): value is PlaybackStartFailedBody =>
  isPlainObject(value) && PLAYBACK_START_FAILED_REASONS.some((reason) => reason === value.reason);

interface PlaybackCaller {
  accountId: number;
  device: DTOPlaybackDevice;
}

/** Playback devices are login sessions, so a request without session details is a 401. */
const getPlaybackCaller = (req: Request, res: Response): PlaybackCaller | null => {
  const user = getAuthenticatedUser(req);
  if (
    user.session_id_text === null ||
    user.session_client_type === undefined ||
    user.session_created_at === undefined
  ) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  return {
    accountId: user.id,
    device: {
      session_id_text: user.session_id_text,
      client_type: user.session_client_type,
      device_label: user.session_device_label ?? null,
      session_created_at: user.session_created_at,
    },
  };
};

const handlePlaybackError = (res: Response, err: unknown): void => {
  if (err instanceof PlaybackStoreUnavailableError) {
    sendPlaybackError(res, 503, PLAYBACK_ERROR_CODES.unavailable);
    return;
  }
  handleGenericErrorResponse(res, err);
};

/** Membership-gated like the queue now-playing routes, then validated, then run for the caller. */
const runPlaybackRoute = (
  req: Request,
  res: Response,
  schemas: { body?: Joi.ObjectSchema; params?: Joi.ObjectSchema },
  handler: (caller: PlaybackCaller) => Promise<void>
): void => {
  ensureAuthenticated(
    req,
    res,
    () => {
      const run = async (): Promise<void> => {
        try {
          const caller = getPlaybackCaller(req, res);
          if (caller === null) {
            return;
          }
          await handler(caller);
        } catch (err) {
          handlePlaybackError(res, err);
        }
      };
      const runWithBody = (): void => {
        if (schemas.body === undefined) {
          void run();
          return;
        }
        validateBodyObject(schemas.body, req, res, () => {
          void run();
        });
      };
      if (schemas.params === undefined) {
        runWithBody();
        return;
      }
      validateParamsObject(schemas.params, req, res, runWithBody);
    },
    { skipMembershipStatus: false }
  );
};

export class AccountPlaybackController {
  /** POST /account/playback/presence */
  static async checkIn(req: Request, res: Response): Promise<void> {
    runPlaybackRoute(req, res, {}, async ({ accountId, device }) => {
      const nowMs = Date.now();
      const result = await touchPlaybackPresence({ accountId, device, nowMs });
      await handlePlaybackPresenceChange({ accountId, result, nowMs });

      const [devices, current] = await Promise.all([
        readPlaybackDevices({ accountId, nowMs }),
        readPlaybackState(accountId),
      ]);
      const response: PlaybackPresenceResponse = {
        session_id_text: device.session_id_text,
        devices,
        state: current.state === null ? null : toPlaybackStateDto(current.state, nowMs),
      };
      res.status(200).json(response);
    });
  }

  /** POST /account/playback/state */
  static async publishState(req: Request, res: Response): Promise<void> {
    runPlaybackRoute(
      req,
      res,
      { body: playbackSchemas.statePublishBody },
      async ({ accountId, device }) => {
        const body: unknown = req.body;
        if (!isPlaybackStatePublishBody(body)) {
          res.status(400).json({ message: 'Invalid playback state' });
          return;
        }

        const nowMs = Date.now();
        const callerSessionIdText = device.session_id_text;
        const presence = await touchPlaybackPresence({ accountId, device, nowMs });
        await handlePlaybackPresenceChange({ accountId, result: presence, nowMs });

        let latestActiveSessionIdText: string | null = null;
        for (let attempt = 0; attempt < PLAYBACK_STATE_WRITE_ATTEMPTS; attempt += 1) {
          const current = await readPlaybackState(accountId);
          const decision = decidePlaybackStatePublish({
            current,
            callerSessionIdText,
            body,
            nowMs,
          });

          if (decision.kind === 'not_active') {
            sendPlaybackError(res, 409, PLAYBACK_ERROR_CODES.notActiveDevice, {
              active_session_id_text: decision.activeSessionIdText,
            });
            return;
          }

          if (decision.kind === 'unchanged') {
            const response: PlaybackStatePublishResponse = {
              revision: current.revision,
              active_session_id_text: current.activeSessionIdText,
            };
            res.status(200).json(response);
            return;
          }

          const write = await compareAndSetPlaybackState({
            accountId,
            expectedRevision: current.revision,
            expectedActive: body.claim
              ? { kind: 'any' }
              : { kind: 'session', sessionIdText: callerSessionIdText },
            newActiveSessionIdText: decision.newActiveSessionIdText,
            state: decision.state,
          });

          if (write.kind === 'written') {
            await publishPlaybackState(accountId, decision.state, nowMs);
            const response: PlaybackStatePublishResponse = {
              revision: write.revision,
              active_session_id_text: decision.newActiveSessionIdText,
            };
            res.status(200).json(response);
            return;
          }

          latestActiveSessionIdText = write.activeSessionIdText;
        }

        sendPlaybackError(res, 409, PLAYBACK_ERROR_CODES.notActiveDevice, {
          active_session_id_text: latestActiveSessionIdText,
        });
      }
    );
  }

  /**
   * POST /account/playback/commands
   *
   * Relays one command to one device's streams and stores only the record a start-failed report
   * checks. Nothing is queued for later delivery or retried: a target whose stream is not open
   * at that moment never sees the command. `next` and `previous` are relayed like any other
   * command; the playing device runs its own button handler, and any queue write that follows
   * goes through the queue routes.
   */
  static async sendCommand(req: Request, res: Response): Promise<void> {
    runPlaybackRoute(
      req,
      res,
      { body: playbackSchemas.commandSendBody },
      async ({ accountId, device }) => {
        const body: unknown = req.body;
        if (!isPlaybackCommandSendBody(body)) {
          res.status(400).json({ message: 'Invalid playback command' });
          return;
        }

        const nowMs = Date.now();
        const callerSessionIdText = device.session_id_text;
        const { command } = body;
        const current = await readPlaybackState(accountId);

        let targetSessionIdText: string;
        let transferState: StoredPlaybackState | null = null;
        if (command.type === 'take_over') {
          if (body.target_session_id_text === undefined) {
            res.status(400).json({ message: 'target_session_id_text is required for take_over' });
            return;
          }
          if (body.target_session_id_text === callerSessionIdText) {
            sendPlaybackError(res, 400, PLAYBACK_ERROR_CODES.takeOverSelf);
            return;
          }
          if (body.target_session_id_text === current.activeSessionIdText) {
            sendPlaybackError(res, 409, PLAYBACK_ERROR_CODES.targetAlreadyActive);
            return;
          }
          if (current.state === null || current.state.resource === null) {
            sendPlaybackError(res, 409, PLAYBACK_ERROR_CODES.nothingToTransfer);
            return;
          }
          targetSessionIdText = body.target_session_id_text;
          transferState = current.state;
        } else {
          if (body.target_session_id_text !== undefined) {
            res
              .status(400)
              .json({ message: 'target_session_id_text is only allowed for take_over' });
            return;
          }
          if (current.activeSessionIdText === null) {
            sendPlaybackError(res, 409, PLAYBACK_ERROR_CODES.noActiveDevice);
            return;
          }
          targetSessionIdText = current.activeSessionIdText;
        }

        const targetPresent = await isPlaybackSessionPresent({
          accountId,
          sessionIdText: targetSessionIdText,
          nowMs,
        });
        if (!targetPresent) {
          sendPlaybackError(res, 409, PLAYBACK_ERROR_CODES.deviceNotConnected);
          return;
        }

        if (
          current.state?.is_live === true &&
          !isPlaybackCommandAllowed(command.type, { isLive: true })
        ) {
          sendPlaybackError(res, 409, PLAYBACK_ERROR_CODES.commandNotAllowedForLive);
          return;
        }

        const commandId = randomUUID();
        const expiresAtMs = nowMs + PLAYBACK_COMMAND_TTL_MS;
        await savePlaybackCommand(commandId, {
          account_id: accountId,
          sender_session_id_text: callerSessionIdText,
          target_session_id_text: targetSessionIdText,
          expires_at_ms: expiresAtMs,
        });

        const envelope: DTOPlaybackCommandEnvelope = {
          command_id: commandId,
          sender_session_id_text: callerSessionIdText,
          target_session_id_text: targetSessionIdText,
          issued_at_ms: nowMs,
          expires_at_ms: expiresAtMs,
          command,
          state: transferState === null ? null : toPlaybackStateDto(transferState, nowMs),
        };
        await publishAccountEvents([
          { account_id: accountId, type: 'playback.command', data: envelope },
        ]);

        const response: PlaybackCommandSendResponse = {
          command_id: commandId,
          target_session_id_text: targetSessionIdText,
          expires_at_ms: expiresAtMs,
        };
        res.status(202).json(response);
      }
    );
  }

  /**
   * POST /account/playback/commands/:command_id/start-failed
   *
   * Only the command's target may report, while the command record lives. The record outlives
   * the command so a tap-to-play prompt that fails late can still be reported.
   */
  static async reportStartFailed(req: Request, res: Response): Promise<void> {
    runPlaybackRoute(
      req,
      res,
      { params: playbackSchemas.commandIdParams, body: playbackSchemas.startFailedBody },
      async ({ accountId, device }) => {
        const body: unknown = req.body;
        if (!isPlaybackStartFailedBody(body)) {
          res.status(400).json({ message: 'Invalid start-failed report' });
          return;
        }

        const commandId = getParamRequired(req, 'command_id');
        const record = await readPlaybackCommand(commandId);
        if (
          record === null ||
          record.account_id !== accountId ||
          record.target_session_id_text !== device.session_id_text
        ) {
          res.status(404).json({ message: 'Command not found' });
          return;
        }

        await publishAccountEvents([
          {
            account_id: accountId,
            type: 'playback.start_failed',
            data: {
              command_id: commandId,
              sender_session_id_text: record.sender_session_id_text,
              target_session_id_text: record.target_session_id_text,
              reason: body.reason,
            },
          },
        ]);
        res.status(204).end();
      }
    );
  }
}
