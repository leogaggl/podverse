'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useState } from 'react';

import type { DTOAccountTasteProfileChannel } from '@podverse/helpers';
import { buildDTOChannelImageLoadCandidates, formatDateAbbrev } from '@podverse/helpers';
import { Button, Divider, LoadingSpinner, SkeletonFlashImage } from '@podverse/ui';

import { IMAGES } from '../../../../constants/images';
import type { TasteProfileListState } from '../../../../hooks/useTasteProfileLists';
import { useTasteProfileLists } from '../../../../hooks/useTasteProfileLists';
import { SettingsSection } from '../../SettingsSection';
import { ModalTasteProfileUnhide } from './ModalTasteProfileUnhide';

import styles from '../../../../styles/components/Settings/Panels/SettingsAccount/SettingsTasteProfile.module.scss';

type UnhideTarget = { idText: string; title: string };

type ShowRow = { channel: DTOAccountTasteProfileChannel };

export function SettingsTasteProfile() {
  const t = useTranslations('taste_profile');
  const tMisc = useTranslations('misc');
  const tPopularity = useTranslations('popularity_tracking');
  const locale = useLocale();
  const {
    profile,
    hidden,
    pendingChannelIds,
    actionFailed,
    retry,
    loadMoreProfile,
    loadMoreHidden,
    hideShow,
    unhideShow,
  } = useTasteProfileLists();
  const [unhideTarget, setUnhideTarget] = useState<UnhideTarget | null>(null);

  const titleFor = (channel: DTOAccountTasteProfileChannel): string => {
    const trimmed = channel.title?.trim() ?? '';
    return trimmed === '' ? tMisc('untitled') : trimmed;
  };

  const closeUnhideAndRun = (addToTasteProfile: boolean) => {
    if (unhideTarget === null) {
      return;
    }
    const { idText } = unhideTarget;
    setUnhideTarget(null);
    void unhideShow(idText, addToTasteProfile);
  };

  return (
    <>
      <SettingsSection>
        <section aria-labelledby="settings-taste-profile-heading">
          <h3 className={styles.heading} id="settings-taste-profile-heading">
            {t('title')}
          </h3>
          <p className={styles.description}>{t('description')}</p>
          {actionFailed ? (
            <p className={styles.status} role="alert">
              {t('action_error')}
            </p>
          ) : null}
          <TasteProfileListBody
            state={profile}
            loadingLabel={tMisc('loading')}
            loadErrorText={t('load_error')}
            emptyText={t('empty')}
            loadMoreErrorText={t('load_more_error')}
            loadMoreLabel={t('load_more')}
            retryLabel={tPopularity('retry')}
            onRetry={retry}
            onLoadMore={loadMoreProfile}
            renderRow={(row) => {
              const idText = row.channel.id_text;
              const title = titleFor(row.channel);
              return (
                <TasteProfileShowRow
                  key={idText}
                  channel={row.channel}
                  title={title}
                  subtitle={
                    row.last_listened_at === null
                      ? t('added_back')
                      : t('last_listened', { date: formatDateAbbrev(row.last_listened_at, locale) })
                  }
                  actionLabel={t('remove')}
                  actionAccessibleLabel={t('remove_accessible', { title })}
                  disabled={pendingChannelIds.has(idText)}
                  onAction={() => {
                    void hideShow(idText);
                  }}
                />
              );
            }}
          />
        </section>
      </SettingsSection>
      <Divider withSpacing />
      <SettingsSection>
        <section aria-labelledby="settings-taste-profile-hidden-heading">
          <h3 className={styles.heading} id="settings-taste-profile-hidden-heading">
            {t('hidden_title')}
          </h3>
          <p className={styles.description}>{t('hidden_description')}</p>
          <TasteProfileListBody
            state={hidden}
            loadingLabel={tMisc('loading')}
            loadErrorText={t('hidden_load_error')}
            emptyText={t('hidden_empty')}
            loadMoreErrorText={t('load_more_error')}
            loadMoreLabel={t('load_more')}
            retryLabel={tPopularity('retry')}
            onRetry={retry}
            onLoadMore={loadMoreHidden}
            renderRow={(row) => {
              const idText = row.channel.id_text;
              const title = titleFor(row.channel);
              return (
                <TasteProfileShowRow
                  key={idText}
                  channel={row.channel}
                  title={title}
                  subtitle={t('hidden_on', { date: formatDateAbbrev(row.hidden_at, locale) })}
                  actionLabel={t('unhide')}
                  actionAccessibleLabel={t('unhide_accessible', { title })}
                  disabled={pendingChannelIds.has(idText)}
                  onAction={() => {
                    setUnhideTarget({ idText, title });
                  }}
                />
              );
            }}
          />
        </section>
      </SettingsSection>
      <ModalTasteProfileUnhide
        target={unhideTarget}
        onCancel={() => {
          setUnhideTarget(null);
        }}
        onRemoveOnly={() => {
          closeUnhideAndRun(false);
        }}
        onAddBack={() => {
          closeUnhideAndRun(true);
        }}
      />
    </>
  );
}

