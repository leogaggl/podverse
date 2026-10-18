'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const DescriptionRenderer = dynamic(
  () =>
    import('@podverse/ui').then((mod) => ({
      default: mod.DescriptionRenderer,
    })),
  { loading: () => <div /> }
);

type CoreEpisodeSummaryProps = {
  description?: string;
};

/**
 * Item Summary: description prose. People are a separate chip.
 */
export const CoreEpisodeSummary: React.FC<CoreEpisodeSummaryProps> = ({ description }) => {
  const hasDescription = description !== undefined && description.length > 0;
  if (!hasDescription) {
    return null;
  }

  return (
    <div>
      <DescriptionRenderer description={description || ''} />
    </div>
  );
};
