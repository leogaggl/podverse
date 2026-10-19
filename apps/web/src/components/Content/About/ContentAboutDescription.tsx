'use client';

import dynamic from 'next/dynamic';

import { DescriptionTruncationNotice } from '../Description/DescriptionTruncationNotice';

type ContentAboutDescriptionProps = {
  description?: string;
  isTruncated?: boolean;
  fullDescriptionUrl?: string | null;
};

const DescriptionRenderer = dynamic(
  () =>
    import('@podverse/ui').then((mod) => ({
      default: mod.DescriptionRenderer,
    })),
  { loading: () => <div /> }
);

/**
 * Channel About prose: the same rich-text path episode Summary uses, then the truncation notice
 * when the stored description was shortened.
 */
export const ContentAboutDescription = ({
  description,
  isTruncated,
  fullDescriptionUrl,
}: ContentAboutDescriptionProps) => {
  if (description === undefined || description.length === 0) {
    return null;
  }

  return (
    <>
      <DescriptionRenderer description={description} />
      {isTruncated ? (
        <DescriptionTruncationNotice kind="channel" linkUrl={fullDescriptionUrl} />
      ) : null}
    </>
  );
};
