import { Accordion } from '../primitives';
import { TrialLimitationsContent } from './TrialLimitationsContent';
import { useMembershipComparisonDocument } from './useMembershipComparisonDocument';

type TrialLimitationsAccordionProps = {
  testID: string;
};

export function TrialLimitationsAccordion({ testID }: TrialLimitationsAccordionProps) {
  const document = useMembershipComparisonDocument();

  return (
    <Accordion testID={testID} title={document.trialLimitations.title}>
      <TrialLimitationsContent />
    </Accordion>
  );
}
