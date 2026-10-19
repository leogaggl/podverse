'use client';

import classNames from 'classnames';
import { useTranslations } from 'next-intl';

import { isValidHttpUrl } from '@podverse/helpers-validation/client';
import type { ActionLinkLinkProps } from '@podverse/ui';
import { ActionLink } from '@podverse/ui';

import styles from '../../../styles/components/Content/Description/DescriptionTruncationNotice.module.scss';

type DescriptionTruncationNoticeProps = {
  kind: 'item' | 'channel';
  linkUrl: string | null | undefined;
};

const ExternalAnchor = ({
  href,
  children,
  className,
  title,
  'aria-label': ariaLabel,
}: ActionLinkLinkProps) => (
  <a
    href={href}
    className={className}
    title={title}
    aria-label={ariaLabel}
    target="_blank"
    rel="noopener noreferrer"
  >
    {children}
  </a>
);

/**
 * Says the stored description was shortened, linking to the full text on the publisher's site
 * when the feed gives an http(s) link. Callers render it only for a truncated description, right
 * after the prose; the prose's trailing block margin supplies the gap above it.
 */
export const DescriptionTruncationNotice = ({
  kind,
  linkUrl,
}: DescriptionTruncationNoticeProps) => {
  const t = useTranslations('info.truncation');

  if (linkUrl !== null && linkUrl !== undefined && isValidHttpUrl(linkUrl)) {
    return (
      <p className={styles.notice}>
        <ActionLink href={linkUrl} LinkComponent={ExternalAnchor} variant="inline">
          {kind === 'item' ? t('read_full_show_notes') : t('read_full_description')}
        </ActionLink>
      </p>
    );
  }

  return (
    <p className={classNames(styles.notice, styles.muted)}>
      {kind === 'item' ? t('show_notes_shortened') : t('description_shortened')}
    </p>
  );
};
