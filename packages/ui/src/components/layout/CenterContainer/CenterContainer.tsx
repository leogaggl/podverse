import classNames from 'classnames';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import styles from './CenterContainer.module.scss';

export type CenterContainerProps = {
  children: ReactNode;
  className?: string;
  /** Landmark element. `div` for an embedded page fill, `main` for a full-page screen. */
  as?: 'div' | 'main';
  /** Page fill. `tertiary` is the management sign-in surface. */
  surface?: 'primary' | 'tertiary';
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'>;

export function CenterContainer({
  as = 'div',
  children,
  className,
  surface = 'tertiary',
  ...rest
}: CenterContainerProps) {
  const classes = classNames(
    styles.centerContainer,
    surface === 'primary' ? styles.surfacePrimary : styles.surfaceTertiary,
    className
  );
  const content = <div className={styles.content}>{children}</div>;

  if (as === 'main') {
    return (
      <main className={classes} {...rest}>
        {content}
      </main>
    );
  }

  return (
    <div className={classes} {...rest}>
      {content}
    </div>
  );
}
