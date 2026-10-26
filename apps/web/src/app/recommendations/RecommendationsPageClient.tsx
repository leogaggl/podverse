'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { DTOAccountRecommendation, RecommendationChip } from '@podverse/helpers';
import {
  buildAlbumPath,
  buildArtistPath,
  buildPodcastPath,
  isTasteProfileTrackingAllowed,
} from '@podverse/helpers';
import {
  Button,
  CallToActionMessage,
  MainColumnStack,
  MainHeader,
  MainSidebarLayout,
  SideContent,
} from '@podverse/ui';

import { MainWrapper } from '../../components/Main/MainWrapper';
import { MediaListChips } from '../../components/MediaListChips/MediaListChips';
import { MediaListLoadingSpinner } from '../../components/MediaListChips/MediaListLoadingSpinner';
import { ROUTES } from '../../constants/routes';
import { useAccount } from '../../contexts/Account';
import { useConfig } from '../../contexts/Config';
import { useModals } from '../../contexts/Modals';
import { getApiRequestService } from '../../factories/apiRequestService';
import { RECOMMENDATION_CHIPS } from '../../utils/mediaListChips';

import styles from './RecommendationsPage.module.scss';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading'; chip: RecommendationChip }
  | { status: 'error'; chip: RecommendationChip }
  | { status: 'ready'; chip: RecommendationChip; items: DTOAccountRecommendation[] };

type RecommendationsPageClientProps = {
  chip: RecommendationChip;
  urlChip: RecommendationChip | null;
};

function showPath(chip: RecommendationChip, idText: string): string {
  if (chip === 'albums') {
    return buildAlbumPath(idText);
  }
  if (chip === 'artists') {
    return buildArtistPath(idText);
  }
  return buildPodcastPath(idText);
}

export function RecommendationsPageClient({ chip, urlChip }: RecommendationsPageClientProps) {
  const t = useTranslations('features.recommendations');
  const tAuth = useTranslations('authentication');
  const tMisc = useTranslations('misc');
  const router = useRouter();
  const { loggedInAccount } = useAccount();
  const config = useConfig();
  const { setModalAuthLogin } = useModals();
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const signedIn = loggedInAccount !== null && loggedInAccount !== undefined;
  const trackingAllowed = isTasteProfileTrackingAllowed(
    loggedInAccount?.account_settings,
    config.public.legal.tasteProfileAgreement.version
  );

  useEffect(() => {
    if (!signedIn) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading', chip });
    getApiRequestService()
      .reqAccountRecommendations({ chip })
      .then((items) => {
        if (!cancelled) {
          setState({ status: 'ready', chip, items });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'error', chip });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chip, signedIn, loggedInAccount?.id_text]);

  const shown: LoadState =
    signedIn && (state.status === 'idle' || state.chip !== chip)
      ? { status: 'loading', chip }
      : state;
  const items = shown.status === 'ready' ? shown.items : [];
  const openSettings = () => {
    router.push(`${ROUTES.SETTINGS}?tab=recommendations`);
  };

  return (
    <>
      <MainHeader title={t('title')} />
      <MainWrapper>
        <MainSidebarLayout>
          <SideContent />
          <MainColumnStack>
            <MediaListChips
              chips={RECOMMENDATION_CHIPS}
              page="recommendations"
              selected={chip}
              urlChip={urlChip}
            />
            {!signedIn ? (
              <CallToActionMessage
                buttonLabel={tAuth('login')}
                message={tAuth('login_required')}
                onButtonClick={() => {
                  setModalAuthLogin({ isOpen: true });
                }}
              />
            ) : null}
            {signedIn && !trackingAllowed && shown.status === 'ready' && items.length === 0 ? (
              <CallToActionMessage
                buttonLabel={t('enable')}
                message={t('need_taste_profile')}
                onButtonClick={openSettings}
              />
            ) : null}
            {signedIn && !trackingAllowed && items.length > 0 ? (
              <div className={styles.note}>
                <p>{t('paused')}</p>
                <Button type="button" variant="secondary" onClick={openSettings}>
                  {t('enable')}
                </Button>
              </div>
            ) : null}
            {signedIn && trackingAllowed && shown.status === 'ready' && items.length === 0 ? (
              <p className={styles.status}>{t('check_back')}</p>
            ) : null}
            {signedIn && shown.status === 'error' ? (
              <p className={styles.status} role="alert">
                {t('load_error')}
              </p>
            ) : null}
            {signedIn && shown.status === 'loading' ? <MediaListLoadingSpinner /> : null}
            {items.length > 0 ? (
              <ul className={styles.list}>
                {items.map((item) => {
                  const title = item.channel.title?.trim() || tMisc('untitled');
                  return (
                    <li key={item.channel.id_text} className={styles.row}>
                      <Link className={styles.title} href={showPath(chip, item.channel.id_text)}>
                        {title}
                      </Link>
                      <span
                        aria-label={t('strength', { level: item.strength })}
                        className={styles.strength}
                      >
                        {item.strength}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </>
  );
}
