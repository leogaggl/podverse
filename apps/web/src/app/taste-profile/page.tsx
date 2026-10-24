'use client';

import { useRouter } from 'next/navigation';

import { TasteProfileAgreementGate } from '../../components/Legal/TasteProfileAgreementGate';
import { ROUTES } from '../../constants/routes';

export default function TasteProfileAgreementPage() {
  const router = useRouter();

  return (
    <TasteProfileAgreementGate
      onDecided={() => {
        router.push(`${ROUTES.SETTINGS}?tab=recommendations`);
      }}
    />
  );
}
