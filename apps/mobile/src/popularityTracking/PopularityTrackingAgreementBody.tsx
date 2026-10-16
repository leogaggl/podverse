import { useTranslation } from 'react-i18next';

import type { DTOPopularityTrackingAgreement } from '@podverse/helpers';

import { AgreementChoices } from '../terms/AgreementChoices';

type PopularityTrackingAgreementBodyProps = {
  agreement: DTOPopularityTrackingAgreement | null;
  isLoading: boolean;
  errorKey: string | null;
  accordionTestID: string;
  noTestID: string;
  onRetry: () => void;
  onDecision: (accepted: boolean) => void;
  yesTestID: string;
};

export function PopularityTrackingAgreementBody({
  agreement,
  isLoading,
  errorKey,
  accordionTestID,
  noTestID,
  onRetry,
  onDecision,
  yesTestID,
}: PopularityTrackingAgreementBodyProps) {
  const { t } = useTranslation();

  return (
    <AgreementChoices
      acceptLabel={t('popularity_tracking.yes')}
      acceptTestID={yesTestID}
      accordionTestID={accordionTestID}
      accordionTitle={t('popularity_tracking.how_it_works')}
      dateLabel={null}
      errorKey={errorKey}
      fullMarkdown={agreement?.markdown ?? null}
      isLoading={isLoading}
      onAccept={() => {
        onDecision(true);
      }}
      onReject={() => {
        onDecision(false);
      }}
      onRetry={onRetry}
      rejectLabel={t('popularity_tracking.no')}
      rejectTestID={noTestID}
      version={agreement?.version ?? null}
    />
  );
}
