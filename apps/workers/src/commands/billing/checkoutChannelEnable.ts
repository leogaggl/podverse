import type { CommandLineArgs } from '@workers/commands/index.js';
import { getLogger } from '@workers/factories/logger.js';

import { storeLinkNeedsCountry } from '@podverse/helpers';
import { BillingCheckoutChannelService } from '@podverse/orm';

import {
  CHECKOUT_CHANNEL_ENABLE_HELP,
  parseCheckoutChannelEnableArgs,
} from './checkoutChannelEnableLib.js';

/**
 * Turns one checkout channel on. An enabled channel is left alone, and this never turns a
 * channel off or edits its storefronts or minimum client version.
 */
export const billingCheckoutChannelEnable = async (args: CommandLineArgs) => {
  const parsed = parseCheckoutChannelEnableArgs(args);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  if (parsed.request.kind === 'help') {
    process.stdout.write(CHECKOUT_CHANNEL_ENABLE_HELP);
    return;
  }

  const logger = getLogger();
  const { processorId, platform } = parsed.request;
  const service = new BillingCheckoutChannelService();
  const existing = await service.getChannel(processorId, platform);
  if (existing === null) {
    throw new Error(`Checkout channel not found for ${processorId} on ${platform}.`);
  }

  if (
    !existing.enabled &&
    storeLinkNeedsCountry({
      processorId: existing.processor_id,
      platform: existing.platform,
      enabled: true,
      storefrontAllowlist: existing.storefront_allowlist,
    })
  ) {
    throw new Error('A store link needs at least one storefront country.');
  }

  if (parsed.request.kind === 'dry-run') {
    logger.info('Billing checkout channel enable dry run', {
      processor: processorId,
      platform,
      wouldEnable: !existing.enabled,
    });
    return;
  }

  const result = await service.enableIfDisabled(processorId, platform);
  if (result === null) {
    throw new Error(`Checkout channel not found for ${processorId} on ${platform}.`);
  }
  logger.info('Billing checkout channel enable finished', {
    processor: processorId,
    platform,
    changed: result.changed,
    enabled: result.channel.enabled,
  });
};
