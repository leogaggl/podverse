'use client';

import type { ReactNode } from 'react';

import { usePublishAppBarTitle } from '../AppBarTitle/AppBarTitle';

import styles from './MainHeader.module.scss';

export type MainHeaderProps = {
  title: string;
  buttonsNode?: ReactNode;
};

/**
 * Page title and actions. On large screens the title shows in the app bar (through
 * `AppBarTitleProvider`) and only `buttonsNode` renders here; on small screens the title renders
 * here as a row under the bar.
 */
export function MainHeader({ title, buttonsNode }: MainHeaderProps) {
  usePublishAppBarTitle(title);

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {buttonsNode ? <div className={styles.buttons}>{buttonsNode}</div> : null}
    </header>
  );
}
