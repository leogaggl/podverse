import { useMemo } from 'react';

import { PeoplePane, toAboutPersonFromChannel } from '../../../components/content';
import type { PodcastSectionPaneProps } from './podcastSectionPane';

/**
 * Podcast People chip — people credited on the channel.
 */
export function PodcastPeopleSection({
  channel,
  isChannelLoading,
  listHeader,
}: PodcastSectionPaneProps) {
  const people = useMemo(
    () => (channel?.channel_persons ?? []).map(toAboutPersonFromChannel),
    [channel]
  );

  return (
    <PeoplePane
      isLoading={isChannelLoading && channel === null}
      listHeader={listHeader}
      people={people}
      testIDPrefix="podcast-detail"
    />
  );
}