type TasteProfileListBodyProps<Row extends ShowRow> = {
  state: TasteProfileListState<Row>;
  loadingLabel: string;
  loadErrorText: string;
  emptyText: string;
  loadMoreErrorText: string;
  loadMoreLabel: string;
  retryLabel: string;
  onRetry: () => void;
  onLoadMore: () => void;
  renderRow: (row: Row) => ReactNode;
};

function TasteProfileListBody<Row extends ShowRow>({
  state,
  loadingLabel,
  loadErrorText,
  emptyText,
  loadMoreErrorText,
  loadMoreLabel,
  retryLabel,
  onRetry,
  onLoadMore,
  renderRow,
}: TasteProfileListBodyProps<Row>) {
  if (state.status === 'loading') {
    return <LoadingSpinner ariaLabel={loadingLabel} size="medium" />;
  }
  if (state.status === 'error') {
    return (
      <>
        <p className={styles.status} role="alert">
          {loadErrorText}
        </p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      </>
    );
  }
  if (state.data.rows.length === 0) {
    return <p className={styles.status}>{emptyText}</p>;
  }
  return (
    <>
      <ul className={styles.rows}>{state.data.rows.map((row) => renderRow(row))}</ul>
      {state.loadMoreFailed ? (
        <p className={styles.status} role="alert">
          {loadMoreErrorText}
        </p>
      ) : null}
      {state.data.hasMore ? (
        <Button
          type="button"
          variant="secondary"
          isLoading={state.loadingMore}
          onClick={onLoadMore}
        >
          {loadMoreLabel}
        </Button>
      ) : null}
    </>
  );
}

type TasteProfileShowRowProps = {
  channel: DTOAccountTasteProfileChannel;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionAccessibleLabel: string;
  disabled: boolean;
  onAction: () => void;
};

function TasteProfileShowRow({
  channel,
  title,
  subtitle,
  actionLabel,
  actionAccessibleLabel,
  disabled,
  onAction,
}: TasteProfileShowRowProps) {
  const imageCandidates = buildDTOChannelImageLoadCandidates(
    channel.channel_images,
    IMAGES.PODROLL.SQUARE.SIZE_FIND_TARGET,
    'greater'
  );

  return (
    <li className={styles.row}>
      <SkeletonFlashImage
        className={styles.image}
        candidates={imageCandidates}
        alt={title}
        width={IMAGES.PODROLL.SQUARE.SIZE}
        height={IMAGES.PODROLL.SQUARE.SIZE}
      />
      <div className={styles.text}>
        <div className={styles.title}>{title}</div>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
      <Button
        type="button"
        variant="secondary"
        aria-label={actionAccessibleLabel}
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </li>
  );
}
