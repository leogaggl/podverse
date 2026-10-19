/**
 * Fetch request cache mode (standard Fetch API).
 * Defined here so it is available without DOM lib.
 */
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

import { injectTraceContext, isObservabilityInitialized } from '@podverse/observability';

export type RequestCache =
  'default' | 'force-cache' | 'no-cache' | 'no-store' | 'reload' | 'only-if-cached';

export type FetchWithTimeoutOptions = {
  body?: string;
  cache?: RequestCache;
  headers?: Record<string, string>;
  method?: string;
  timeoutMs?: number;
  /**
   * When set to a non-negative finite number, the returned body contains at most this many
   * bytes. The rest of the response is discarded.
   */
  maxBodyBytes?: number;
};

const TRACER_NAME = 'podverse.helpers-backend.http';

function hasBodyCap(maxBodyBytes: number | undefined): maxBodyBytes is number {
  return typeof maxBodyBytes === 'number' && Number.isFinite(maxBodyBytes) && maxBodyBytes >= 0;
}

async function readAtMost(response: Response, maxBodyBytes: number): Promise<Uint8Array> {
  const body = response.body;
  if (body === null) {
    const full = new Uint8Array(await response.arrayBuffer());
    return full.subarray(0, maxBodyBytes);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < maxBodyBytes) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      const room = maxBodyBytes - received;
      const piece = next.value.byteLength > room ? next.value.subarray(0, room) : next.value;
      chunks.push(piece);
      received += piece.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {
      // The unread remainder is discarded. Cancel after a finished stream is a no-op.
    });
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function limitResponseBody(
  response: Response,
  maxBodyBytes: number | undefined
): Promise<Response> {
  if (!hasBodyCap(maxBodyBytes)) {
    return response;
  }
  const bytes = await readAtMost(response, maxBodyBytes);
  // The bytes are already decoded. Leaving content-encoding on the new response makes text()
  // try to decode them again.
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  return new Response(bytes, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

const fetchWithInjectedHeaders = async (
  url: string,
  options: FetchWithTimeoutOptions | undefined
): Promise<Response> => {
  const { body, cache, headers: inputHeaders, method = 'GET', timeoutMs } = options ?? {};
  const headers: Record<string, string> = { ...inputHeaders };
  injectTraceContext(headers);

  const controller = new AbortController();
  const timeoutId =
    timeoutMs !== undefined && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  try {
    const response = await fetch(url, {
      body,
      cache,
      headers,
      method,
      signal: controller.signal,
    });
    return response;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};

/**
 * Fetches a URL with an optional timeout. Uses native fetch (Node 18+).
 * If timeoutMs is set, the request is aborted after that many milliseconds.
 * Injects W3C trace context when observability is initialized.
 */
export async function fetchWithTimeout(
  url: string,
  options?: FetchWithTimeoutOptions
): Promise<Response> {
  if (!isObservabilityInitialized()) {
    return limitResponseBody(await fetchWithInjectedHeaders(url, options), options?.maxBodyBytes);
  }

  const method = options?.method ?? 'GET';
  let host = 'unknown';
  try {
    host = new URL(url).host;
  } catch {
    // Relative URLs are uncommon here; span name still identifies the call.
  }

  const tracer = trace.getTracer(TRACER_NAME);
  return tracer.startActiveSpan(`${method} ${host}`, { kind: SpanKind.CLIENT }, async (span) => {
    span.setAttribute('http.method', method);
    span.setAttribute('http.url', url);
    try {
      const response = await fetchWithInjectedHeaders(url, options);
      span.setAttribute('http.response.status_code', response.status);
      if (response.status >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      return await limitResponseBody(response, options?.maxBodyBytes);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}
