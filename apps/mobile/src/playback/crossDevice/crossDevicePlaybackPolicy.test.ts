import { describe, expect, it } from 'vitest';

import type {
  DTOPlaybackResourceRef,
  DTOPlaybackState,
} from '@podverse/helpers/accountPlaybackStream';
import {
  isDTOPlaybackResourceSummary,
  PLAYBACK_IMAGE_URL_MAX_LENGTH,
  PLAYBACK_TEXT_FIELD_MAX_LENGTH,
} from '@podverse/helpers/accountPlaybackStream';
import type { PlaybackRole } from '@podverse/helpers/crossDevicePlayback';
import type {
  DTOChannel,
  DTOClip,
  DTOItem,
  DTOItemChapter,
  DTOItemSoundbite,
} from '@podverse/helpers/dto';
import { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

import type {
  PlaybackReconcileDifferentNowPlayingConflict,
  PlaybackReconcileResourceState,
} from '../../data/repositories/playbackReconcile';
import { addByRssPlaybackMediaId } from '../../lib/addByRss/resourceData';
import { shouldPromptForPlaybackHandoffConflict } from '../playbackHandoff';
import type {
  LocalPlaybackPublishSnapshot,
  PlaybackHandoffGate,
} from './crossDevicePlaybackPolicy';
import {
  buildPlaybackStatePublishBody,
  createSeenPlaybackCommandIds,
  isLivePlaybackTarget,
  isPlaybackCommandStale,
  isSamePlaybackResourceRef,
  playbackMediumFromTarget,
  playbackResourceRefFromTarget,
  resolvePlaybackHandoffGate,
  resolvePlaybackIdleAdoption,
  resolvePlaybackPublishClaim,
  resolvePlaybackSupersedeAction,
  resolvePlaybackTakeOverStart,
  resolveRemoteJumpSeekSeconds,
  shouldPublishPlaybackChange,
} from './crossDevicePlaybackPolicy';
import type { CrossDevicePlaybackAvailability } from './crossDevicePlaybackStore';

const THIS_SESSION = 'session-this';
const OTHER_SESSION = 'session-other';
const NOW_MS = 1_000_000;
const FEED_URL = 'https://example.com/feed.xml';

// Partial DTO fixtures: the policy reads ids and the channel medium only.
const channel = { id_text: 'channel-1', medium_id: MediumEnum.Music } as DTOChannel;
const item = { id_text: 'item-1' } as DTOItem;
const clip = { id_text: 'clip-1' } as DTOClip;
const soundbite = { id_text: 'soundbite-1' } as DTOItemSoundbite;
const chapter = { id_text: 'chapter-1' } as DTOItemChapter;

const episodeTarget: PlaybackTarget = { kind: 'item-podcast', item, channel };

const addByRssTarget = (resourceData: Record<string, unknown> = {}): PlaybackTarget => ({
  kind: 'add-by-rss',
  resourceData: {
    feed_url: FEED_URL,
    guid: 'episode-guid-1',
    title: 'Add by RSS Episode',
    ...resourceData,
  },
});

const addByRssHashId = addByRssPlaybackMediaId({ feed_url: FEED_URL, guid: 'episode-guid-1' });

const publishSnapshot = (
  overrides: Partial<LocalPlaybackPublishSnapshot> = {}
): LocalPlaybackPublishSnapshot => ({
  target: episodeTarget,
  title: 'Episode',
  channelTitle: 'Podcast',
  imageUrl: 'https://example.com/art.jpg',
  isPlaying: true,
  transportState: 'playing',
  positionSeconds: 42.5,
  durationSeconds: 600,
  rate: 1.5,
  ...overrides,
});

const playbackState = (overrides: Partial<DTOPlaybackState> = {}): DTOPlaybackState => ({
  revision: 10,
  active_session_id_text: OTHER_SESSION,
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
  duration_seconds: 600,
  rate: 1,
  updated_at_ms: 5_000,
  sent_at_ms: 5_000,
  ...overrides,
});

const liveState = (): DTOPlaybackState =>
  playbackState({ is_live: true, position_seconds: null, duration_seconds: null });

describe('playbackResourceRefFromTarget', () => {
  it('maps database targets to their clip, soundbite, or item ref', () => {
    expect(playbackResourceRefFromTarget({ kind: 'clip', clip, item, channel })).toEqual({
      kind: 'clip',
      clip_id_text: 'clip-1',
    });
    expect(playbackResourceRefFromTarget({ kind: 'soundbite', soundbite, item, channel })).toEqual({
      kind: 'soundbite',
      item_soundbite_id_text: 'soundbite-1',
    });
    expect(playbackResourceRefFromTarget(episodeTarget)).toEqual({
      kind: 'item',
      item_id_text: 'item-1',
    });
    expect(playbackResourceRefFromTarget({ kind: 'item-video', item, channel })).toEqual({
      kind: 'item',
      item_id_text: 'item-1',
    });
    expect(
      playbackResourceRefFromTarget({ kind: 'item-music', item, channel, intent: 'explicit_play' })
    ).toEqual({ kind: 'item', item_id_text: 'item-1' });
  });

  it('shares a chapter as its item', () => {
    expect(playbackResourceRefFromTarget({ kind: 'chapter', chapter, item, channel })).toEqual({
      kind: 'item',
      item_id_text: 'item-1',
    });
  });

  it('shares a livestream as its item, and nothing when it has no item', () => {
    expect(playbackResourceRefFromTarget({ kind: 'livestream', item, channel })).toEqual({
      kind: 'item',
      item_id_text: 'item-1',
    });
    expect(playbackResourceRefFromTarget({ kind: 'livestream', item: null, channel })).toBe(null);
  });

  it('shares Add by RSS episodes and livestreams by their hash id', () => {
    expect(playbackResourceRefFromTarget(addByRssTarget())).toEqual({
      kind: 'add_by_rss',
      add_by_rss_hash_id: addByRssHashId,
    });

    const liveTarget = addByRssTarget({ liveItem: { status: 'live' } });
    expect(playbackResourceRefFromTarget(liveTarget)).toEqual({
      kind: 'add_by_rss',
      add_by_rss_hash_id: addByRssHashId,
    });
    expect(isLivePlaybackTarget(liveTarget)).toBe(true);
  });
});

describe('playbackMediumFromTarget', () => {
  it('reads the medium from the channel of a database target', () => {
    expect(
      playbackMediumFromTarget({ kind: 'item-music', item, channel, intent: 'explicit_play' })
    ).toBe(MediumEnum.Music);
    expect(playbackMediumFromTarget({ kind: 'clip', clip, item, channel })).toBe(MediumEnum.Music);
    expect(playbackMediumFromTarget({ kind: 'chapter', chapter, item, channel })).toBe(
      MediumEnum.Music
    );
    expect(playbackMediumFromTarget({ kind: 'livestream', item: null, channel })).toBe(
      MediumEnum.Music
    );
  });

  it('reads an Add by RSS medium from its resource data and falls back to Podcast', () => {
    expect(playbackMediumFromTarget(addByRssTarget({ medium_id: MediumEnum.Music }))).toBe(
      MediumEnum.Music
    );
    expect(
      playbackMediumFromTarget(
        addByRssTarget({ livestream_item: { title: 'Live' }, medium_id: null })
      )
    ).toBe(MediumEnum.Podcast);
    expect(
      playbackMediumFromTarget(
        addByRssTarget({ livestream_item: { title: 'Live' }, medium_id: 999 })
      )
    ).toBe(MediumEnum.Podcast);
  });
});

describe('isLivePlaybackTarget', () => {
  it('is true for livestreams and Add by RSS livestreams only', () => {
    expect(isLivePlaybackTarget({ kind: 'livestream', item: null, channel })).toBe(true);
    expect(isLivePlaybackTarget(addByRssTarget({ livestream_item: { title: 'Live' } }))).toBe(true);
    expect(isLivePlaybackTarget(addByRssTarget())).toBe(false);
    expect(isLivePlaybackTarget(episodeTarget)).toBe(false);
  });
});

describe('isSamePlaybackResourceRef', () => {
  it('matches on kind and id', () => {
    expect(
      isSamePlaybackResourceRef(
        { kind: 'item', item_id_text: 'item-1' },
        { kind: 'item', item_id_text: 'item-1' }
      )
    ).toBe(true);
    expect(
      isSamePlaybackResourceRef(
        { kind: 'item', item_id_text: 'item-1' },
        { kind: 'item', item_id_text: 'item-2' }
      )
    ).toBe(false);
    expect(
      isSamePlaybackResourceRef(
        { kind: 'item', item_id_text: 'shared-id' },
        { kind: 'clip', clip_id_text: 'shared-id' }
      )
    ).toBe(false);
  });
});

describe('buildPlaybackStatePublishBody', () => {
  it('publishes a playing item with its position, duration, rate, and medium', () => {
    const body = buildPlaybackStatePublishBody(publishSnapshot(), true);

    expect(body).toEqual({
      claim: true,
      resource: {
        ref: { kind: 'item', item_id_text: 'item-1' },
        medium: MediumEnum.Music,
        title: 'Episode',
        channel_title: 'Podcast',
        image_url: 'https://example.com/art.jpg',
      },
      status: 'playing',
      is_live: false,
      position_seconds: 42.5,
      duration_seconds: 600,
      rate: 1.5,
    });
    expect(isDTOPlaybackResourceSummary(body.resource)).toBe(true);
  });

  it('publishes an Add by RSS episode with the medium from its resource data', () => {
    const body = buildPlaybackStatePublishBody(
      publishSnapshot({ target: addByRssTarget({ medium_id: MediumEnum.Music }) }),
      false
    );

    expect(body.resource).toEqual({
      ref: { kind: 'add_by_rss', add_by_rss_hash_id: addByRssHashId },
      medium: MediumEnum.Music,
      title: 'Episode',
      channel_title: 'Podcast',
      image_url: 'https://example.com/art.jpg',
    });
    expect(isDTOPlaybackResourceSummary(body.resource)).toBe(true);
  });

  it('publishes paused, loading, and error as the shared status', () => {
    expect(
      buildPlaybackStatePublishBody(
        publishSnapshot({ isPlaying: false, transportState: 'paused' }),
        false
      ).status
    ).toBe('paused');
    expect(
      buildPlaybackStatePublishBody(publishSnapshot({ transportState: 'loading' }), false).status
    ).toBe('loading');
    expect(
      buildPlaybackStatePublishBody(
        publishSnapshot({ isPlaying: false, transportState: 'error' }),
        false
      ).status
    ).toBe('paused');
    expect(
      buildPlaybackStatePublishBody(publishSnapshot({ transportState: 'error' }), false).status
    ).toBe('paused');
  });

  it('publishes a live item with no position or duration at rate 1', () => {
    const body = buildPlaybackStatePublishBody(
      publishSnapshot({ target: { kind: 'livestream', item, channel }, rate: 2 }),
      true
    );

    expect(body).toMatchObject({
      is_live: true,
      position_seconds: null,
      duration_seconds: null,
      rate: 1,
      status: 'playing',
    });
    expect(body.resource?.ref).toEqual({ kind: 'item', item_id_text: 'item-1' });
  });

  it('clamps the rate, floors the position at 0, and nulls an unknown duration', () => {
    expect(buildPlaybackStatePublishBody(publishSnapshot({ rate: 0.25 }), false).rate).toBe(0.5);
    expect(buildPlaybackStatePublishBody(publishSnapshot({ rate: 4 }), false).rate).toBe(3);

    const body = buildPlaybackStatePublishBody(
      publishSnapshot({ positionSeconds: -3, durationSeconds: 0 }),
      false
    );
    expect(body.position_seconds).toBe(0);
    expect(body.duration_seconds).toBe(null);
  });

  it('publishes the null-resource body when nothing can be shared', () => {
    const nullResourceBody = {
      claim: true,
      resource: null,
      status: 'paused',
      is_live: false,
      position_seconds: null,
      duration_seconds: null,
      rate: 1,
    };

    expect(buildPlaybackStatePublishBody(publishSnapshot({ target: null }), true)).toEqual(
      nullResourceBody
    );
    expect(
      buildPlaybackStatePublishBody(
        publishSnapshot({ target: { kind: 'livestream', item: null, channel } }),
        true
      )
    ).toEqual(nullResourceBody);
  });

  it('trims and cuts long text, and drops an image URL past the limit', () => {
    const body = buildPlaybackStatePublishBody(
      publishSnapshot({
        title: `  ${'t'.repeat(PLAYBACK_TEXT_FIELD_MAX_LENGTH + 20)}  `,
        channelTitle: '   ',
        imageUrl: `https://example.com/${'i'.repeat(PLAYBACK_IMAGE_URL_MAX_LENGTH)}`,
      }),
      false
    );

    expect(body.resource?.title).toBe('t'.repeat(PLAYBACK_TEXT_FIELD_MAX_LENGTH));
    expect(body.resource?.channel_title).toBe(null);
    expect(body.resource?.image_url).toBe(null);
    expect(isDTOPlaybackResourceSummary(body.resource)).toBe(true);
  });
});

describe('resolvePlaybackPublishClaim', () => {
  const roles: PlaybackRole[] = ['active', 'remote', 'idle'];

  it('claims when local audio just started, whatever the role', () => {
    for (const role of roles) {
      expect(
        resolvePlaybackPublishClaim({ role, wasPlayingLocally: false, isPlayingLocally: true })
      ).toBe(true);
    }
  });

  it('claims while playing only when this device is not the active one', () => {
    expect(
      resolvePlaybackPublishClaim({
        role: 'active',
        wasPlayingLocally: true,
        isPlayingLocally: true,
      })
    ).toBe(false);
    expect(
      resolvePlaybackPublishClaim({
        role: 'remote',
        wasPlayingLocally: true,
        isPlayingLocally: true,
      })
    ).toBe(true);
    expect(
      resolvePlaybackPublishClaim({ role: 'idle', wasPlayingLocally: true, isPlayingLocally: true })
    ).toBe(true);
  });

  it('never claims while paused', () => {
    for (const role of roles) {
      for (const wasPlayingLocally of [false, true]) {
        expect(
          resolvePlaybackPublishClaim({ role, wasPlayingLocally, isPlayingLocally: false })
        ).toBe(false);
      }
    }
  });
});

describe('shouldPublishPlaybackChange', () => {
  it('always publishes a claim and publishes other changes only as the active device', () => {
    expect(shouldPublishPlaybackChange({ role: 'remote', claim: true })).toBe(true);
    expect(shouldPublishPlaybackChange({ role: 'idle', claim: true })).toBe(true);
    expect(shouldPublishPlaybackChange({ role: 'active', claim: false })).toBe(true);
    expect(shouldPublishPlaybackChange({ role: 'remote', claim: false })).toBe(false);
    expect(shouldPublishPlaybackChange({ role: 'idle', claim: false })).toBe(false);
  });
});

describe('resolvePlaybackSupersedeAction', () => {
  const playingElsewhere = {
    thisSessionIdText: THIS_SESSION,
    activeSessionIdText: OTHER_SESSION,
    isPlayingLocally: true,
    claimInFlight: false,
  };

  it('does nothing when nobody is active, this device is active, it is unknown, or paused', () => {
    expect(resolvePlaybackSupersedeAction({ ...playingElsewhere, activeSessionIdText: null })).toBe(
      'none'
    );
    expect(
      resolvePlaybackSupersedeAction({ ...playingElsewhere, activeSessionIdText: THIS_SESSION })
    ).toBe('none');
    expect(resolvePlaybackSupersedeAction({ ...playingElsewhere, thisSessionIdText: null })).toBe(
      'none'
    );
    expect(resolvePlaybackSupersedeAction({ ...playingElsewhere, isPlayingLocally: false })).toBe(
      'none'
    );
  });

  it('defers while a claim is in flight and stops otherwise', () => {
    expect(resolvePlaybackSupersedeAction({ ...playingElsewhere, claimInFlight: true })).toBe(
      'defer'
    );
    expect(resolvePlaybackSupersedeAction(playingElsewhere)).toBe('stop');
  });
});

describe('createSeenPlaybackCommandIds', () => {
  it('drops the oldest id past the limit', () => {
    const seen = createSeenPlaybackCommandIds(2);
    seen.add('command-1');
    seen.add('command-2');
    seen.add('command-1');
    expect(seen.has('command-1')).toBe(true);

    seen.add('command-3');
    expect(seen.has('command-1')).toBe(false);
    expect(seen.has('command-2')).toBe(true);
    expect(seen.has('command-3')).toBe(true);
  });
});

describe('isPlaybackCommandStale', () => {
  it('is fresh through the command window and stale after it', () => {
    expect(isPlaybackCommandStale({ receivedAtMs: NOW_MS, nowMs: NOW_MS + 5_000 })).toBe(false);
    expect(isPlaybackCommandStale({ receivedAtMs: NOW_MS, nowMs: NOW_MS + 5_001 })).toBe(true);
  });
});

describe('resolvePlaybackTakeOverStart', () => {
  it('resumes at the estimated position of a playing state', () => {
    expect(
      resolvePlaybackTakeOverStart({
        state: playbackState({ position_seconds: 100, updated_at_ms: 5_000, sent_at_ms: 6_000 }),
        receivedAtMs: NOW_MS,
        nowMs: NOW_MS + 3_000,
      })
    ).toEqual({
      ref: { kind: 'item', item_id_text: 'item-1' },
      startSeconds: 104,
      isLive: false,
    });
  });

  it('starts a live item at the live point', () => {
    expect(
      resolvePlaybackTakeOverStart({ state: liveState(), receivedAtMs: NOW_MS, nowMs: NOW_MS })
    ).toEqual({
      ref: { kind: 'item', item_id_text: 'item-1' },
      startSeconds: null,
      isLive: true,
    });
  });

  it('has nothing to resume when no resource is shared', () => {
    expect(
      resolvePlaybackTakeOverStart({
        state: playbackState({ resource: null, status: 'paused', position_seconds: null }),
        receivedAtMs: NOW_MS,
        nowMs: NOW_MS,
      })
    ).toBe(null);
  });
});

describe('resolveRemoteJumpSeekSeconds', () => {
  it('seeks from the estimate and clamps at 0 and at the duration', () => {
    const state = playbackState({ status: 'paused', position_seconds: 10, duration_seconds: 60 });

    expect(
      resolveRemoteJumpSeekSeconds({ state, receivedAtMs: NOW_MS, nowMs: NOW_MS, deltaSeconds: 30 })
    ).toBe(40);
    expect(
      resolveRemoteJumpSeekSeconds({
        state,
        receivedAtMs: NOW_MS,
        nowMs: NOW_MS,
        deltaSeconds: -15,
      })
    ).toBe(0);
    expect(
      resolveRemoteJumpSeekSeconds({ state, receivedAtMs: NOW_MS, nowMs: NOW_MS, deltaSeconds: 90 })
    ).toBe(60);
    expect(
      resolveRemoteJumpSeekSeconds({
        state: playbackState({ status: 'paused', position_seconds: 10, duration_seconds: null }),
        receivedAtMs: NOW_MS,
        nowMs: NOW_MS,
        deltaSeconds: 90,
      })
    ).toBe(100);
  });

  it('does not seek a live item', () => {
    expect(
      resolveRemoteJumpSeekSeconds({
        state: liveState(),
        receivedAtMs: NOW_MS,
        nowMs: NOW_MS,
        deltaSeconds: 30,
      })
    ).toBe(null);
  });
});

describe('resolvePlaybackHandoffGate', () => {
  const availabilities: CrossDevicePlaybackAvailability[] = [
    'off',
    'pending',
    'ready',
    'unavailable',
  ];
  const roles: PlaybackRole[] = ['active', 'remote', 'idle'];
  const expected: Record<
    CrossDevicePlaybackAvailability,
    Record<PlaybackRole, PlaybackHandoffGate>
  > = {
    off: { active: 'allow', remote: 'allow', idle: 'allow' },
    pending: { active: 'defer', remote: 'defer', idle: 'defer' },
    ready: { active: 'suppress', remote: 'suppress', idle: 'allow' },
    unavailable: { active: 'allow', remote: 'allow', idle: 'allow' },
  };

  it('defers while pending, suppresses while a device is active, and allows otherwise', () => {
    for (const availability of availabilities) {
      for (const role of roles) {
        expect(resolvePlaybackHandoffGate({ availability, role })).toBe(
          expected[availability][role]
        );
      }
    }
  });

  it('offers a conflict held while suppressed once the gate allows and the server item differs', () => {
    // This phone played item-a and relaunched while it was still the active device; the server's
    // now-playing is a newer item-b from another device.
    const reconcileState = (
      resourceIdText: string,
      lastMeaningfulAt: number
    ): PlaybackReconcileResourceState => ({
      queueIdText: 'queue-av',
      resourceIdText,
      resourceKind: 'item',
      playbackPosition: 57,
      mediaFileDuration: null,
      completed: false,
      zone: 'now_playing',
      lastMeaningfulAt,
    });
    const local = reconcileState('item-a', 1_000);
    const remote = reconcileState('item-b', 2_000);
    const conflict: PlaybackReconcileDifferentNowPlayingConflict = {
      queueIdText: 'queue-av',
      local,
      remote,
      winner: remote,
      loser: local,
      shouldPrompt: true,
    };
    const afterGrace: Parameters<typeof resolvePlaybackIdleAdoption>[0]['view'] = {
      availability: 'ready',
      role: 'idle',
      state: playbackState({
        active_session_id_text: null,
        status: 'paused',
        resource: {
          ref: { kind: 'item', item_id_text: 'item-a' },
          medium: MediumEnum.Podcast,
          title: 'Episode A',
          channel_title: 'Podcast',
          image_url: null,
        },
      }),
    };

    expect(resolvePlaybackHandoffGate({ availability: 'ready', role: 'active' })).toBe('suppress');
    expect(resolvePlaybackHandoffGate(afterGrace)).toBe('allow');
    // Leaving the active role adopts nothing, so the loaded item stays item-a, not the server's.
    expect(
      resolvePlaybackIdleAdoption({
        previousRole: 'active',
        previousAvailability: 'ready',
        view: afterGrace,
        loadedRef: { kind: 'item', item_id_text: 'item-a' },
        isPlayingLocally: false,
        isAuthoringHold: false,
      })
    ).toEqual({ type: 'none' });
    // Closing while suppressed records no dismissal.
    expect(
      shouldPromptForPlaybackHandoffConflict({
        conflict,
        dismissedStateKey: null,
        isPlayingLocally: false,
      })
    ).toBe(true);
  });
});

describe('resolvePlaybackIdleAdoption', () => {
  type IdleAdoptionParams = Parameters<typeof resolvePlaybackIdleAdoption>[0];

  const leftState = (overrides: Partial<DTOPlaybackState> = {}): DTOPlaybackState =>
    playbackState({
      active_session_id_text: null,
      status: 'paused',
      position_seconds: 120,
      ...overrides,
    });

  const idleView = (state: DTOPlaybackState | null = leftState()): IdleAdoptionParams['view'] => ({
    availability: 'ready',
    role: 'idle',
    state,
  });

  const adoption = (overrides: Partial<IdleAdoptionParams> = {}) =>
    resolvePlaybackIdleAdoption({
      previousRole: 'remote',
      previousAvailability: 'ready',
      view: idleView(),
      loadedRef: { kind: 'item', item_id_text: 'item-local' },
      isPlayingLocally: false,
      isAuthoringHold: false,
      ...overrides,
    });

  it('loads a different shared item paused at its position when the active device leaves', () => {
    const expected = {
      type: 'load_paused',
      ref: { kind: 'item', item_id_text: 'item-1' },
      positionSeconds: 120,
    };

    expect(adoption()).toEqual(expected);
    expect(adoption({ loadedRef: null })).toEqual(expected);
  });

  it('moves the loaded item to the shared position', () => {
    const loadedRef: DTOPlaybackResourceRef = { kind: 'item', item_id_text: 'item-1' };

    expect(adoption({ loadedRef })).toEqual({ type: 'seek', positionSeconds: 120 });
    expect(adoption({ loadedRef, view: idleView(leftState({ position_seconds: null })) })).toEqual({
      type: 'none',
    });
  });

  it.each<[string, Partial<IdleAdoptionParams>]>([
    [
      'a live item',
      {
        view: idleView(
          leftState({ is_live: true, position_seconds: null, duration_seconds: null })
        ),
      },
    ],
    ['a release', { view: idleView(leftState({ resource: null, position_seconds: null })) }],
    ['local audio playing', { isPlayingLocally: true }],
    ['an authoring hold', { isAuthoringHold: true }],
    ['this device leaving the active role', { previousRole: 'active' }],
    ['a cold open', { previousRole: 'idle', previousAvailability: 'pending' }],
    ['a remote role seen while pending', { previousAvailability: 'pending' }],
    ['a remote role seen while the stream was down', { previousAvailability: 'unavailable' }],
    [
      'the stream going down',
      { view: { availability: 'unavailable', role: 'idle', state: leftState() } },
    ],
  ])('adopts nothing for %s', (_label, overrides) => {
    expect(adoption(overrides)).toEqual({ type: 'none' });
  });
});
