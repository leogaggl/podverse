'use client';

import { useId } from 'react';

import styles from './DescribedLink.module.scss';

export type DescribedLinkProps = {
  description: string;
  href: string;
  rel?: string;
  target?: string;
  title: string;
};

/**
 * A link and the sentence that describes it, on one bordered surface. The sentence sits close
 * under the label. The card is the hit target; the link's accessible name stays the label.
 */
export function DescribedLink({ description, href, rel, target, title }: DescribedLinkProps) {
  const descriptionId = useId();

  return (
    <div className={styles.card}>
      <a
        aria-describedby={descriptionId}
        className={styles.title}
        href={href}
        rel={rel}
        target={target}
      >
        {title}
      </a>
      <p className={styles.description} id={descriptionId}>
        {description}
      </p>
    </div>
  );
}
