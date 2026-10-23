'use client';

import React from 'react';

import type { DTOItem } from '@podverse/helpers';
import { Divider } from '@podverse/ui';

import type { ViewSelectedOption } from '../../../../ViewSelector/ViewSelector';
import { ListLiveItemRow } from '../../../LiveItem/ListLiveItemRow';
import { ListTrackGridNode } from './ListTrackGridNode';
import { ListTrackRow } from './ListTrackRow';

import styles from '../../../../../styles/components/Common/List/ListNodes.module.scss';

interface Params {
  itemsAdded: DTOItem[];
  viewSelected: ViewSelectedOption;
  showChannelInfo?: boolean;
}

export function ListTrackRemoteItemNodes({
  itemsAdded,
  viewSelected,
  showChannelInfo,
}: Params): React.ReactNode {
  const itemsWithChannels = itemsAdded.filter(
    (item) => item.channel !== null && item.channel !== undefined
  );

  if (viewSelected === 'rows') {
    return (
      <div key="list" className={styles.listTracks}>
        {itemsWithChannels.map((itemAdded, idx) => {
          const rowChannel = itemAdded.channel;
          if (!rowChannel) {
            return null;
          }
          return (
            <React.Fragment key={itemAdded.id}>
              {itemAdded.live_item ? (
                <ListLiveItemRow
                  channel={rowChannel}
                  item={itemAdded}
                  live_item={itemAdded.live_item}
                  showChannelInfo={showChannelInfo}
                  showLiveItemStatus
                />
              ) : (
                <ListTrackRow
                  channel={rowChannel}
                  item={itemAdded}
                  showChannelInfo={showChannelInfo}
                  playlist_id_text={null}
                />
              )}
              {idx < itemsWithChannels.length - 1 && <Divider />}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  if (viewSelected === 'grid') {
    return (
      <div key="grid" className={styles.grid}>
        {itemsWithChannels.map((itemAdded) => {
          const rowChannel = itemAdded.channel;
          if (!rowChannel) {
            return null;
          }
          return (
            <ListTrackGridNode
              key={itemAdded.id}
              channel={rowChannel}
              item={itemAdded}
              showChannelInfo={showChannelInfo}
            />
          );
        })}
      </div>
    );
  }

  return null;
}
