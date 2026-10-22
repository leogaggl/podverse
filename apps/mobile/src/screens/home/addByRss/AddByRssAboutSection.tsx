import { ChannelAboutSection } from '../../../components/content';
import type { AddByRssSectionPaneProps } from './addByRssSectionPane';

/**
 * Add by RSS About chip — feed description, plus RSS and website links.
 */
export function AddByRssAboutSection({ detail, listHeader }: AddByRssSectionPaneProps) {
  return (
    <ChannelAboutSection
      channel={detail.about}
      isChannelLoading={false}
      listHeader={listHeader}
      testIDPrefix="add-by-rss-home"
    />
  );
}
