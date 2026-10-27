import React from 'react';

import styles from '../../styles/components/List/DetailListWrapper.module.scss';

type DetailListWrapperProps = {
  children: React.ReactNode;
  fill?: boolean;
};

export const DetailListWrapper: React.FC<DetailListWrapperProps> = ({ children, fill = false }) => (
  <div className={fill ? `${styles.wrapper} ${styles.wrapperFill}` : styles.wrapper}>
    {children}
  </div>
);
