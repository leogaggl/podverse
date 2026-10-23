'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DTOAccountNotification, NotificationCategoryValues } from '@podverse/helpers';
import {
  ACCOUNT_NOTIFICATION_STREAM_EVENT,
  getRelativeTimeParts,
  resolveNotificationDestinationFromPayload,
} from '@podverse/helpers';
import { MainHeader } from '@podverse/ui';

import { MainWrapper } from '../../components/Main/MainWrapper';
import { Pagination } from '../../components/Pagination/Pagination';
import { ROUTES } from '../../constants/routes';
import { useNotifications } from '../../contexts/Notifications';
import { getApiRequestService } from '../../factories/apiRequestService';
import { emitNotificationsReadEvent } from '../../hooks/useNotificationsUnreadCount';
import { insertLiveNotificationRow } from './notificationsInboxRows';

import styles from './NotificationsPage.module.scss';

type NotificationsListState = {
  items: DTOAccountNotification[];
  page: number;
  totalPages: number;
};

const INITIAL_STATE: NotificationsListState = {
  items: [],
  page: 1,
  totalPages: 0,
};

type NotificationListLoadResult =
  | { status: 'applied'; requestId: number }
  | { status: 'failed'; requestId: number }
  | { status: 'stale' };

const CATEGORY_LABEL_KEYS: Record<NotificationCategoryValues, string> = {
  'new-content': 'category_new_content',
  livestream: 'category_livestream',
  'product-update': 'category_product_update',
  maintenance: 'category_maintenance',
  'terms-of-service': 'category_terms_of_service',
  general: 'category_general',
};

function getRelativeTimeLabel(isoDate: string): string {
  const parts = getRelativeTimeParts(isoDate);
  if (parts === null) {
    return '';
  }

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  return formatter.format(parts.value, parts.unit);
}

function mergeLiveRows(
  items: DTOAccountNotification[],
  liveRows: DTOAccountNotification[]
): DTOAccountNotification[] {
  let nextItems = items;
  for (const liveRow of liveRows) {
    nextItems = insertLiveNotificationRow(nextItems, liveRow);
  }
  return nextItems;
}

