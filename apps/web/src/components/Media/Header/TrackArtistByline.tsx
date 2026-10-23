'use client';

import React from 'react';

import type { ArtistLineLink } from '../../../lib/artistPublishers';
import { Link } from '../../Link/Link';

import styles from '../../../styles/components/Common/Media/Podcast/Episode/EpisodeHeader.module.scss';

type TrackArtistBylineProps = {
  links: readonly ArtistLineLink[];
};

export const TrackArtistByline: React.FC<TrackArtistBylineProps> = ({ links }) => {
  if (links.length === 0) {
    return null;
  }
  return (
    <p className={styles.trackArtistByline}>
      {links.map((link, index) => (
        <span key={link.idText}>
          {index > 0 ? ', ' : null}
          <Link href={link.href}>{link.title}</Link>
        </span>
      ))}
    </p>
  );
};
