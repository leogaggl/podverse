import { PeoplePane } from '../../../components/content';
import type { AddByRssSectionPaneProps } from './addByRssSectionPane';

/**
 * Add by RSS People chip — people parsed from the feed.
 */
export function AddByRssPeopleSection({ detail, listHeader }: AddByRssSectionPaneProps) {
  return (
    <PeoplePane
      isLoading={false}
      listHeader={listHeader}
      people={detail.people}
      testIDPrefix="add-by-rss-home"
    />
  );
}
