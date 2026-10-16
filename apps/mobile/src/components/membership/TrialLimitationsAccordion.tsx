import { useTranslation } from 'react-i18next';

import { Accordion } from '../primitives';
import { TrialLimitationsContent } from './TrialLimitationsContent';

type TrialLimitationsAccordionProps = {
  testID: string;
};

export function TrialLimitationsAccordion({ testID }: TrialLimitationsAccordionProps) {
  const { t } = useTranslation();

  return (
    <Accordion testID={testID} title={t('membership.trial_limitations_title')}>
      <TrialLimitationsContent />
    </Accordion>
  );
}
