import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DTOPlaybackState,
  PlaybackPresenceResponse,
  PlaybackStatePublishBody,
  PlaybackStatePublishResponse,
} from '@podverse/helpers/accountPlaybackStream';
import {
  PLAYBACK_ERROR_CODES,
  PLAYBACK_STATE_MIN_PUBLISH_GAP_MS,
} from '@podverse/helpers/accountPlaybackStream';
import type { DTOChannel, DTOItem } from '@podverse/helpers/dto';
import { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackApiError } from '@podverse/helpers-requests';
import type { PlaybackTarget } from '@podverse/playback-core';

import type { LocalPlaybackPublishSnapshot } from './crossDevicePlaybackPolicy';
import type {
  CrossDevicePlaybackPublisher,
  LocalPlaybackChangeKind,
} from './crossDevicePlaybackPublisher';
import { createCrossDevicePlaybackPublisher } from './crossDevicePlaybackPublisher';
import {
  applyCrossDevicePlaybackPresence,
  getCrossDevicePlaybackView,
  recordCrossDevicePlaybackPublish,
  resetCrossDevicePlaybackStore,
} from './crossDevicePlaybackStore';

const THIS_SESSION = 'session-this';
const OTHER_SESSION = 'session-other';

// Partial DTO fixtures: the publish body reads ids and the channel medium only.
const channel = { id_text: 'channel-1', medium_id: MediumEnum.Podcast } as DTOChannel;
const item = { id_text: 'item-1' } as DTOItem;
const episodeTarget: PlaybackTarget = { kind: 'item-podcast', item, channel };

const localSnapshot = (
  overrides: Partial<LocalPlaybackPublishSnapshot> = {}
): LocalPlaybackPublishSnapshot => ({
  target: episodeTarget,
  title: 'Episode',
  channelTitle: 'Podcast',
  imageUrl: null,
  isPlaying: false,
  transportState: 'paused',
  positionSeconds: 30,
  durationSeconds: 600,
  rate: 1,
  ...overrides,
});

const sharedState = (activeSessionIdText: string): DTOPlaybackState => ({
  revision: 5,
  active_session_id_text: activeSessionIdText,
  resource: {
    ref: { kind: 'item', item_id_text: 'item-1' },
    medium: MediumEnum.Podcast,
    title: 'Episode',
    channel_title: 'Podcast',
    image_url: null,
  },
  status: 'playing',
  is_live: false,
  position_seconds: 30,
  duration_seconds: 600,
  rate: 1,
  updated_at_ms: 5_000,
  sent_at_ms: 5_000,
});

const presence = (state: DTOPlaybackState | null): PlaybackPresenceResponse => ({
  session_id_text: THIS_SESSION,
  devices: { revision: 1, devices: [] },
  state,
});

const becomeActive = (): void => {
  applyCrossDevicePlaybackPresence(presence(sharedState(THIS_SESSION)), Date.now());
};

const becomeRemote = (): void => {
  applyCrossDevicePlaybackPresence(presence(sharedState(OTHER_SESSION)), Date.now());
};

const role = () => getCrossDevicePlaybackView().role;

class MembershipRefusalError extends Error {}

class PlaybackRequestError extends Error {
  readonly playbackError: PlaybackApiError;

  constructor(playbackError: PlaybackApiError) {
    super(playbackError.code);
    this.playbackError = playbackError;
  }
}

const notActiveDevice = (activeSessionIdText: string | null): PlaybackRequestError =>
  new PlaybackRequestError({ code: PLAYBACK_ERROR_CODES.notActiveDevice, activeSessionIdText });

/** Lets the timer queue and every pending promise callback run. */
const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

type PendingPublish = {
  resolve: (response: PlaybackStatePublishResponse) => void;
  reject: (error: unknown) => void;
};

const publishers: CrossDevicePlaybackPublisher[] = [];

