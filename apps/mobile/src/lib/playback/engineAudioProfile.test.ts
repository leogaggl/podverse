import { describe, expect, it } from 'vitest';

import type { DTOChannel, DTOClip, DTOItem } from '@podverse/helpers/dto';
import { MediumEnum } from '@podverse/helpers/medium';
import type { PlaybackTarget } from '@podverse/playback-core';

import { buildClipPlaybackTarget, buildItemPlaybackTarget } from './buildPlaybackTarget';
import { isMusicPlaybackTarget, resolveEngineAudioProfile } from './engineAudioProfile';

const channel = (mediumId: MediumEnum): DTOChannel => {
  const value: Partial<DTOChannel> = { id_text: 'ch1', medium_id: mediumId };
  // Only medium_id is read when choosing a profile.
  return value as DTOChannel;
};

const item = (): DTOItem => {
  const value: Partial<DTOItem> = { id: 1, id_text: 'item1' };
  return value as DTOItem;
};

const clip = (): DTOClip => {
  const value: Partial<DTOClip> = { id_text: 'clip1' };
  return value as DTOClip;
};

describe('resolveEngineAudioProfile', () => {
  it('maps item targets by medium', () => {
    expect(
      resolveEngineAudioProfile(
        buildItemPlaybackTarget(item(), channel(MediumEnum.Podcast), 'explicit_play')
      )
    ).toBe('spoken');
    expect(
      resolveEngineAudioProfile(
        buildItemPlaybackTarget(item(), channel(MediumEnum.Music), 'explicit_play')
      )
    ).toBe('music');
    expect(
      resolveEngineAudioProfile(
        buildItemPlaybackTarget(item(), channel(MediumEnum.Video), 'explicit_play')
      )
    ).toBe('video');
  });

  it('follows the channel medium for clips and other segment targets', () => {
    expect(
      resolveEngineAudioProfile(buildClipPlaybackTarget(clip(), item(), channel(MediumEnum.MusicL)))
    ).toBe('music');
    expect(
      resolveEngineAudioProfile(buildClipPlaybackTarget(clip(), item(), channel(MediumEnum.Film)))
    ).toBe('video');
    expect(
      resolveEngineAudioProfile(
        buildClipPlaybackTarget(clip(), item(), channel(MediumEnum.Audiobook))
      )
    ).toBe('spoken');
  });

  it('treats add-by-RSS with no medium and an empty player as spoken', () => {
    expect(resolveEngineAudioProfile({ kind: 'add-by-rss', resourceData: {} })).toBe('spoken');
    expect(resolveEngineAudioProfile(null)).toBe('spoken');
  });

  it('follows the feed medium for add-by-RSS', () => {
    const music: PlaybackTarget = {
      kind: 'add-by-rss',
      resourceData: { medium_id: MediumEnum.Music },
    };
    const video: PlaybackTarget = {
      kind: 'add-by-rss',
      resourceData: { medium_id: MediumEnum.Video },
    };
    expect(resolveEngineAudioProfile(music)).toBe('music');
    expect(resolveEngineAudioProfile(video)).toBe('video');
    expect(isMusicPlaybackTarget(music)).toBe(true);
    expect(isMusicPlaybackTarget(video)).toBe(false);
  });
});

describe('isMusicPlaybackTarget', () => {
  it('answers music for directory tracks and nothing else on a music channel', () => {
    const musicChannel = channel(MediumEnum.Music);
    expect(
      isMusicPlaybackTarget(buildItemPlaybackTarget(item(), musicChannel, 'explicit_play'))
    ).toBe(true);
    expect(isMusicPlaybackTarget(buildClipPlaybackTarget(clip(), item(), musicChannel))).toBe(
      false
    );
    expect(
      isMusicPlaybackTarget(
        buildItemPlaybackTarget(item(), channel(MediumEnum.Podcast), 'explicit_play')
      )
    ).toBe(false);
    expect(isMusicPlaybackTarget({ kind: 'add-by-rss', resourceData: {} })).toBe(false);
    expect(isMusicPlaybackTarget(null)).toBe(false);
  });
});
