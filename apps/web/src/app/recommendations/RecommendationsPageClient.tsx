'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { DTOAccountRecommendation, RecommendationChip } from '@podverse/helpers';
import {
  buildAlbumPath,
  buildArtistPath,
  buildDTOChannelImageLoadCandidates,
  buildPodcastPath,
  isTasteProfileTrackingAllowed,
  recommendationsListViewModeScope,
} from '@podverse/helpers';
import {
  Button,
  CallToActionMessage,
  MainColumnStack,
  MainHeader,
  MainSidebarLayout,
} from '@podverse/ui';

import { CommonAlbumListNodes } from '../../components/Common/Artist/Album/CommonAlbumNodes';
import { CommonArtistListNodes } from '../../components/Common/Artist/CommonArtistNodes';
import { CommonPodcastListNodes } from '../../components/Common/Podcast/CommonPodcastNodes';
import { MainWrapper } from '../../components/Main/MainWrapper';
import { MediaListChips } from '../../components/MediaListChips/MediaListChips';
import { MediaListLoadingSpinner } from '../../components/MediaListChips/MediaListLoadingSpinner';
import type { ViewSelectedOption } from '../../components/ViewSelector/ViewSelector';
import { ViewSelector } from '../../components/ViewSelector/ViewSelector';
import { IMAGES } from '../../constants/images';
import { ROUTES } from '../../constants/routes';
import { useAccount } from '../../contexts/Account';
import { useConfig } from '../../contexts/Config';
import { useModals } from '../../contexts/Modals';
import { getApiRequestService } from '../../factories/apiRequestService';
import { useListViewMode } from '../../hooks/useListViewMode';
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

function listImageCandidates(item: DTOAccountRecommendation): string[] {
  return buildDTOChannelImageLoadCandidates(
    item.channel.channel_images,
    IMAGES.LIST.PODCASTS.SIZE_FIND_TARGET,
    'lesser'
  );
}

function RecommendationNodes({
  chip,
  items,
  untitled,
  viewSelected,
}: {
  chip: RecommendationChip;
  items: DTOAccountRecommendation[];
  untitled: string;
  viewSelected: ViewSelectedOption;
}) {
  if (chip === 'albums') {
    return (
      <CommonAlbumListNodes
        items={items.map((item) => ({
          href: showPath(chip, item.channel.id_text),
          id: item.channel.id_text,
          imageCandidates: listImageCandidates(item),
          subtitle: null,
          title: item.channel.title?.trim() || untitled,
        }))}
        viewSelected={viewSelected}
      />
    );
  }

  if (chip === 'artists') {
    return (
      <CommonArtistListNodes
        items={items.map((item) => ({
          href: showPath(chip, item.channel.id_text),
          id: item.channel.id_text,
          imageCandidates: listImageCandidates(item),
          showSubtitle: false,
          title: item.channel.title?.trim() || untitled,
        }))}
        viewSelected={viewSelected}
      />
    );
  }

  return (
    <CommonPodcastListNodes
      items={items.map((item) => ({
        href: showPath(chip, item.channel.id_text),
        id: item.channel.id_text,
        imageCandidates: listImageCandidates(item),
        title: item.channel.title?.trim() || untitled,
      }))}
      viewSelected={viewSelected}
    />
  );
}

export function RecommendationsPageClient({ chip, urlChip }: RecommendationsPageClientProps) {
  const t = useTranslations('features.recommendations');
  const tAuth = useTranslations('authentication');
  const tMisc = useTranslations('misc');
  const router = useRouter();
  const { loggedInAccount } = useAccount();
  const config = useConfig();
  const { setModalAuthLogin } = useModals();
  const { setViewSelected, viewSelected } = useListViewMode(recommendationsListViewModeScope(chip));
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
          <MainColumnStack>
            <MediaListChips
              chips={RECOMMENDATION_CHIPS}
              page="recommendations"
              selected={chip}
              trailing={
                <ViewSelector setViewSelected={setViewSelected} viewSelected={viewSelected} />
              }
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
              <RecommendationNodes
                chip={chip}
                items={items}
                untitled={tMisc('untitled')}
                viewSelected={viewSelected}
              />
            ) : null}
          </MainColumnStack>
        </MainSidebarLayout>
      </MainWrapper>
    </>
  );
}
