import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  DTOPlaybackCommand,
  DTOPlaybackCommandEnvelope,
  DTOPlaybackState,
  PlaybackStartFailedReason,
} from '@podverse/helpers/accountPlaybackStream';
import { MediumEnum } from '@podverse/helpers/medium';

import type {
  CrossDevicePlaybackCommandRunner,
  CrossDevicePlaybackLocalPort,
  LocalPlaybackStartResult,
} from './crossDevicePlaybackCommandRunner';
import { createCrossDevicePlaybackCommandRunner } from './crossDevicePlaybackCommandRunner';

const THIS_SESSION = 'session-this';
const OTHER_SESSION = 'session-other';
const SENDER_SESSION = 'session-sender';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

const deferred = (): Deferred => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

/** Lets every pending promise callback run. */
const flush = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
};

let nextCommandNumber = 1;

const envelope = (
  command: DTOPlaybackCommand,
  overrides: Partial<DTOPlaybackCommandEnvelope> = {}
): DTOPlaybackCommandEnvelope => {
  const commandNumber = nextCommandNumber;
  nextCommandNumber += 1;
  return {
    command_id: `command-${commandNumber}`,
    sender_session_id_text: SENDER_SESSION,
    target_session_id_text: THIS_SESSION,
    issued_at_ms: 1_000,
    expires_at_ms: 6_000,
    command,
    state: null,
    ...overrides,
  };
};

const sharedState = (overrides: Partial<DTOPlaybackState> = {}): DTOPlaybackState => ({
  revision: 4,
  active_session_id_text: SENDER_SESSION,
  resource: {
    ref: { kind: 'item', item_id_text: 'item-1' },
    medium: MediumEnum.Podcast,
    title: 'Episode',
    channel_title: 'Podcast',
    image_url: null,
  },
  status: 'playing',
  is_live: false,
  position_seconds: 100,
  duration_seconds: 3600,
  rate: 1,
  updated_at_ms: 10_000,
  sent_at_ms: 11_000,
  ...overrides,
});

const runners: CrossDevicePlaybackCommandRunner[] = [];

const createHarness = (portOverrides: Partial<CrossDevicePlaybackLocalPort> = {}) => {
  let nowMs = 50_000;
  let loadedTarget = true;
  let loadedTargetLive = false;
  const reports: { commandIdText: string; reason: PlaybackStartFailedReason }[] = [];

  const port = {
    resume: vi.fn(async (): Promise<void> => {}),
    pause: vi.fn((): void => {}),
    seekTo: vi.fn(async (_seconds: number): Promise<void> => {}),
    setRate: vi.fn((_rate: number): void => {}),
    skipToNext: vi.fn(async (): Promise<void> => {}),
    skipToPrevious: vi.fn(async (): Promise<void> => {}),
    playResource: vi.fn(
      async (
        _params: Parameters<CrossDevicePlaybackLocalPort['playResource']>[0]
      ): Promise<LocalPlaybackStartResult> => 'started'
    ),
    hasLoadedTarget: vi.fn((): boolean => loadedTarget),
    isLoadedTargetLive: vi.fn((): boolean => loadedTargetLive),
    ...portOverrides,
  };

  const runner = createCrossDevicePlaybackCommandRunner({
    port,
    reportStartFailed: async (commandIdText, reason) => {
      reports.push({ commandIdText, reason });
    },
    readThisSessionIdText: () => THIS_SESSION,
    now: () => nowMs,
  });
  runners.push(runner);

  return {
    port,
    reports,
    runner,
    advanceMs: (ms: number): void => {
      nowMs += ms;
    },
    setLoadedTarget: (params: { loaded: boolean; live: boolean }): void => {
      loadedTarget = params.loaded;
      loadedTargetLive = params.live;
    },
  };
};

afterEach(() => {
  for (const runner of runners) {
    runner.dispose();
  }
  runners.length = 0;
  vi.restoreAllMocks();
});

