import type { CommandLineArgs } from '@workers/commands/index.js';
import { getLogger } from '@workers/factories/logger.js';

import { BillingProcessorProductService } from '@podverse/orm';

import {
  parseProcessorProductAddArgs,
  PROCESSOR_PRODUCT_ADD_HELP,
} from './processorProductAddLib.js';

/**
 * Adds Premium store-product rows. An existing row is never updated, reactivated, or removed,
 * so a mapping edited in management stays as management left it.
 */
export const billingProcessorProductAdd = async (args: CommandLineArgs) => {
  const parsed = parseProcessorProductAddArgs(args);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  if (parsed.request.kind === 'help') {
    process.stdout.write(PROCESSOR_PRODUCT_ADD_HELP);
    return;
  }

  const logger = getLogger();
  const dryRun = parsed.request.kind === 'dry-run';
  const service = new BillingProcessorProductService();
  let created = 0;
  let unchanged = 0;

  for (const mapping of parsed.request.mappings) {
    if (dryRun) {
      const existing = await service.getByExternalIds(
        mapping.processor,
        mapping.externalProductId,
        mapping.externalBasePlanId
      );
      if (existing === null) {
        created += 1;
      } else {
        unchanged += 1;
      }
      logger.info('Billing processor product add dry run', {
        processor: mapping.processor,
        cadence: mapping.cadence,
        externalProductId: mapping.externalProductId,
        externalBasePlanId: mapping.externalBasePlanId,
        wouldCreate: existing === null,
      });
      continue;
    }

    const result = await service.addPremiumProcessorProductIfMissing({
      processorId: mapping.processor,
      externalProductId: mapping.externalProductId,
      externalBasePlanId: mapping.externalBasePlanId,
      cadence: mapping.cadence,
    });
    if (result.created) {
      created += 1;
    } else {
      unchanged += 1;
    }
    logger.info('Billing processor product add finished', {
      processor: mapping.processor,
      cadence: mapping.cadence,
      externalProductId: mapping.externalProductId,
      externalBasePlanId: mapping.externalBasePlanId,
      created: result.created,
    });
  }

  logger.info('Billing processor products added', { dryRun, created, unchanged });
};
