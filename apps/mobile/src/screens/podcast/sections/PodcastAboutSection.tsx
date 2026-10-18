import { ChannelAboutSection } from '../../../components/content';
import type { PodcastSectionPaneProps } from './podcastSectionPane';

/**
 * Podcast About chip — channel description, plus tucked RSS and website links.
 */
export function PodcastAboutSection({
  channel,
  isChannelLoading,
  listHeader,
}: PodcastSectionPaneProps) {
  return (
    <ChannelAboutSection
      channel={channel}
      isChannelLoading={isChannelLoading}
      listHeader={listHeader}
      testIDPrefix="podcast-detail"
    />
  );
}
