'use client';

import classNames from 'classnames';
import { usePathname, useSearchParams } from 'next/navigation';
import React, { Suspense } from 'react';

import { Link } from '../Link/Link';
import { isSidebarLinkCurrent } from './sidebarLinkCurrent';

import styles from '../../styles/components/SideBar/SideBarLink.module.scss';

type Props = {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
};

export const SideBarLink: React.FC<Props> = (props) => {
  if (props.href.includes('?')) {
    return (
      <Suspense fallback={<SideBarLinkView {...props} current={false} />}>
        <SideBarLinkMatchingSearch {...props} />
      </Suspense>
    );
  }

  return <SideBarLinkMatchingPath {...props} />;
};

const SideBarLinkMatchingPath: React.FC<Props> = (props) => {
  const pathname = usePathname();
  const current = isSidebarLinkCurrent(props.href, pathname, '');
  return <SideBarLinkView {...props} current={current} />;
};

const SideBarLinkMatchingSearch: React.FC<Props> = (props) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = isSidebarLinkCurrent(props.href, pathname, searchParams.toString());
  return <SideBarLinkView {...props} current={current} />;
};

const SideBarLinkView: React.FC<Props & { current: boolean }> = ({
  href,
  children,
  disabled,
  current,
}) => (
  <Link
    href={href}
    className={classNames(styles.link, current && styles.current)}
    disabled={disabled}
    color="secondary"
    aria-current={current ? 'page' : undefined}
  >
    {children}
  </Link>
);