const createHarness = (initial: Partial<LocalPlaybackPublishSnapshot> = {}) => {
  let local = localSnapshot(initial);
  let running = true;
  let appActive = true;
  let nextRevision = 10;
  const bodies: PlaybackStatePublishBody[] = [];
  const pending: PendingPublish[] = [];
  const onPublished = vi.fn((response: PlaybackStatePublishResponse) => {
    recordCrossDevicePlaybackPublish(response);
  });
  const onSuperseded = vi.fn();
  const onMembershipRefusal = vi.fn(() => {
    // The presence latch stops the feature on a membership refusal.
    running = false;
  });
  const onSettled = vi.fn();

  const publisher = createCrossDevicePlaybackPublisher({
    publish: (body) => {
      bodies.push(body);
      return new Promise<PlaybackStatePublishResponse>((resolve, reject) => {
        pending.push({ resolve, reject });
      });
    },
    readLocal: () => local,
    isRunning: () => running,
    isAppActive: () => appActive,
    now: () => Date.now(),
    onPublished,
    onSuperseded,
    onMembershipRefusal,
    onSettled,
    isMembershipRefusal: (error) => error instanceof MembershipRefusalError,
    parsePlaybackError: (error) =>
      error instanceof PlaybackRequestError ? error.playbackError : null,
  });
  publishers.push(publisher);

  const takeOldestPublish = (): PendingPublish => {
    const next = pending.shift();
    if (next === undefined) {
      throw new Error('no publish is waiting');
    }
    return next;
  };

  const change = (
    kind: LocalPlaybackChangeKind,
    overrides: Partial<LocalPlaybackPublishSnapshot> = {}
  ): void => {
    const wasPlayingLocally = local.isPlaying;
    local = { ...local, ...overrides };
    publisher.noteLocalChange({ kind, wasPlayingLocally });
  };

  return {
    bodies,
    publisher,
    onPublished,
    onSuperseded,
    onMembershipRefusal,
    onSettled,
    pendingCount: (): number => pending.length,
    lastBody: (): PlaybackStatePublishBody => {
      const body = bodies[bodies.length - 1];
      if (body === undefined) {
        throw new Error('nothing was published');
      }
      return body;
    },
    setRunning: (next: boolean): void => {
      running = next;
    },
    setAppActive: (next: boolean): void => {
      appActive = next;
    },
    change,
    play: (): void => {
      change('playing', { isPlaying: true, transportState: 'playing' });
    },
    pause: (): void => {
      change('playing', { isPlaying: false, transportState: 'paused' });
    },
    heartbeat: (): void => {
      publisher.noteHeartbeat();
    },
    respond: async (activeSessionIdText: string | null = THIS_SESSION): Promise<void> => {
      takeOldestPublish().resolve({
        revision: nextRevision,
        active_session_id_text: activeSessionIdText,
      });
      nextRevision += 1;
      await flush();
    },
    fail: async (error: unknown): Promise<void> => {
      takeOldestPublish().reject(error);
      await flush();
    },
  };
};