describe('createCrossDevicePlaybackCommandRunner — receiving', () => {
  it('ignores a command addressed to another session', async () => {
    const harness = createHarness();

    harness.runner.receive(envelope({ type: 'pause' }, { target_session_id_text: OTHER_SESSION }));
    await flush();

    expect(harness.port.pause).not.toHaveBeenCalled();
  });

  it('ignores a repeated command id', async () => {
    const harness = createHarness();
    const pause = envelope({ type: 'pause' });

    harness.runner.receive(pause);
    harness.runner.receive(pause);
    await flush();

    expect(harness.port.pause).toHaveBeenCalledTimes(1);
  });
});

describe('createCrossDevicePlaybackCommandRunner — order and staleness', () => {
  it('runs the second command only after the first command’s promise settles', async () => {
    const slowSeek = deferred();
    const harness = createHarness({ seekTo: vi.fn(() => slowSeek.promise) });

    harness.runner.receive(envelope({ type: 'seek', position_seconds: 30 }));
    harness.runner.receive(envelope({ type: 'pause' }));
    await flush();

    expect(harness.port.seekTo).toHaveBeenCalledWith(30);
    expect(harness.port.pause).not.toHaveBeenCalled();

    slowSeek.resolve();
    await flush();

    expect(harness.port.pause).toHaveBeenCalledTimes(1);
  });

  it('drops a command that waited 5001 ms behind a slow one', async () => {
    const slowNext = deferred();
    const harness = createHarness({ skipToNext: vi.fn(() => slowNext.promise) });

    harness.runner.receive(envelope({ type: 'next' }));
    harness.runner.receive(envelope({ type: 'pause' }));
    harness.advanceMs(5_001);
    slowNext.resolve();
    await flush();

    expect(harness.port.pause).not.toHaveBeenCalled();
  });

  it('runs a command that waited exactly 5000 ms behind a slow one', async () => {
    const slowNext = deferred();
    const harness = createHarness({ skipToNext: vi.fn(() => slowNext.promise) });

    harness.runner.receive(envelope({ type: 'next' }));
    harness.runner.receive(envelope({ type: 'pause' }));
    harness.advanceMs(5_000);
    slowNext.resolve();
    await flush();

    expect(harness.port.pause).toHaveBeenCalledTimes(1);
  });
});

describe('createCrossDevicePlaybackCommandRunner — transport commands', () => {
  it('drops seek and set_rate for a live target', async () => {
    const harness = createHarness();
    harness.setLoadedTarget({ loaded: true, live: true });

    harness.runner.receive(envelope({ type: 'seek', position_seconds: 30 }));
    harness.runner.receive(envelope({ type: 'set_rate', rate: 1.5 }));
    await flush();

    expect(harness.port.seekTo).not.toHaveBeenCalled();
    expect(harness.port.setRate).not.toHaveBeenCalled();
  });

  it('clamps a negative seek to 0', async () => {
    const harness = createHarness();

    harness.runner.receive(envelope({ type: 'seek', position_seconds: -4 }));
    await flush();

    expect(harness.port.seekTo).toHaveBeenCalledWith(0);
  });

  it('does nothing for play when no target is loaded', async () => {
    const harness = createHarness();
    harness.setLoadedTarget({ loaded: false, live: false });

    harness.runner.receive(envelope({ type: 'play' }));
    await flush();

    expect(harness.port.resume).not.toHaveBeenCalled();
  });
});

