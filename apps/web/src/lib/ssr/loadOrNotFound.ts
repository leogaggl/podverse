import { notFound } from 'next/navigation';

import { getErrorResponseStatus } from '@podverse/helpers';

/**
 * Server boundary for the entity a detail route renders. An API 404 renders the route's
 * not-found page. Every other failure, including 5xx, network, and auth errors and Next.js
 * navigation signals thrown inside `load`, propagates unchanged.
 */
export async function loadOrNotFound<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (getErrorResponseStatus(error) === 404) {
      notFound();
    }
    throw error;
  }
}
