'use client';

import type React from 'react';

import type { DTOItem } from '@podverse/helpers';

import type { ViewSelectedOption } from '../../../../ViewSelector/ViewSelector';
import { ListTrackRemoteItemNodes } from './ListTrackRemoteItemNodes';

type Props = {
  itemsAdded: DTOItem[];
  viewSelected: ViewSelectedOption;
};

export const ListTracksRemoteItems: React.FC<Props> = ({ itemsAdded, viewSelected }) => {
  return <ListTrackRemoteItemNodes itemsAdded={itemsAdded} viewSelected={viewSelected} />;
};
