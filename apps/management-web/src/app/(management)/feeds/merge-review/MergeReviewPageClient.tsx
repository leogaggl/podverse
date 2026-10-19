'use client';

import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { FormDropdownOption } from '@podverse/ui';
import {
  Alert,
  Breadcrumbs,
  Button,
  FormDropdown,
  FormStack,
  FormTextArea,
  ManagementPageShell,
  Modal,
  ModalActions,
  ModalBody,
  Table,
} from '@podverse/ui';

import { ManagementLoadingSpinnerOverlay } from '../../../../components/LoadingSpinner/ManagementLoadingSpinnerOverlay';
import { canUpdateFeeds } from '../../../../lib/managementPermissions';
import type { CurrentUser } from '../../../../lib/requests/auth';
import type {
  FeedMergeDetail,
  FeedMergeListRow,
  FeedMergeStatus,
  FeedMergeStatusFilter,
} from '../../../../lib/requests/feeds';
import {
  approveFeedMerge,
  getFeedMerge,
  listFeedMerges,
  rejectFeedMerge,
  revertFeedMerge,
} from '../../../../lib/requests/feeds';
import { ROUTES } from '../../../../lib/routes';

type MergeReviewPageClientProps = {
  user: CurrentUser;
};

type MergeAction = 'approve' | 'reject' | 'revert';

const PAGE_SIZE = 25;

const STATUS_FILTERS: FeedMergeStatusFilter[] = [
  'needs_review',
  'detected',
  'verified',
  'applied',
  'rejected',
  'reverted',
  'all',
];

