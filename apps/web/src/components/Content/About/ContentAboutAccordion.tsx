import { Accordion } from '@podverse/ui';

import { ContentAboutDescription } from './ContentAboutDescription';
import { ContentAboutHeader } from './ContentAboutHeader';

import styles from '../../../styles/components/Content/About/ContentAboutAccordion.module.scss';

type ContentAboutAccordionProps = {
  defaultOpen?: boolean;
  description?: string;
};

export const ContentAboutAccordion = ({ defaultOpen, description }: ContentAboutAccordionProps) => {
  const hasDescription = description !== undefined && description.length > 0;
  if (!hasDescription) {
    return null;
  }

  return (
    <Accordion header={<ContentAboutHeader />} open={defaultOpen} contentClassName={styles.content}>
      <div className={styles.wrapper}>
        <ContentAboutDescription description={description} />
      </div>
    </Accordion>
  );
};
