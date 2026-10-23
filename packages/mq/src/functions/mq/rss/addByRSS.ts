import type { ActiveMQArtemisService } from '@queue/services/activeMQArtemis/index.js';
import type { MQAddByRSSMessage } from '@queue/types/mq.js';

import type { CredentialScopeDecision, MQQueueConfigFunctionParams } from '@podverse/helpers';
import { ADD_BY_RSS_CREDENTIALS_TRANSIT_TTL_MS } from '@podverse/helpers-backend';

type MQAddByRSSAddOptions = MQQueueConfigFunctionParams & {
  accountId: number;
  feedUrl: string;
  requestId: string;
  feedHash?: string;
  etag?: string;
  lastModified?: string;
  credentialsEnvelope?: string;
  publisherRequestId?: string;
  credentialsWithheld?: Exclude<CredentialScopeDecision, 'send'>;
};

/**
 * Enqueues an add-by-RSS parse. A message carrying a credentials envelope is sent with an AMQP
 * TTL equal to the envelope lifetime, so the broker drops it once the worker could no longer open
 * it anyway. Messages without credentials keep no TTL.
 */
export const mqAddByRSSAdd = async (
  activeMQArtemisService: ActiveMQArtemisService,
  options: MQAddByRSSAddOptions
) => {
  await activeMQArtemisService.initialize();

  try {
    const message: MQAddByRSSMessage = {
      accountId: options.accountId,
      feedUrl: options.feedUrl,
      requestId: options.requestId,
      feedHash: options.feedHash,
      etag: options.etag,
      lastModified: options.lastModified,
      ...(options.credentialsEnvelope ? { credentialsEnvelope: options.credentialsEnvelope } : {}),
      ...(options.publisherRequestId ? { publisherRequestId: options.publisherRequestId } : {}),
      ...(options.credentialsWithheld ? { credentialsWithheld: options.credentialsWithheld } : {}),
    };

    await activeMQArtemisService.sendMessage({
      queueName: options.queueName,
      message,
      priority: options.priority,
      dedupeCacheTimeMS: options.dedupeCacheTimeMS,
      ...(options.credentialsEnvelope ? { ttlMs: ADD_BY_RSS_CREDENTIALS_TRANSIT_TTL_MS } : {}),
    });
  } finally {
    try {
      if (options.closeAfterSend) {
        await activeMQArtemisService.close();
      }
    } catch {
      // swallow
    }
  }
};
