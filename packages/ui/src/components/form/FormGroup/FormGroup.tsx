import classNames from 'classnames';
import type { ReactNode } from 'react';

import styles from './FormGroup.module.scss';

export type FormGroupProps = {
  children: ReactNode;
  className?: string;
  /**
   * Use when this group is a direct child of {@link StackForm} / {@link FormStack} so spacing relies on
   * parent **`gap`** only.
   */
  layout?: 'default' | 'inStack';
};

/**
 * Wrapper for one control, or a control plus its hint.
 * Does not space its children. Peer fields are direct children of {@link StackForm} / {@link FormStack},
 * which separate them with `--form-gap`.
 */
export function FormGroup({ children, className = '', layout = 'default' }: FormGroupProps) {
  return (
    <div
      className={classNames(
        styles.formGroup,
        layout === 'inStack' && styles.formGroupInStack,
        className
      )}
    >
      {children}
    </div>
  );
}