describe('createCrossDevicePlaybackCommandRunner — next and previous', () => {
  it('runs next and previous through the tap handlers for a live target', async () => {
    const harness = createHarness();
    harness.setLoadedTarget({ loaded: true, live: true });

    harness.runner.receive(envelope({ type: 'next' }));
    harness.runner.receive(envelope({ type: 'previous' }));
    await flush();

    expect(harness.port.skipToNext).toHaveBeenCalledTimes(1);
    expect(harness.port.skipToPrevious).toHaveBeenCalledTimes(1);
  });

  it('runs next and previous through the tap handlers when no target is loaded', async () => {
    const harness = createHarness();
    harness.setLoadedTarget({ loaded: false, live: false });

    harness.runner.receive(envelope({ type: 'next' }));
    harness.runner.receive(envelope({ type: 'previous' }));
    await flush();

    expect(harness.port.skipToNext).toHaveBeenCalledTimes(1);
    expect(harness.port.skipToPrevious).toHaveBeenCalledTimes(1);
  });

  it('reports nothing when next throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const harness = createHarness({
      skipToNext: vi.fn(async (): Promise<void> => {
        throw new Error('queue read failed');
      }),
    });

    harness.runner.receive(envelope({ type: 'next' }));
    await flush();

    expect(harness.reports).toEqual([]);
  });
});

describe('createCrossDevicePlaybackCommandRunner — take over', () => {
  it('asks for the position the playing device has reached when the command runs', async () => {
    const slowNext = deferred();
    const harness = createHarness({ skipToNext: vi.fn(() => slowNext.promise) });

    harness.runner.receive(envelope({ type: 'next' }));
    harness.runner.receive(envelope({ type: 'take_over' }, { state: sharedState() }));
    harness.advanceMs(3_000);
    slowNext.resolve();
    await flush();

    expect(harness.port.playResource).toHaveBeenCalledWith({
      ref: { kind: 'item', item_id_text: 'item-1' },
      addByRssResourceData: null,
      startSeconds: 104,
    });
  });

  it('asks for a null start, the live point, when the shared item is live', async () => {
    const harness = createHarness();

    harness.runner.receive(
      envelope(
        { type: 'take_over' },
        {
          state: sharedState({ is_live: true, position_seconds: null, duration_seconds: null }),
        }
      )
    );
    await flush();

    expect(harness.port.playResource).toHaveBeenCalledWith({
      ref: { kind: 'item', item_id_text: 'item-1' },
      addByRssResourceData: null,
      startSeconds: null,
    });
  });

  it('reports load_failed when the take-over carries no state', async () => {
    const harness = createHarness();
    const takeOver = envelope({ type: 'take_over' });

    harness.runner.receive(takeOver);
    await flush();

    expect(harness.port.playResource).not.toHaveBeenCalled();
    expect(harness.reports).toEqual([
      { commandIdText: takeOver.command_id, reason: 'load_failed' },
    ]);
  });
});

describe('createCrossDevicePlaybackCommandRunner — start failures', () => {
  const playItem: DTOPlaybackCommand = {
    type: 'play_item',
    resource: { kind: 'item', item_id_text: 'item-2' },
    add_by_rss_resource_data: null,
    start_seconds: null,
  };

  it('reports load_failed for a failed start and for a start that throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const harness = createHarness({
      playResource: vi
        .fn<CrossDevicePlaybackLocalPort['playResource']>()
        .mockResolvedValueOnce('failed')
        .mockRejectedValueOnce(new Error('item lookup failed')),
    });
    const failed = envelope(playItem);
    const thrown = envelope(playItem);

    harness.runner.receive(failed);
    harness.runner.receive(thrown);
    await flush();

    expect(harness.reports).toEqual([
      { commandIdText: failed.command_id, reason: 'load_failed' },
      { commandIdText: thrown.command_id, reason: 'load_failed' },
    ]);
  });

  it('reports an engine error within 8 s of a started play_item once', async () => {
    const harness = createHarness();
    const started = envelope(playItem);

    harness.runner.receive(started);
    await flush();
    harness.advanceMs(5_000);
    harness.runner.notePlaybackError();
    harness.runner.notePlaybackError();
    await flush();

    expect(harness.reports).toEqual([{ commandIdText: started.command_id, reason: 'load_failed' }]);
  });

  it('does not report an engine error more than 8 s after a started play_item', async () => {
    const harness = createHarness();

    harness.runner.receive(envelope(playItem));
    await flush();
    harness.advanceMs(8_001);
    harness.runner.notePlaybackError();
    await flush();

    expect(harness.reports).toEqual([]);
  });
});
