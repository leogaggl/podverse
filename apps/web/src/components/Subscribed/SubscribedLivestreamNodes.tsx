'use client';

import React from 'react';

import type { DTOChannel, DTOItem, DTOLiveItem } from '@podverse/helpers';
import { Divider } from '@podverse/ui';

import type { AddByRSSLivestreamIndexItem } from '../../utils/addByRSS/types';
import type { SubscribedLivestreamEntry } from '../../utils/subscribed/mergeSubscribedLivestreams';
import { AddByRSSLivestreamRow } from '../AddByRSS/Livestream/AddByRSSLivestreamRow';
import { ListLiveItemRow } from '../List/LiveItem/ListLiveItemRow';

import styles from '../../styles/components/Common/List/ListNodes.module.scss';

type SubscribedLivestreamNodesProps = {
  entries: readonly SubscribedLivestreamEntry[];
  showChannelInfo?: boolean;
};

type VisibleSubscribedLivestreamEntry =
  | { source: 'server'; item: DTOItem & { channel: DTOChannel; live_item: DTOLiveItem } }
  | { source: 'add-by-rss'; item: AddByRSSLivestreamIndexItem };

const isVisibleEntry = (
  entry: SubscribedLivestreamEntry
): entry is VisibleSubscribedLivestreamEntry => {
  if (entry.source === 'add-by-rss') {
    return true;
  }
  return (
    entry.item.channel !== undefined &&
    entry.item.channel !== null &&
    entry.item.live_item !== undefined &&
    entry.item.live_item !== null
  );
};

export const SubscribedLivestreamNodes: React.FC<SubscribedLivestreamNodesProps> = ({
  entries,
  showChannelInfo,
}) => {
  const addByRSSItems = entries.flatMap((entry) =>
    entry.source === 'add-by-rss' ? [entry.item] : []
  );
  const itemIdTexts = addByRSSItems.map((item) => item.idText);
  const feedIdText = addByRSSItems[0]?.channelIdText ?? '';
  const addByRSSIndexById = new Map(addByRSSItems.map((item, index) => [item.id, index]));
  const visibleEntries = entries.filter(isVisibleEntry);

  return (
    <div key="list" className={styles.list}>
      {visibleEntries.map((entry, idx) => (
        <React.Fragment key={entry.item.id}>
          {entry.source === 'server' ? (
            <ListLiveItemRow
              channel={entry.item.channel}
              item={entry.item}
              live_item={entry.item.live_item}
              showChannelInfo={showChannelInfo}
              showLiveItemStatus
            />
          ) : (
            <AddByRSSLivestreamRow
              item={entry.item}
              showChannelInfo={showChannelInfo}
              listContext={{
                feedIdText,
                itemIdTexts,
                currentIndex: addByRSSIndexById.get(entry.item.id) ?? 0,
                sortOrder: 'recent',
              }}
            />
          )}
          {idx < visibleEntries.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </div>
  );
};
