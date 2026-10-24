import { useTranslation } from 'react-i18next';

import type { DTOTasteProfileAgreement } from '@podverse/helpers';

import { AgreementChoices } from '../terms/AgreementChoices';

type TasteProfileAgreementBodyProps = {
  agreement: DTOTasteProfileAgreement | null;
  isLoading: boolean;
  errorKey: string | null;
  accordionTestID: string;
  noTestID: string;
  onRetry: () => void;
  onDecision: (accepted: boolean) => void;
  yesTestID: string;
};

export function TasteProfileAgreementBody({
  agreement,
  isLoading,
  errorKey,
  accordionTestID,
  noTestID,
  onRetry,
  onDecision,
  yesTestID,
}: TasteProfileAgreementBodyProps) {
  const { t } = useTranslation();

  return (
    <AgreementChoices
      acceptLabel={t('taste_profile_consent.yes')}
      acceptTestID={yesTestID}
      accordionTestID={accordionTestID}
      accordionTitle={t('taste_profile_consent.how_it_works')}
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
      rejectLabel={t('taste_profile_consent.no')}
      rejectTestID={noTestID}
      version={agreement?.version ?? null}
    />
  );
}
