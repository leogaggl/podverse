'use client';

import styles from './FormPrimaryActions.module.scss';

export type FormPrimaryActionsProps = {
  children: React.ReactNode;
};

/**
 * Form footer. Place the secondary action first and the primary action last.
 * Wide viewports keep that pair in a right-aligned row. Narrow viewports stack them full width
 * in the same order.
 */
export function FormPrimaryActions({ children }: FormPrimaryActionsProps) {
  return <div className={styles.actions}>{children}</div>;
}
