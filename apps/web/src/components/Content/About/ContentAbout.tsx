import { ContentAboutAccordion } from './ContentAboutAccordion';
import { ContentAboutDescription } from './ContentAboutDescription';

import styles from '../../../styles/components/Content/About/ContentAbout.module.scss';

type ContentAbout = {
  description?: string;
  defaultOpen?: boolean;
  isAccordion?: boolean;
  isTruncated?: boolean;
  fullDescriptionUrl?: string | null;
};

/**
 * Channel About: description prose. People are a separate chip and side-column block.
 */
export const ContentAbout = ({
  description,
  defaultOpen,
  isAccordion,
  isTruncated,
  fullDescriptionUrl,
}: ContentAbout) => {
  const hasDescription = description !== undefined && description.length > 0;
  if (!hasDescription) {
    return null;
  }

  if (isAccordion) {
    return (
      <ContentAboutAccordion
        description={description}
        defaultOpen={defaultOpen}
        isTruncated={isTruncated}
        fullDescriptionUrl={fullDescriptionUrl}
      />
    );
  }

  return (
    <div className={styles.listView}>
      <ContentAboutDescription
        description={description}
        isTruncated={isTruncated}
        fullDescriptionUrl={fullDescriptionUrl}
      />
    </div>
  );
};