describe('createCrossDevicePlaybackPublisher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    resetCrossDevicePlaybackStore();
    applyCrossDevicePlaybackPresence(presence(null), Date.now());
  });

  afterEach(() => {
    for (const publisher of publishers.splice(0)) {
      publisher.dispose();
    }
    resetCrossDevicePlaybackStore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('claims when local audio starts and publishes a pause as the active device', async () => {
    const h = createHarness();

    h.play();
    expect(h.bodies).toHaveLength(1);
    expect(h.lastBody()).toMatchObject({ claim: true, status: 'playing' });

    await h.respond();
    expect(role()).toBe('active');

    await vi.advanceTimersByTimeAsync(PLAYBACK_STATE_MIN_PUBLISH_GAP_MS);
    h.pause();
    expect(h.bodies).toHaveLength(2);
    expect(h.lastBody()).toMatchObject({ claim: false, status: 'paused' });
  });

  it('sends once more when a request settles after a change, with the newest local state', async () => {
    const h = createHarness();

    h.play();
    h.change('seek', { positionSeconds: 100 });
    h.change('seek', { positionSeconds: 200 });
    expect(h.bodies).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(PLAYBACK_STATE_MIN_PUBLISH_GAP_MS);
    await h.respond();
    expect(h.bodies).toHaveLength(2);
    expect(h.lastBody()).toMatchObject({ claim: false, position_seconds: 200 });
  });

  it('keeps foreground publishes apart by the minimum gap', async () => {
    becomeActive();
    const h = createHarness({ isPlaying: true, transportState: 'playing' });

    h.change('seek', { positionSeconds: 10 });
    await h.respond();
    await vi.advanceTimersByTimeAsync(100);
    h.change('seek', { positionSeconds: 20 });
    expect(h.bodies).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(PLAYBACK_STATE_MIN_PUBLISH_GAP_MS - 101);
    expect(h.bodies).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(h.bodies).toHaveLength(2);
    expect(h.lastBody().position_seconds).toBe(20);
  });

  it('skips the gap in the background and sends the next change when the request settles', async () => {
    becomeActive();
    const h = createHarness({ isPlaying: true, transportState: 'playing' });
    h.setAppActive(false);

    h.change('seek', { positionSeconds: 10 });
    await vi.advanceTimersByTimeAsync(100);
    h.change('seek', { positionSeconds: 20 });
    expect(h.bodies).toHaveLength(1);

    await h.respond();
    expect(h.bodies).toHaveLength(2);
    expect(h.lastBody().position_seconds).toBe(20);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sends a foreground trailing publish on the next heartbeat once the app is in the background', async () => {
    becomeActive();
    const h = createHarness({ isPlaying: true, transportState: 'playing' });

    h.change('seek', { positionSeconds: 10 });
    await h.respond();
    await vi.advanceTimersByTimeAsync(100);
    h.pause();
    expect(h.bodies).toHaveLength(1);

    h.setAppActive(false);
    h.heartbeat();
    expect(h.bodies).toHaveLength(2);
    expect(h.lastBody()).toMatchObject({ claim: false, status: 'paused' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('publishes on heartbeats every 10 seconds while playing as the active device', async () => {
    becomeActive();
    const h = createHarness({ isPlaying: true, transportState: 'playing' });

    h.change('seek', { positionSeconds: 40 });
    await h.respond();
    for (let second = 1; second <= 25; second += 1) {
      await vi.advanceTimersByTimeAsync(1_000);
      h.heartbeat();
      if (h.pendingCount() > 0) {
        await h.respond();
      }
    }

    expect(h.bodies).toHaveLength(3);
    expect(h.lastBody()).toMatchObject({ claim: false, status: 'playing' });
  });

  it('sends nothing while the feature is not running', async () => {
    const h = createHarness();
    h.setRunning(false);

    h.play();
    h.change('seek', { positionSeconds: 90 });
    await vi.advanceTimersByTimeAsync(20_000);
    h.heartbeat();

    expect(h.bodies).toHaveLength(0);
  });

  it('sends nothing for paused audio while idle or remote', async () => {
    const h = createHarness();

    h.change('seek', { positionSeconds: 90 });
    h.change('rate', { rate: 2 });
    h.heartbeat();
    expect(role()).toBe('idle');
    expect(h.bodies).toHaveLength(0);

    becomeRemote();
    h.change('seek', { positionSeconds: 120 });
    h.change('rate', { rate: 1.5 });
    await vi.advanceTimersByTimeAsync(20_000);
    h.heartbeat();
    expect(role()).toBe('remote');
    expect(h.bodies).toHaveLength(0);
  });

  it('retries a failed claim on a heartbeat after 2 seconds, until audio pauses', async () => {
    const h = createHarness();

    h.play();
    await h.fail(new Error('network'));
    h.heartbeat();
    expect(h.bodies).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1_999);
    h.heartbeat();
    expect(h.bodies).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    h.heartbeat();
    expect(h.bodies).toHaveLength(2);
    expect(h.lastBody()).toMatchObject({ claim: true, status: 'playing' });

    await h.fail(new Error('network'));
    h.pause();
    await vi.advanceTimersByTimeAsync(5_000);
    h.heartbeat();
    expect(h.bodies).toHaveLength(2);
  });

  it('reports another active device on a 409 and drops the owed claim', async () => {
    const h = createHarness();

    h.play();
    await h.fail(notActiveDevice(OTHER_SESSION));
    expect(h.onSuperseded).toHaveBeenCalledWith(OTHER_SESSION);

    await vi.advanceTimersByTimeAsync(5_000);
    h.heartbeat();
    expect(h.bodies).toHaveLength(1);
  });

  it('claims again after a 409 with no active device while audio plays', async () => {
    becomeActive();
    const h = createHarness({ isPlaying: true, transportState: 'playing' });

    h.change('seek', { positionSeconds: 60 });
    expect(h.lastBody().claim).toBe(false);
    await h.fail(notActiveDevice(null));
    await vi.advanceTimersByTimeAsync(PLAYBACK_STATE_MIN_PUBLISH_GAP_MS);

    expect(h.onSuperseded).not.toHaveBeenCalled();
    expect(h.bodies).toHaveLength(2);
    expect(h.lastBody()).toMatchObject({ claim: true, status: 'playing' });
  });

  it('sends nothing after a 409 with no active device while audio is paused', async () => {
    becomeActive();
    const h = createHarness();

    h.change('seek', { positionSeconds: 60 });
    await h.fail(notActiveDevice(null));
    await vi.advanceTimersByTimeAsync(PLAYBACK_STATE_MIN_PUBLISH_GAP_MS);
    h.heartbeat();

    expect(h.bodies).toHaveLength(1);
  });

  it('reports a membership refusal and sends nothing more', async () => {
    const h = createHarness();

    h.play();
    h.change('seek', { positionSeconds: 60 });
    await h.fail(new MembershipRefusalError('membership required'));
    expect(h.onMembershipRefusal).toHaveBeenCalledTimes(1);

    h.change('rate', { rate: 2 });
    await vi.advanceTimersByTimeAsync(20_000);
    h.heartbeat();
    expect(h.bodies).toHaveLength(1);
  });

  it('marks only a pending claiming request as a claim in flight and settles every request', async () => {
    const h = createHarness();
    expect(h.publisher.isClaimInFlight()).toBe(false);

    h.play();
    expect(h.publisher.isClaimInFlight()).toBe(true);
    await h.respond();
    expect(h.publisher.isClaimInFlight()).toBe(false);
    expect(h.onSettled).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(PLAYBACK_STATE_MIN_PUBLISH_GAP_MS);
    h.change('seek', { positionSeconds: 60 });
    expect(h.pendingCount()).toBe(1);
    expect(h.publisher.isClaimInFlight()).toBe(false);
    await h.fail(new Error('network'));
    expect(h.onSettled).toHaveBeenCalledTimes(2);
  });

  it('publishes a cleared player as the active device with no resource', () => {
    becomeActive();
    const h = createHarness({ isPlaying: true, transportState: 'playing' });

    h.change('playing', { target: null, isPlaying: false, transportState: 'paused' });

    expect(h.bodies).toHaveLength(1);
    expect(h.lastBody()).toMatchObject({ claim: false, resource: null });
  });

  it('drops a response that lands after the feature stops running', async () => {
    const h = createHarness();

    h.play();
    h.setRunning(false);
    await h.respond();

    expect(h.onPublished).not.toHaveBeenCalled();
    expect(h.onSettled).toHaveBeenCalledTimes(1);
    expect(role()).toBe('idle');
  });
});
