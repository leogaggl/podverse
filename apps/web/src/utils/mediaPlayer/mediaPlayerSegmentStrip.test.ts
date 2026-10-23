import { describe, expect, it } from 'vitest';

import type { DTOClip, DTOItemSoundbite } from '@podverse/helpers';

import {
  mediaPlayerSegmentStripLabelKey,
  resolveMediaPlayerSegmentStripSegment,
} from './mediaPlayerSegmentStrip';

// The helper only checks null vs set. The info resolver owns the DTO fields.
const clip = { id: 1, id_text: 'clip-1' } as DTOClip;
const officialClip = { id: 2, id_text: 'soundbite-1' } as DTOItemSoundbite;

describe('resolveMediaPlayerSegmentStripSegment', () => {
  it('returns null when nothing is playing', () => {
    expect(
      resolveMediaPlayerSegmentStripSegment({
        hasContent: false,
        mpClip: clip,
        mpItemSoundbite: null,
        subsectionTitle: 'Introduction',
      })
    ).toBeNull();
  });

  it('returns null when the subsection title is missing or blank', () => {
    expect(
      resolveMediaPlayerSegmentStripSegment({
        hasContent: true,
        mpClip: null,
        mpItemSoundbite: null,
        subsectionTitle: null,
      })
    ).toBeNull();
    expect(
      resolveMediaPlayerSegmentStripSegment({
        hasContent: true,
        mpClip: null,
        mpItemSoundbite: null,
        subsectionTitle: '   ',
      })
    ).toBeNull();
  });

  it('names a clip ahead of an official clip and trims the title', () => {
    expect(
      resolveMediaPlayerSegmentStripSegment({
        hasContent: true,
        mpClip: clip,
        mpItemSoundbite: officialClip,
        subsectionTitle: '  Best bit  ',
      })
    ).toEqual({ kind: 'clip', title: 'Best bit' });
  });

  it('names an official clip when no clip is set', () => {
    expect(
      resolveMediaPlayerSegmentStripSegment({
        hasContent: true,
        mpClip: null,
        mpItemSoundbite: officialClip,
        subsectionTitle: 'Teaser',
      })
    ).toEqual({ kind: 'official-clip', title: 'Teaser' });
  });

  it('names a chapter when neither a clip nor an official clip is set', () => {
    expect(
      resolveMediaPlayerSegmentStripSegment({
        hasContent: true,
        mpClip: null,
        mpItemSoundbite: null,
        subsectionTitle: 'Introduction',
      })
    ).toEqual({ kind: 'chapter', title: 'Introduction' });
  });
});

describe('mediaPlayerSegmentStripLabelKey', () => {
  it('maps each segment kind to its catalog key', () => {
    expect(mediaPlayerSegmentStripLabelKey('chapter')).toBe('segment_strip_chapter');
    expect(mediaPlayerSegmentStripLabelKey('clip')).toBe('segment_strip_clip');
    expect(mediaPlayerSegmentStripLabelKey('official-clip')).toBe('segment_strip_official_clip');
  });
});
