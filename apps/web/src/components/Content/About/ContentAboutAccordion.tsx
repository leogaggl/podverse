import { Accordion } from '@podverse/ui';

import { ContentAboutDescription } from './ContentAboutDescription';
import { ContentAboutHeader } from './ContentAboutHeader';

import styles from '../../../styles/components/Content/About/ContentAboutAccordion.module.scss';

type ContentAboutAccordionProps = {
  defaultOpen?: boolean;
  description?: string;
  isTruncated?: boolean;
  fullDescriptionUrl?: string | null;
};

export const ContentAboutAccordion = ({
  defaultOpen,
  description,
  isTruncated,
  fullDescriptionUrl,
}: ContentAboutAccordionProps) => {
  const hasDescription = description !== undefined && description.length > 0;
  if (!hasDescription) {
    return null;
  }

  return (
    <Accordion header={<ContentAboutHeader />} open={defaultOpen} contentClassName={styles.content}>
      <div className={styles.wrapper}>
        <ContentAboutDescription
          description={description}
          isTruncated={isTruncated}
          fullDescriptionUrl={fullDescriptionUrl}
        />
      </div>
    </Accordion>
  );
};
