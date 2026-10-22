import type { AddByRSSResourceData } from '@podverse/helpers/dto';
import { getNonEmptyTrimmedStringProperty, getOwnPropertyValue } from '@podverse/helpers/guards';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

import type { AuthStatus } from '../../auth/AuthProvider';
import type { DescriptionTruncation } from '../../components/content/DescriptionText';
import type { AddByRssNowPlayingSectionsSnapshot } from '../../playback/addByRssNowPlayingSectionsStore';
import type { EpisodeTab } from '../../prefs/detailListPrefs';

/** What the full player draws for an Add by RSS pane before the shared tab body. */
export type FullPlayerAddByRssPaneState =
  'auth-required' | 'content' | 'error' | 'loading' | 'offline';

/** Auth, Offline Mode, the open chip, and the now-playing sections snapshot. */
export type FullPlayerAddByRssPaneInput = {
  activeTab: EpisodeTab;
  authStatus: AuthStatus;
  offlineModeEnabled: boolean;
  snapshot: AddByRssNowPlayingSectionsSnapshot;
};

/** Whether the item's stored parsed bundle links a chapters file, read without a lookup. */
export const addByRssResourceDataLinksChapters = (resourceData: AddByRSSResourceData): boolean => {
  const chaptersFeed = getOwnPropertyValue(resourceData.bundle, 'chaptersFeed');
  return getNonEmptyTrimmedStringProperty(chaptersFeed, 'url') !== null;
};

/** Pane state for the open chip. Every chip spins while the parsed item is still resolving. */
export const resolveFullPlayerAddByRssPaneState = (
  input: FullPlayerAddByRssPaneInput
): FullPlayerAddByRssPaneState => {
  if (input.snapshot.sourceStatus === 'idle' || input.snapshot.sourceStatus === 'resolving') {
    return 'loading';
  }
  if (input.activeTab !== 'chapters' && input.activeTab !== 'transcript') {
    return 'content';
  }
  if (input.offlineModeEnabled && input.snapshot.sections === null) {
    return 'offline';
  }
  if (input.authStatus === 'anonymous') {
    return 'auth-required';
  }
  if (input.snapshot.sectionsStatus === 'error') {
    return 'error';
  }
  if (input.snapshot.sections === null) {
    return 'loading';
  }
  return 'content';
};

/** True when Chapters or Transcript should start a load that has not run yet. */
export const shouldLoadFullPlayerAddByRssSections = (input: FullPlayerAddByRssPaneInput): boolean =>
  (input.activeTab === 'chapters' || input.activeTab === 'transcript') &&
  input.authStatus === 'authenticated' &&
  !input.offlineModeEnabled &&
  input.snapshot.sourceStatus === 'resolved' &&
  input.snapshot.sectionsStatus === 'idle' &&
  input.snapshot.source !== null &&
  input.snapshot.source.sectionUrls !== null;

/** Summary HTML, and the item website link when the parsed description is truncated. */
export const addByRssPaneSummary = (
  itemBundle: AddByRSSMappedFeed['items'][number] | null
): { html: string | null; truncation: DescriptionTruncation | undefined } => {
  const description = itemBundle?.description ?? null;
  const html =
    description !== null && description.value.length > 0
      ? description.value
      : description !== null && description.preview.length > 0
        ? description.preview
        : null;
  return {
    html,
    truncation:
      description?.is_truncated === true
        ? { kind: 'item', linkUrl: itemBundle?.about.website_link_url ?? null }
        : undefined,
  };
};
