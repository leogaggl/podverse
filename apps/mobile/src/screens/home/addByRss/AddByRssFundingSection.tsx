import { FundingLinksSection } from '../../../components/content';
import type { AddByRssSectionPaneProps } from './addByRssSectionPane';

/**
 * Add by RSS Funding chip — support links parsed from the feed.
 */
export function AddByRssFundingSection({ detail, listHeader }: AddByRssSectionPaneProps) {
  return (
    <FundingLinksSection
      fundings={detail.fundings}
      isLoading={false}
      listHeader={listHeader}
      testIDPrefix="add-by-rss-home"
    />
  );
}
