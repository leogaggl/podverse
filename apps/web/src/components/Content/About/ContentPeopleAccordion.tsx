import type { DTOChannelPerson, DTOItemPerson } from '@podverse/helpers';
import { Accordion } from '@podverse/ui';

import { ContentPeopleHeader } from './ContentPeopleHeader';
import { ContentPeopleRows } from './ContentPeopleRows';

import styles from '../../../styles/components/Content/About/ContentAboutAccordion.module.scss';

type ContentPeopleAccordionProps = {
  channel_persons?: DTOChannelPerson[];
  defaultOpen?: boolean;
  item_persons?: DTOItemPerson[];
};

export const ContentPeopleAccordion = ({
  channel_persons,
  defaultOpen,
  item_persons,
}: ContentPeopleAccordionProps) => {
  const hasPeople = (channel_persons?.length ?? 0) > 0 || (item_persons?.length ?? 0) > 0;
  if (!hasPeople) {
    return null;
  }

  return (
    <Accordion
      header={<ContentPeopleHeader />}
      open={defaultOpen}
      contentClassName={styles.content}
    >
      <div className={styles.wrapper}>
        <ContentPeopleRows channel_persons={channel_persons} item_persons={item_persons} />
      </div>
    </Accordion>
  );
};
