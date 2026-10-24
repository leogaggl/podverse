'use client';

import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { formatDateTimeAbbrevOrFallback } from '@podverse/helpers';
import type { FormDropdownOption } from '@podverse/ui';
import {
  Alert,
  Breadcrumbs,
  Button,
  FormDropdown,
  FormStack,
  LeadParagraph,
  ManagementPageShell,
  Modal,
  ModalActions,
  ModalBody,
  Pagination,
  Table,
} from '@podverse/ui';

import { ManagementLoadingSpinnerOverlay } from '../../../../components/LoadingSpinner/ManagementLoadingSpinnerOverlay';
import { canUpdateStats } from '../../../../lib/managementPermissions';
import type { CurrentUser } from '../../../../lib/requests/auth';
import type {
  StatsFlaggedListenerRow,
  StatsFlaggedListenerStatus,
} from '../../../../lib/requests/stats';
import {
  reqStatsFlaggedListenerClear,
  reqStatsFlaggedListeners,
} from '../../../../lib/requests/stats';
import { ROUTES } from '../../../../lib/routes';

type FlaggedListenersPageClientProps = {
  user: CurrentUser;
};

const PAGE_SIZE = 25;

const STATUS_FILTERS: StatsFlaggedListenerStatus[] = ['active', 'cleared', 'all'];

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

function isStatusFilter(value: string): value is StatsFlaggedListenerStatus {
  return value === 'active' || value === 'cleared' || value === 'all';
}

export function FlaggedListenersPageClient({ user }: FlaggedListenersPageClientProps) {
  const t = useTranslations('statsFlaggedListeners');
  const tc = useTranslations('common');
  const tNav = useTranslations('nav');
  const tStats = useTranslations('statsPage');
  const locale = useLocale();
  const canClear = canUpdateStats(user);

  const [status, setStatus] = useState<StatsFlaggedListenerStatus>('active');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<StatsFlaggedListenerRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<StatsFlaggedListenerRow | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await reqStatsFlaggedListeners(status, page, PAGE_SIZE);
        if (!cancelled) {
          setRows(result.rows);
          setTotalPages(Math.max(1, Math.ceil(result.total / PAGE_SIZE)));
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

  function statusLabel(value: StatsFlaggedListenerStatus): string {
    switch (value) {
      case 'active':
        return t('statusActive');
      case 'cleared':
        return t('statusCleared');
      case 'all':
        return t('statusAll');
    }
  }

  function reasonLabel(reason: StatsFlaggedListenerRow['reason']): string {
    switch (reason) {
      case 'stored_cap_reached':
        return t('reasonStoredCapReached');
      case 'too_soon_minutes':
        return t('reasonTooSoonMinutes');
    }
  }

  const statusOptions: FormDropdownOption[] = STATUS_FILTERS.map((value) => ({
    value,
    label: statusLabel(value),
  }));

  async function clearFlag() {
    if (confirmRow === null || !canClear || pending) {
      return;
    }
    const id = confirmRow.id;
    setPending(true);
    try {
      await reqStatsFlaggedListenerClear(id);
      setConfirmRow(null);
      setRefresh((current) => current + 1);
    } catch (error: unknown) {
      setActionError(readRequestMessage(error) ?? t('actionError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <ManagementPageShell
      headerBreadcrumbs={
        <Breadcrumbs
          LinkComponent={Link}
          navAriaLabel={tc('breadcrumbNav')}
          items={[
            { href: ROUTES.DASHBOARD, label: tNav('dashboard') },
            { href: ROUTES.STATS, label: tStats('title') },
            { label: t('pageTitle') },
          ]}
        />
      }
      title={t('pageTitle')}
    >
      <LeadParagraph>{t('intro')}</LeadParagraph>
      <ManagementLoadingSpinnerOverlay isLoading={loading} />
      {loadError !== null ? <Alert>{loadError}</Alert> : null}
      <FormStack>
        <FormDropdown
          eyebrow={t('filterStatus')}
          id="stats-flagged-listeners-status"
          options={statusOptions}
          value={status}
          onChange={(value) => {
            if (isStatusFilter(value)) {
              setStatus(value);
              setPage(1);
            }
          }}
        />
        {!loading && loadError === null && rows.length === 0 ? <p>{t('empty')}</p> : null}
        {rows.length > 0 ? (
          <Table.ScrollContainer>
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>{t('columnListener')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnReason')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnFlagged')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnTimesFlagged')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnListens')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnOpens')}</Table.HeaderCell>
                  <Table.HeaderCell>{t('columnStatus')}</Table.HeaderCell>
                  <Table.HeaderCell>{tc('actions')}</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {rows.map((row) => {
                  const listenerLabel = row.listener_id.slice(0, 8);
                  return (
                    <Table.Row key={row.id}>
                      <Table.Cell>
                        <code title={row.listener_id}>{listenerLabel}</code>
                      </Table.Cell>
                      <Table.Cell>{reasonLabel(row.reason)}</Table.Cell>
                      <Table.Cell>
                        {formatDateTimeAbbrevOrFallback(row.flagged_at, locale, t('emptyValue'))}
                      </Table.Cell>
                      <Table.Cell>{row.times_flagged.toLocaleString(locale)}</Table.Cell>
                      <Table.Cell>{row.listens_last_7_days.toLocaleString(locale)}</Table.Cell>
                      <Table.Cell>{row.opens_last_7_days.toLocaleString(locale)}</Table.Cell>
                      <Table.Cell>
                        {row.cleared_at === null
                          ? t('statusActive')
                          : t('clearedOn', {
                              date: formatDateTimeAbbrevOrFallback(
                                row.cleared_at,
                                locale,
                                t('emptyValue')
                              ),
                            })}
                      </Table.Cell>
                      <Table.Cell>
                        {canClear && row.cleared_at === null ? (
                          <Button
                            aria-label={t('clearNamed', { listener: listenerLabel })}
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setActionError(null);
                              setConfirmRow(row);
                            }}
                          >
                            {t('clear')}
                          </Button>
                        ) : null}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </Table.ScrollContainer>
        ) : null}
        {totalPages > 1 ? (
          <Pagination
            currentPage={page}
            nextLabel={tc('paginationNextButton')}
            pageIndicatorLabel={tc('paginationPageOf', { currentPage: page, totalPages })}
            prevLabel={tc('paginationPrevButton')}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </FormStack>
      <Modal
        ariaLabel={t('clearConfirmTitle')}
        closeButtonAriaLabel={tc('closeModalAria')}
        header={t('clearConfirmTitle')}
        isOpen={confirmRow !== null}
        onClose={() => {
          if (!pending) {
            setConfirmRow(null);
          }
        }}
      >
        <ModalBody>
          {actionError !== null ? <Alert>{actionError}</Alert> : null}
          <p>{t('clearConfirmBody')}</p>
        </ModalBody>
        <ModalActions>
          <Button
            disabled={pending}
            type="button"
            variant="secondary"
            onClick={() => {
              if (!pending) {
                setConfirmRow(null);
              }
            }}
          >
            {tc('cancel')}
          </Button>
          <Button
            isLoading={pending}
            type="button"
            variant="primary"
            onClick={() => {
              void clearFlag();
            }}
          >
            {t('clear')}
          </Button>
        </ModalActions>
      </Modal>
    </ManagementPageShell>
  );
}
