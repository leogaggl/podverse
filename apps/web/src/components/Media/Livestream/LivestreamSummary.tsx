'use client';

import dynamic from 'next/dynamic';
import React from 'react';

import { DescriptionTruncationNotice } from '../../Content/Description/DescriptionTruncationNotice';

const DescriptionRenderer = dynamic(
  () =>
    import('@podverse/ui').then((mod) => ({
      default: mod.DescriptionRenderer,
    })),
  { loading: () => <div /> }
);

type LivestreamSummaryProps = {
  description?: string;
  isTruncated?: boolean;
  fullNotesUrl?: string | null;
};

export const LivestreamSummary: React.FC<LivestreamSummaryProps> = ({
  description,
  isTruncated,
  fullNotesUrl,
}) => {
  return (
    <>
      <DescriptionRenderer description={description || ''} />
      {isTruncated ? <DescriptionTruncationNotice kind="item" linkUrl={fullNotesUrl} /> : null}
    </>
  );
};
