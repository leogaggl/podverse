import { useTranslations } from 'next-intl';

import { InfoWrapper } from '@podverse/ui';

import { ROUTES } from '../../constants/routes';
import { useAccount } from '../../contexts/Account';
import { buildMediaListChipPath } from '../../utils/mediaListChips';
import { Link } from '../Link/Link';

type HowToStartInfoProps = {
  rows: unknown[];
  totalPages: number;
};

export const HowToStartInfo = ({ rows, totalPages }: HowToStartInfoProps) => {
  const tSubscriptions = useTranslations('subscriptions');
  const { loggedInAccount } = useAccount();

  if (!loggedInAccount || (loggedInAccount && rows.length === 0 && totalPages === 1)) {
    return (
      <InfoWrapper>
        <p>
          {tSubscriptions.rich('how_to_start_message', {
            searchLink: (chunks) => (
              <Link fullPageLoad href={ROUTES.SEARCH}>
                {chunks}
              </Link>
            ),
            podcastsLink: (chunks) => (
              <Link fullPageLoad href={ROUTES.BROWSE}>
                {chunks}
              </Link>
            ),
            videosLink: (chunks) => (
              <Link fullPageLoad href={`${ROUTES.VIDEOS}?type=global&sort=recent`}>
                {chunks}
              </Link>
            ),
            musicLink: (chunks) => (
              <Link fullPageLoad href={buildMediaListChipPath('browse', 'artists')}>
                {chunks}
              </Link>
            ),
          })}
        </p>
      </InfoWrapper>
    );
  }

  return null;
};
