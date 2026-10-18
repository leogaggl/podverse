import type { BillingCadence, PaymentProcessorId } from '@podverse/helpers';
import {
  isPaymentProcessorId,
  PAYPAL_ONE_TIME_PRODUCT_IDS,
  STRIKE_ONE_TIME_PRODUCT_IDS,
} from '@podverse/helpers';

import type { CommandLineArgs } from '../index.js';

const PRODUCT_ID_MAX_LENGTH = 255;

export const PROCESSOR_PRODUCT_ADD_HELP = `billingProcessorProductAdd

Add a Premium store-product row. A row that already exists is left as it is, including
one an admin deactivated or edited. This command never updates or removes a row.

Flags:
  --processor id     paypal, apple, google_play, strike, or test
  --cadence cadence  monthly or annual
  --product-id id    Store product id (required unless --defaults)
  --base-plan-id id  Google Play base plan id (required for google_play, rejected otherwise)
  --defaults         Add both PayPal or Strike product ids. Those ids are fixed in code.
  --dry-run          Report what would be added; write nothing
  --help             Show this text

--defaults is only for paypal and strike, and it replaces --cadence, --product-id, and
--base-plan-id.
`;

export interface ProcessorProductMapping {
  processor: PaymentProcessorId;
  cadence: BillingCadence;
  externalProductId: string;
  externalBasePlanId: string | null;
}

export type ProcessorProductAddRequest =
  { kind: 'help' } | { kind: 'apply' | 'dry-run'; mappings: ProcessorProductMapping[] };

export type ParseProcessorProductAddResult =
  { ok: true; request: ProcessorProductAddRequest } | { ok: false; message: string };

function hasOption(args: CommandLineArgs, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(args, name);
}

function optionValue(args: CommandLineArgs, name: string): string | null {
  const value = args[name];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  return trimmed;
}

function isCadence(value: string): value is BillingCadence {
  return value === 'monthly' || value === 'annual';
}

function fixedProductIds(processor: 'paypal' | 'strike'): Record<BillingCadence, string> {
  return processor === 'paypal' ? PAYPAL_ONE_TIME_PRODUCT_IDS : STRIKE_ONE_TIME_PRODUCT_IDS;
}

function isWithinProductIdLength(value: string): boolean {
  return value.length > 0 && value.length <= PRODUCT_ID_MAX_LENGTH;
}

export function parseProcessorProductAddArgs(
  args: CommandLineArgs
): ParseProcessorProductAddResult {
  if (hasOption(args, 'help')) {
    return { ok: true, request: { kind: 'help' } };
  }

  const processorRaw = optionValue(args, 'processor');
  if (processorRaw === null || !isPaymentProcessorId(processorRaw)) {
    return {
      ok: false,
      message: 'Missing or unknown --processor. Run with --help for the accepted ids.',
    };
  }

  const kind = hasOption(args, 'dry-run') ? 'dry-run' : 'apply';
  if (hasOption(args, 'defaults')) {
    if (processorRaw !== 'paypal' && processorRaw !== 'strike') {
      return { ok: false, message: '--defaults is only for paypal and strike.' };
    }
    if (
      hasOption(args, 'cadence') ||
      hasOption(args, 'product-id') ||
      hasOption(args, 'base-plan-id')
    ) {
      return {
        ok: false,
        message: '--defaults replaces --cadence, --product-id, and --base-plan-id.',
      };
    }
    const ids = fixedProductIds(processorRaw);
    return {
      ok: true,
      request: {
        kind,
        mappings: [
          {
            processor: processorRaw,
            cadence: 'monthly',
            externalProductId: ids.monthly,
            externalBasePlanId: null,
          },
          {
            processor: processorRaw,
            cadence: 'annual',
            externalProductId: ids.annual,
            externalBasePlanId: null,
          },
        ],
      },
    };
  }

  const cadenceRaw = optionValue(args, 'cadence');
  if (cadenceRaw === null || !isCadence(cadenceRaw)) {
    return { ok: false, message: '--cadence must be monthly or annual.' };
  }

  const productId = optionValue(args, 'product-id');
  if (productId === null || !isWithinProductIdLength(productId)) {
    return {
      ok: false,
      message: `--product-id is required and must be 1-${String(PRODUCT_ID_MAX_LENGTH)} characters.`,
    };
  }

  const basePlanRaw = optionValue(args, 'base-plan-id');
  if (processorRaw === 'google_play') {
    if (basePlanRaw === null || !isWithinProductIdLength(basePlanRaw)) {
      return {
        ok: false,
        message: `--base-plan-id is required for google_play and must be 1-${String(PRODUCT_ID_MAX_LENGTH)} characters.`,
      };
    }
    return {
      ok: true,
      request: {
        kind,
        mappings: [
          {
            processor: processorRaw,
            cadence: cadenceRaw,
            externalProductId: productId,
            externalBasePlanId: basePlanRaw,
          },
        ],
      },
    };
  }

  if (hasOption(args, 'base-plan-id')) {
    return { ok: false, message: '--base-plan-id is only for google_play.' };
  }

  return {
    ok: true,
    request: {
      kind,
      mappings: [
        {
          processor: processorRaw,
          cadence: cadenceRaw,
          externalProductId: productId,
          externalBasePlanId: null,
        },
      ],
    },
  };
}
