'use client';

import React from 'react';

import { Divider } from '@podverse/ui';

import type { AddByRSSListSortOrder } from '../../../../../contexts/AddByRSSListContext';
import type { AddByRSSItemIndexItem } from '../../../../../utils/addByRSS/types';
import type { ViewSelectedOption } from '../../../../ViewSelector/ViewSelector';
import { AddByRSSTrackGridCard } from './AddByRSSTrackGridCard';
import { AddByRSSTrackRow } from './AddByRSSTrackRow';

import styles from '../../../../../styles/components/Common/List/ListNodes.module.scss';

type AddByRSSTrackNodesProps = {
  items: AddByRSSItemIndexItem[];
  viewSelected: ViewSelectedOption;
  sortOrder?: AddByRSSListSortOrder;
  /** Shown after the title on each row. */
  showAddByRssMarker?: boolean;
};

export const AddByRSSTrackNodes: React.FC<AddByRSSTrackNodesProps> = ({
  items,
  viewSelected,
  sortOrder = 'recent',
  showAddByRssMarker,
}) => {
  if (viewSelected === 'rows') {
    const feedIdText = items[0]?.channelIdText ?? '';
    const itemIdTexts = items.map((i) => i.idText);
    return (
      <div key="list" className={styles.list}>
        {items.map((item, idx) => (
          <React.Fragment key={item.id}>
            <AddByRSSTrackRow
              itemIdText={item.idText}
              channelTitle={item.channelTitle}
              channelImageUrl={item.channelImageUrl}
              bundle={item.bundle}
              indexItem={item}
              listContext={{
                feedIdText,
                itemIdTexts,
                currentIndex: idx,
                sortOrder,
              }}
              showAddByRssMarker={showAddByRssMarker}
            />
            {idx < items.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </div>
    );
  }
  if (viewSelected === 'grid') {
    return (
      <div key="grid" className={styles.grid}>
        {items.map((item) => (
          <AddByRSSTrackGridCard key={item.id} item={item} showChannelInfo />
        ))}
      </div>
    );
  }
  return null;
};
