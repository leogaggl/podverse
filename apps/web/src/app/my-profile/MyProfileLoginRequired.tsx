'use client';

import { useTranslations } from 'next-intl';

import { CallToActionMessage, MainHeader } from '@podverse/ui';

import { MainWrapper } from '../../components/Main/MainWrapper';
import { useModals } from '../../contexts/Modals';

type MyProfileLoginRequiredProps = {
  title: string;
};

export function MyProfileLoginRequired({ title }: MyProfileLoginRequiredProps) {
  const tAuth = useTranslations('authentication');
  const { setModalAuthLogin } = useModals();

  return (
    <>
      <MainHeader title={title} />
      <MainWrapper>
        <CallToActionMessage
          buttonLabel={tAuth('login')}
          message={tAuth('login_required')}
          onButtonClick={() => {
            setModalAuthLogin({ isOpen: true });
          }}
        />
      </MainWrapper>
    </>
  );
}