export function NotificationsPageClient() {
  const tNotifications = useTranslations('notifications_page');
  const { subscribeToNotificationStream } = useNotifications();
  const [state, setState] = useState<NotificationsListState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const liveRowsRef = useRef<DTOAccountNotification[]>([]);
  const pendingMarkIdsRef = useRef<Set<number>>(new Set());
  const markingIdsRef = useRef<Set<number>>(new Set());
  const pageRef = useRef(INITIAL_STATE.page);
  const listRequestIdRef = useRef(0);
  const isPageActiveRef = useRef(true);

  const loadPage = useCallback(async (page: number): Promise<NotificationListLoadResult> => {
    const requestId = ++listRequestIdRef.current;
    try {
      const data = await getApiRequestService().reqNotificationsList({ page, limit: 20 });
      if (requestId !== listRequestIdRef.current || !isPageActiveRef.current) {
        return { status: 'stale' };
      }
      pageRef.current = data.pagination.page;
      setState({
        items: data.items,
        page: data.pagination.page,
        totalPages: data.pagination.total_pages,
      });
      return { status: 'applied', requestId };
    } catch {
      if (requestId !== listRequestIdRef.current || !isPageActiveRef.current) {
        return { status: 'stale' };
      }
      // The page keeps the last list it showed. The next load replaces it.
      return { status: 'failed', requestId };
    }
  }, []);

  const markLiveRowsRead = useCallback(() => {
    if (document.visibilityState !== 'visible') {
      return;
    }

    const pendingIds = pendingMarkIdsRef.current;
    const markingIds = markingIdsRef.current;
    for (const id of pendingIds) {
      if (markingIds.has(id)) {
        pendingIds.delete(id);
        continue;
      }
      pendingIds.delete(id);
      markingIds.add(id);
      void getApiRequestService()
        .reqNotificationsMarkReadOne(id)
        .catch(() => {
          // A missing row or a failed request leaves the badge to the next stream event or poll.
        })
        .finally(() => {
          markingIds.delete(id);
        });
    }
  }, []);

  useEffect(() => {
    isPageActiveRef.current = true;
    let cancelled = false;

    const loadFirstPageAndMarkRead = async () => {
      setIsLoading(true);
      const result = await loadPage(1);
      if (
        !cancelled &&
        result.status === 'applied' &&
        result.requestId === listRequestIdRef.current &&
        pageRef.current === 1
      ) {
        const appliedRequestId = result.requestId;
        setState((current) => {
          if (appliedRequestId !== listRequestIdRef.current || current.page !== 1) {
            return current;
          }
          const items = mergeLiveRows(current.items, liveRowsRef.current);
          if (items === current.items) {
            return current;
          }
          return { ...current, items };
        });
      }

      try {
        await getApiRequestService().reqNotificationsMarkRead();
        emitNotificationsReadEvent();
      } catch {
        // The loaded list stays visible when Mark All as Read fails.
      }

      if (
        !cancelled &&
        result.status !== 'stale' &&
        result.requestId === listRequestIdRef.current
      ) {
        setIsLoading(false);
      }
    };

    void loadFirstPageAndMarkRead();

    const unsubscribe = subscribeToNotificationStream((event) => {
      if (event.type === ACCOUNT_NOTIFICATION_STREAM_EVENT.created) {
        const row = event.data.notification;
        liveRowsRef.current = insertLiveNotificationRow(liveRowsRef.current, row);
        if (pageRef.current === 1) {
          setState((current) => ({
            ...current,
            items: insertLiveNotificationRow(current.items, row),
          }));
        }
        pendingMarkIdsRef.current.add(row.id);
        markLiveRowsRead();
        return;
      }

      if (event.type === ACCOUNT_NOTIFICATION_STREAM_EVENT.resync && pageRef.current === 1) {
        void loadFirstPageAndMarkRead();
      }
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markLiveRowsRead();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      isPageActiveRef.current = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadPage, markLiveRowsRead, subscribeToNotificationStream]);

  const onPageChange = async (page: number) => {
    setIsLoading(true);
    const result = await loadPage(page);
    if (result.status !== 'stale' && result.requestId === listRequestIdRef.current) {
      setIsLoading(false);
    }
  };

  // A row stays in the section it had when it arrived. Read events update the badge and do not
  // move rows between Unread and Earlier during this visit.
  const partitionedRows = useMemo(() => {
    const unreadRows: DTOAccountNotification[] = [];
    const earlierRows: DTOAccountNotification[] = [];
    for (const item of state.items) {
      if (item.is_unread) {
        unreadRows.push(item);
      } else {
        earlierRows.push(item);
      }
    }
    return { unreadRows, earlierRows };
  }, [state.items]);

  return (
    <>
      <MainHeader title={tNotifications('title')} />
      <MainWrapper>
        <div className={styles.listWrapper}>
          <p className={styles.recentActivityNote}>{tNotifications('recent_activity_note')}</p>
          {isLoading ? <p className={styles.empty}>{tNotifications('loading')}</p> : null}
          {!isLoading && state.items.length === 0 ? (
            <p className={styles.empty}>{tNotifications('empty')}</p>
          ) : null}

          {!isLoading && state.items.length > 0 ? (
            <Pagination
              currentPage={state.page}
              setPage={onPageChange}
              totalPages={state.totalPages}
            >
              <div className={styles.rows}>
                {partitionedRows.unreadRows.length > 0 ? (
                  <h2 className={styles.sectionHeading}>{tNotifications('unread_section')}</h2>
                ) : null}
                {partitionedRows.unreadRows.map((row) => (
                  <NotificationRow key={row.id} row={row} />
                ))}

                {partitionedRows.earlierRows.length > 0 ? (
                  <h2 className={styles.sectionHeading}>{tNotifications('earlier_section')}</h2>
                ) : null}
                {partitionedRows.earlierRows.map((row) => (
                  <NotificationRow key={row.id} row={row} />
                ))}
              </div>
            </Pagination>
          ) : null}
        </div>
      </MainWrapper>
    </>
  );

  function NotificationRow({ row }: { row: DTOAccountNotification }) {
    const categoryKey = CATEGORY_LABEL_KEYS[row.category];
    const destination = resolveNotificationDestinationFromPayload({
      ...(row.payload ?? {}),
      link_path: row.link_path,
    });
    const linkPath = destination.kind === 'home' ? ROUTES.NOTIFICATIONS : destination.webPath;

    return (
      <article className={styles.row}>
        <div className={styles.rowTop}>
          <span className={styles.categoryPill}>{tNotifications(categoryKey)}</span>
          <span className={styles.timeText}>{getRelativeTimeLabel(row.created_at)}</span>
        </div>
        <h3 className={styles.title}>
          <Link href={linkPath}>{row.title}</Link>
        </h3>
        <p className={styles.body}>
          {row.body !== null && row.body !== '' ? row.body : tNotifications('no_body')}
        </p>
      </article>
    );
  }
}