const REJECT_FROM: ReadonlySet<FeedMergeStatus> = new Set([
  'detected',
  'verified',
  'needs_review',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readRequestMessage(error: unknown): string | null {
  if (!isAxiosError(error)) {
    return null;
  }
  const data: unknown = error.response?.data;
  if (!isRecord(data)) {
    return null;
  }
  const message = data.message;
  return typeof message === 'string' && message.trim() !== '' ? message : null;
}

function readStatCount(stats: Record<string, unknown>, key: string): number | null {
  const value = stats[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function formatConfidence(value: string | null, empty: string): string {
  if (value === null || value === '') {
    return empty;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return String(parsed);
}

function showLabel(row: FeedMergeListRow): string {
  return row.from_channel_title ?? String(row.from_podcast_index_id);
}

export function MergeReviewPageClient({ user }: MergeReviewPageClientProps) {
  const t = useTranslations('feedMergeReview');
  const tc = useTranslations('common');
  const tHub = useTranslations('feedsHub');
  const tNav = useTranslations('nav');
  const canUpdate = canUpdateFeeds(user);

  const [status, setStatus] = useState<FeedMergeStatusFilter>('needs_review');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [merges, setMerges] = useState<FeedMergeListRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<FeedMergeDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await listFeedMerges({ status, page, limit: PAGE_SIZE });
        if (!cancelled) {
          setMerges(result.merges);
          setTotalPages(result.pagination.totalPages);
        }
      } catch {
        if (!cancelled) {
          setLoadError(t('loadError'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [status, page, refresh, t]);

  const statusOptions: FormDropdownOption[] = STATUS_FILTERS.map((value) => ({
    value,
    label: statusLabel(value),
  }));

  function statusLabel(value: FeedMergeStatusFilter): string {
    switch (value) {
      case 'needs_review':
        return t('statusNeedsReview');
      case 'detected':
        return t('statusDetected');
      case 'verified':
        return t('statusVerified');
      case 'applied':
        return t('statusApplied');
      case 'rejected':
        return t('statusRejected');
      case 'reverted':
        return t('statusReverted');
      case 'all':
        return t('statusAll');
    }
  }

  function modeLabel(mode: FeedMergeListRow['mode']): string {
    if (mode === 'repoint') {
      return t('modeRepoint');
    }
    if (mode === 'absorb') {
      return t('modeAbsorb');
    }
    return t('emptyValue');
  }

  function tierLabel(tier: FeedMergeDetail['item_pairs'][number]['match_tier']): string {
    if (tier === 'guid') {
      return t('tierGuid');
    }
    if (tier === 'enclosure') {
      return t('tierEnclosure');
    }
    if (tier === 'fuzzy') {
      return t('tierFuzzy');
    }
    return t('emptyValue');
  }

  function lifecycleLabel(key: string | null): string {
    if (key === null || key === '') {
      return t('emptyValue');
    }
    if (key === 'active') {
      return t('lifecycleActive');
    }
    if (key === 'merged') {
      return t('lifecycleMerged');
    }
    return t('lifecycleOther', { state: key });
  }

  async function openDetail(id: number) {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setActionError(null);
    setNote('');
    setConfirmOpen(false);
    try {
      const result = await getFeedMerge(id);
      setDetail(result.merge);
      setNote(result.merge.note ?? '');
    } catch (error: unknown) {
      setDetailError(readRequestMessage(error) ?? t('loadError'));
    }
  }

  function closeDetail() {
    if (pending) {
      return;
    }
    setDetailOpen(false);
    setConfirmOpen(false);
  }

  async function runAction(action: MergeAction) {
    if (detail === null || !canUpdate) {
      return;
    }
    setActionError(null);
    setPending(true);
    const body = { note: note.trim() === '' ? null : note.trim() };
    try {
      const result =
        action === 'approve'
          ? await approveFeedMerge(detail.id, body)
          : action === 'reject'
            ? await rejectFeedMerge(detail.id, body)
            : await revertFeedMerge(detail.id, body);
      setDetail(result.merge);
      setNote(result.merge.note ?? '');
      setConfirmOpen(false);
      setRefresh((current) => current + 1);
      if (action !== 'revert') {
        setDetailOpen(false);
      }
    } catch (error: unknown) {
      setActionError(readRequestMessage(error) ?? t('actionError'));
    } finally {
      setPending(false);
    }
  }

  const fromLabel =
    detail === null ? '' : (detail.from_channel_title ?? String(detail.from_podcast_index_id));
  const approveEnabled = canUpdate && detail !== null && detail.status === 'needs_review' && !pending;
  const rejectEnabled =
    canUpdate && detail !== null && REJECT_FROM.has(detail.status) && !pending;
  const revertEnabled = canUpdate && detail !== null && detail.status === 'applied' && !pending;
  const matched =
    detail === null ? null : readStatCount(detail.match_stats, 'matched');
  const oldCount =
    detail === null ? null : readStatCount(detail.match_stats, 'oldCount');
  const survivorCount =
    detail === null ? null : readStatCount(detail.match_stats, 'survivorCount');

  return (
    <ManagementPageShell
      headerBreadcrumbs={
        <Breadcrumbs
          LinkComponent={Link}
          navAriaLabel={tc('breadcrumbNav')}
          items={[
            { href: ROUTES.DASHBOARD, label: tNav('dashboard') },
            { href: ROUTES.FEEDS, label: tHub('pageTitle') },
            { label: t('pageTitle') },
          ]}
        />
      }
      title={t('pageTitle')}
    >
      <ManagementLoadingSpinnerOverlay isLoading={loading} />
      {loadError !== null ? <Alert>{loadError}</Alert> : null}
      <FormStack>
        <FormDropdown
          eyebrow={t('filterStatus')}
          id="feed-merge-review-status"
          options={statusOptions}
          value={status}
          onChange={(value) => {
            if (isStatusFilter(value)) {
              setStatus(value);
              setPage(1);
            }
          }}
        />
        {!loading && loadError === null && merges.length === 0 ? <p>{t('empty')}</p> : null}
        {merges.length > 0 ? (
          <Table.ScrollContainer>
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>{t('columnFrom')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnTo')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnPodcastIndex')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnConfidence')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnMode')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnStatus')}</Table.HeaderCell>
                  <Table.HeaderCell>{tc('actions')}</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {merges.map((row) => {
                  const label = showLabel(row);
                  return (
                    <Table.Row key={row.id}>
                      <Table.Cell>{row.from_channel_title ?? t('emptyValue')}</Table.Cell>
                      <Table.Cell>{row.to_channel_title ?? t('emptyValue')}</Table.Cell>
                      <Table.Cell>
                        {row.from_podcast_index_id} → {row.to_podcast_index_id}
                      </Table.Cell>
                      <Table.Cell>{formatConfidence(row.confidence, t('emptyValue'))}</Table.Cell>
                      <Table.Cell>{modeLabel(row.mode)}</Table.Cell>
                      <Table.Cell>{statusLabel(row.status)}</Table.Cell>
                      <Table.Cell>
                        <Button
                          aria-label={t('reviewNamed', { title: label })}
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            void openDetail(row.id);
                          }}
                        >
                          {t('review')}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </Table.ScrollContainer>
        ) : null}
        {totalPages > 1 ? (
          <div>
            <Button
              disabled={page <= 1 || loading}
              type="button"
              variant="secondary"
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
              }}
            >
              {tc('paginationPrevButton')}
            </Button>
            <span>{tc('paginationPageOf', { currentPage: page, totalPages })}</span>
            <Button
              disabled={page >= totalPages || loading}
              type="button"
              variant="secondary"
              onClick={() => {
                setPage((current) => current + 1);
              }}
            >
              {tc('paginationNextButton')}
            </Button>
          </div>
        ) : null}
      </FormStack>
      <Modal
        ariaLabel={t('detailTitle')}
        closeButtonAriaLabel={tc('closeModalAria')}
        header={t('detailTitle')}
        isOpen={detailOpen}
        modalContentMaxWidth={720}
        onClose={closeDetail}
      >
        <ModalBody>
          {detailError !== null ? <Alert>{detailError}</Alert> : null}
          {actionError !== null ? <Alert>{actionError}</Alert> : null}
          {detail !== null ? (
            <FormStack>
              <p>
                {detail.from_channel_title ?? t('emptyValue')} →{' '}
                {detail.to_channel_title ?? t('emptyValue')}
              </p>
              <p>{statusLabel(detail.status)}</p>
              <p>
                {t('lifecycleLabel')}{' '}
                <span>{lifecycleLabel(detail.from_feed_lifecycle_state_key)}</span>
              </p>
              {matched !== null && oldCount !== null && survivorCount !== null ? (
                <p>{t('statsLine', { matched, oldCount, survivorCount })}</p>
              ) : null}
              {detail.item_pairs.length > 0 ? (
                <>
                  <p>{t('pairsHeading')}</p>
                  <Table.ScrollContainer>
                    <Table>
                      <Table.Head>
                        <Table.Row>
                          <Table.HeaderCell>{t('columnOldTitle')}</Table.HeaderCell>
                          <Table.HeaderCell>{t('columnSurvivorTitle')}</Table.HeaderCell>
                          <Table.HeaderCell>{t('columnTier')}</Table.HeaderCell>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        {detail.item_pairs.map((pair, index) => (
                          <Table.Row key={`${pair.from_title ?? ''}-${pair.to_title ?? ''}-${index}`}>
                            <Table.Cell>{pair.from_title ?? t('emptyValue')}</Table.Cell>
                            <Table.Cell>{pair.to_title ?? t('emptyValue')}</Table.Cell>
                            <Table.Cell>{tierLabel(pair.match_tier)}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  </Table.ScrollContainer>
                </>
              ) : null}
              <FormTextArea
                disabled={!canUpdate || pending}
                eyebrow={t('note')}
                id="feed-merge-review-note"
                maxLength={2000}
                rows={3}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
              />
            </FormStack>
          ) : null}
        </ModalBody>
        {detail !== null && canUpdate ? (
          <ModalActions>
            <Button
              aria-label={t('approveNamed', { title: fromLabel })}
              disabled={!approveEnabled}
              isLoading={pending}
              type="button"
              variant="primary"
              onClick={() => {
                void runAction('approve');
              }}
            >
              {t('approve')}
            </Button>
            <Button
              aria-label={t('rejectNamed', { title: fromLabel })}
              disabled={!rejectEnabled}
              type="button"
              variant="secondary"
              onClick={() => {
                void runAction('reject');
              }}
            >
              {t('reject')}
            </Button>
            <Button
              aria-label={t('revertNamed', { title: fromLabel })}
              disabled={!revertEnabled}
              type="button"
              variant="danger"
              onClick={() => {
                setConfirmOpen(true);
              }}
            >
              {t('revert')}
            </Button>
          </ModalActions>
        ) : null}
      </Modal>
      <Modal
        ariaLabel={t('revertConfirmTitle')}
        closeButtonAriaLabel={tc('closeModalAria')}
        header={t('revertConfirmTitle')}
        isOpen={confirmOpen}
        onClose={() => {
          if (!pending) {
            setConfirmOpen(false);
          }
        }}
      >
        <ModalBody>
          <p>{t('revertConfirmBody')}</p>
        </ModalBody>
        <ModalActions>
          <Button
            disabled={pending}
            type="button"
            variant="secondary"
            onClick={() => {
              setConfirmOpen(false);
            }}
          >
            {tc('cancel')}
          </Button>
          <Button
            disabled={!revertEnabled}
            isLoading={pending}
            type="button"
            variant="danger"
            onClick={() => {
              void runAction('revert');
            }}
          >
            {t('revert')}
          </Button>
        </ModalActions>
      </Modal>
    </ManagementPageShell>
  );
}

function isStatusFilter(value: string): value is FeedMergeStatusFilter {
  return (
    value === 'needs_review' ||
    value === 'detected' ||
    value === 'verified' ||
    value === 'applied' ||
    value === 'rejected' ||
    value === 'reverted' ||
    value === 'all'
  );
}
