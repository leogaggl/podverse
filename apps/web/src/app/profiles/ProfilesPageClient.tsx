'use client';

import type { ReactNode } from 'react';

import type { DTOAccount } from '@podverse/helpers';
import { MainColumnStack, MainSidebarLayout, SideContent } from '@podverse/ui';

import { MainWrapper } from '../../components/Main/MainWrapper';
import type { ProfilesPageQueryParams } from './ProfilesPageContext';
import { ProfilesPageContextProvider } from './ProfilesPageContext';
import { ProfilesPageHeader } from './ProfilesPageHeader';
import { ProfilesPageList } from './ProfilesPageList';

interface ProfilesPageClientProps {
  chipsNode?: ReactNode;
  initialQueryParams: ProfilesPageQueryParams;
  listScope?: 'page' | 'browse';
  ssrAccounts: DTOAccount[];
  ssrTotalPages: number;
}

export type ProfilesListProps = Omit<ProfilesPageClientProps, 'chipsNode'>;

export function ProfilesPageClient(props: ProfilesPageClientProps) {
  const {
    chipsNode = null,
    initialQueryParams,
    listScope = 'page',
    ssrAccounts,
    ssrTotalPages,
  } = props;

  return (
    <ProfilesPageContextProvider
      initialQueryParams={initialQueryParams}
      listScope={listScope}
      ssrAccounts={ssrAccounts}
      ssrTotalPages={ssrTotalPages}
    >
      <ProfilesPageHeader />
      <MainWrapper>
        <MainSidebarLayout>
          <SideContent />
          <MainColumnStack>
            {chipsNode}
            <ProfilesPageList />
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </ProfilesPageContextProvider>
  );
}
