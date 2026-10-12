'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

import type { DTOBillingStrikeCheckout } from '@podverse/helpers';
import { formatHHMMSS } from '@podverse/helpers';
import { Button, LoadingSpinner } from '@podverse/ui';

import { ROUTES } from '../../constants/routes';
import { getApiRequestService } from '../../factories/apiRequestService';

import styles from '../../styles/app/checkout/Checkout.module.scss';

/** The checkout poll route allows one request per account every 2 seconds. */
const STRIKE_CHECKOUT_POLL_MS = 3000;

type CheckoutStrikePanelProps = {
  onError: () => void;
  onRenew: () => void;
  processorProductId: number;
};

function formatCheckoutAmount(amount: string, currencyCode: string, locale: string): string {
  const value = Number(amount);
  const code = currencyCode.trim();
  if (!Number.isFinite(value) || code === '') {
    return amount.trim();
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

function isInvoiceExpired(checkout: DTOBillingStrikeCheckout, now: number): boolean {
  if (checkout.state === 'expired') {
    return true;
  }
  const expiresAt = new Date(checkout.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

/**
 * Black modules on a white field stay readable to a camera in either theme.
 * The colors live in the SVG, not in the page palette.
 */
async function lightningInvoiceQr(bolt11: string): Promise<string> {
  const svg = await QRCode.toString(bolt11, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
  if (typeof svg !== 'string' || svg === '') {
    throw new Error('Lightning invoice QR was not created');
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function CheckoutStrikePanel({
  onError,
  onRenew,
  processorProductId,
}: CheckoutStrikePanelProps) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const onErrorRef = useRef(onError);
  const routerRef = useRef(router);
  onErrorRef.current = onError;
  routerRef.current = router;

  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(true);
  const [checkout, setCheckout] = useState<DTOBillingStrikeCheckout | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const checkoutRef = useRef(checkout);
  checkoutRef.current = checkout;

  useEffect(() => {
    let cancelled = false;
    setCreating(true);
    setCheckout(null);
    setQrUrl(null);
    setCopied(false);
    const create = async () => {
      try {
        const created = await getApiRequestService().reqBillingStrikeCreateCheckout({
          processorProductId,
        });
        if (!cancelled) {
          setCheckout(created);
          setCreating(false);
        }
      } catch {
        if (!cancelled) {
          setCreating(false);
          onErrorRef.current();
        }
      }
    };
    void create();
    return () => {
      cancelled = true;
    };
  }, [attempt, processorProductId]);

  useEffect(() => {
    const checkoutId = checkout?.checkout_id;
    if (checkoutId === undefined) {
      return;
    }
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finished = (): boolean => {
      const current = checkoutRef.current;
      if (current === null || current.checkout_id !== checkoutId) {
        return true;
      }
      return current.state === 'settled' || isInvoiceExpired(current, Date.now());
    };

    const schedule = () => {
      if (cancelled || finished() || document.visibilityState === 'hidden') {
        return;
      }
      timer = setTimeout(() => {
        void poll();
      }, STRIKE_CHECKOUT_POLL_MS);
    };

    const poll = async () => {
      if (cancelled || finished() || document.visibilityState === 'hidden' || inFlight) {
        return;
      }
      inFlight = true;
      try {
        const next = await getApiRequestService().reqBillingStrikeGetCheckout(checkoutId);
        if (cancelled || next.checkout_id !== checkoutId) {
          return;
        }
        setCheckout(next);
        if (next.state === 'settled') {
          routerRef.current.push(ROUTES.CHECKOUT_SUCCESS);
          return;
        }
        if (isInvoiceExpired(next, Date.now())) {
          return;
        }
      } catch {
        // The next interval asks again. A hidden tab does not poll.
      } finally {
        inFlight = false;
      }
      schedule();
    };

    const onVisibility = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (document.visibilityState === 'visible') {
        void poll();
      }
    };

    void poll();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkout?.checkout_id]);

  useEffect(() => {
    if (checkout === null) {
      return;
    }
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [checkout?.checkout_id]);

  useEffect(() => {
    const bolt11 = checkout?.bolt11;
    if (bolt11 === undefined || bolt11 === '') {
      return;
    }
    let cancelled = false;
    const draw = async () => {
      try {
        const url = await lightningInvoiceQr(bolt11);
        if (!cancelled) {
          setQrUrl(url);
        }
      } catch {
        if (!cancelled) {
          onErrorRef.current();
        }
      }
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [checkout?.bolt11]);

  const expired = checkout !== null && isInvoiceExpired(checkout, now);
  const pending = checkout !== null && checkout.state === 'pending' && !expired;
  let statusMessage = '';
  if (expired) {
    statusMessage = t('invoice_expired');
  } else if (pending) {
    statusMessage = t('payment_detected');
  } else if (copied) {
    statusMessage = t('invoice_copied');
  }

  const copyInvoice = async () => {
    if (checkout === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(checkout.bolt11);
      setCopied(true);
    } catch {
      onErrorRef.current();
    }
  };

  const expiresMs = checkout === null ? Number.NaN : new Date(checkout.expires_at).getTime();
  const remainingSeconds = Number.isFinite(expiresMs)
    ? Math.max(0, Math.ceil((expiresMs - now) / 1000))
    : 0;

  return (
    <section
      aria-busy={creating}
      aria-labelledby="checkout-strike-title"
      className={styles.strikePanel}
      data-testid="checkout-strike"
    >
      <h2 className={styles.strikeTitle} id="checkout-strike-title">
        {t('lightning_invoice')}
      </h2>
      {creating ? <LoadingSpinner decorative size="medium" /> : null}
      {checkout !== null && !expired ? (
        <>
          {qrUrl !== null ? (
            <img alt={t('lightning_invoice_qr')} className={styles.strikeQr} src={qrUrl} />
          ) : null}
          <p className={styles.strikeAmount}>
            {formatCheckoutAmount(checkout.amount, checkout.currency_code, locale)}
          </p>
          <p className={styles.strikeCountdown}>
            {t('invoice_expires_in', { time: formatHHMMSS(remainingSeconds) })}
          </p>
          <div className={styles.strikeActions}>
            <Button
              onClick={() => {
                void copyInvoice();
              }}
              type="button"
              variant="primary"
            >
              {t('copy_invoice')}
            </Button>
            <a className={styles.walletLink} href={`lightning:${checkout.bolt11}`}>
              {t('open_wallet')}
            </a>
          </div>
        </>
      ) : null}
      <p aria-live="polite" className={styles.strikeStatus}>
        {statusMessage}
      </p>
      {expired ? (
        <Button
          onClick={() => {
            onRenew();
            setAttempt((current) => current + 1);
          }}
          type="button"
          variant="primary"
        >
          {t('get_a_new_invoice')}
        </Button>
      ) : null}
    </section>
  );
}
