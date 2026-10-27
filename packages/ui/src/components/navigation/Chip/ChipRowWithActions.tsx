import classNames from 'classnames';
import type { ReactNode } from 'react';

import styles from './ChipRowWithActions.module.scss';

export type ChipRowWithActionsProps = {
  /**
   * Page actions. They are ahead of the chips in the tab order. On a line wide enough for both,
   * they sit at the end of the chip row. When the line is too narrow, they move above the chips
   * and align to the start.
   */
  actions: ReactNode;
  /** The chip row. */
  children: ReactNode;
  /** Marks the actions group. */
  actionsTestId?: string;
  className?: string;
};

export function ChipRowWithActions({
  actions,
  children,
  actionsTestId,
  className,
}: ChipRowWithActionsProps) {
  return (
    <div className={classNames(styles.layout, className)}>
      <div className={styles.actions} data-testid={actionsTestId}>
        {actions}
      </div>
      <div className={styles.chips}>{children}</div>
    </div>
  );
}
