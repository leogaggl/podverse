import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackCommandSendResponse } from '@podverse/helpers';
import { ACCOUNT_PLAYBACK_STREAM_EVENT, MediumEnum, PLAYBACK_ERROR_CODES } from '@podverse/helpers';

import { crossDevicePlaybackStore } from './crossDevicePlaybackStore';
import { registerPlaybackCheckInHandler } from './playbackCheckInRequest';
import { sendPlaybackCommand } from './sendPlaybackCommand';

const hoisted = vi.hoisted(() => ({
  reqAccountPlaybackSendCommand: vi.fn(() =>
    Promise.resolve({
      command_id: 'cmd-1',
      target_session_id_text: 'session-other',
      expires_at_ms: 5_000,
    })
  ),
}));

vi.mock('../../factories/apiRequestService', () => ({
  getApiRequestService: () => hoisted,
}));

const commandResponse: PlaybackCommandSendResponse = {
  command_id: 'cmd-1',
  target_session_id_text: 'session-other',
  expires_at_ms: 5_000,
};

function seedPlayingState() {
  crossDevicePlaybackStore.reset({ accountId: 1, enabled: true });
  crossDevicePlaybackStore.applyPresenceResponse(
    { session_id_text: 'session-this', devices: { revision: 1, devices: [] }, state: null },
    1_000
  );
  crossDevicePlaybackStore.applyStreamEvent(
    {
      type: ACCOUNT_PLAYBACK_STREAM_EVENT.state,
      data: {
        revision: 1,
        active_session_id_text: 'session-other',
        resource: {
          ref: { kind: 'item', item_id_text: 'item-1' },
          medium: MediumEnum.Podcast,
          title: 'Episode',
          channel_title: 'Show',
          image_url: null,
        },
        status: 'playing',
        is_live: false,
        position_seconds: 40,
        duration_seconds: 100,
        rate: 1,
        updated_at_ms: 0,
        sent_at_ms: 0,
      },
    },
    1_000
  );
}

let unregisterCheckIn = () => {};

describe('sendPlaybackCommand', () => {
  beforeEach(() => {
    hoisted.reqAccountPlaybackSendCommand.mockReset();
    hoisted.reqAccountPlaybackSendCommand.mockResolvedValue(commandResponse);
    crossDevicePlaybackStore.reset({ accountId: null, enabled: false });
  });

  afterEach(() => {
    unregisterCheckIn();
    unregisterCheckIn = () => {};
    crossDevicePlaybackStore.reset({ accountId: null, enabled: false });
  });

  it('patches pause before the command request resolves', async () => {
    seedPlayingState();
    let releaseRequest: (value: PlaybackCommandSendResponse) => void = () => undefined;
    hoisted.reqAccountPlaybackSendCommand.mockReturnValue(
      new Promise((resolve) => {
        releaseRequest = resolve;
      })
    );

    const pending = sendPlaybackCommand({ type: 'pause' });
    const whilePending = crossDevicePlaybackStore.getSnapshot();
    expect(whilePending.state?.status).toBe('playing');
    expect(whilePending.displayState?.status).toBe('paused');
    expect(hoisted.reqAccountPlaybackSendCommand).toHaveBeenCalledWith({
      command: { type: 'pause' },
    });

    releaseRequest(commandResponse);
    await pending;
    expect(crossDevicePlaybackStore.getSnapshot().displayState?.status).toBe('paused');
  });

  it.each([PLAYBACK_ERROR_CODES.noActiveDevice, PLAYBACK_ERROR_CODES.deviceNotConnected])(
    '%s clears the patch and checks in',
    async (code) => {
      seedPlayingState();
      const checkIn = vi.fn();
      unregisterCheckIn = registerPlaybackCheckInHandler(checkIn);
      hoisted.reqAccountPlaybackSendCommand.mockRejectedValue({
        response: { status: 409, data: { code } },
      });

      await sendPlaybackCommand({ type: 'pause' });

      const snapshot = crossDevicePlaybackStore.getSnapshot();
      expect(snapshot.displayState?.status).toBe('playing');
      expect(snapshot.displayState).toBe(snapshot.state);
      expect(checkIn).toHaveBeenCalledTimes(1);
    }
  );

  it('marks playback unavailable on a membership 403 and clears the patch', async () => {
    seedPlayingState();
    const checkIn = vi.fn();
    unregisterCheckIn = registerPlaybackCheckInHandler(checkIn);
    hoisted.reqAccountPlaybackSendCommand.mockRejectedValue({
      response: {
        status: 403,
        data: { code: 'membership_expired', i18nKey: 'membership.membership_expired' },
      },
    });

    await sendPlaybackCommand({ type: 'pause' });

    const snapshot = crossDevicePlaybackStore.getSnapshot();
    expect(snapshot.availability).toBe('unavailable');
    expect(snapshot.displayState?.status).toBe('playing');
    expect(checkIn).not.toHaveBeenCalled();
  });

  it('sends next and previous with no target session and no optimistic patch', async () => {
    seedPlayingState();

    await sendPlaybackCommand({ type: 'next' });
    expect(hoisted.reqAccountPlaybackSendCommand).toHaveBeenCalledWith({
      command: { type: 'next' },
    });
    let snapshot = crossDevicePlaybackStore.getSnapshot();
    expect(snapshot.displayState).toBe(snapshot.state);

    hoisted.reqAccountPlaybackSendCommand.mockClear();
    await sendPlaybackCommand({ type: 'previous' });
    expect(hoisted.reqAccountPlaybackSendCommand).toHaveBeenCalledWith({
      command: { type: 'previous' },
    });
    snapshot = crossDevicePlaybackStore.getSnapshot();
    expect(snapshot.displayState).toBe(snapshot.state);
  });
});
