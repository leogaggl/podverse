/**
 * Routes the Add by RSS screens navigate between. Registered on the Home, Library, Browse, and
 * Search stacks.
 */
export type AddByRssDetailStackParamList = {
  AddByRssCredentials: { feedIdText: string };
  AddByRssEpisodeDetail: { feedIdText: string; itemKey: string };
  AddByRssLivestreamDetail: { feedIdText: string; liveItemKey: string };
  AddByRssPodcastDetail: { feedIdText: string };
  AddByRssTrackDetail: { feedIdText: string; itemKey: string };
};
