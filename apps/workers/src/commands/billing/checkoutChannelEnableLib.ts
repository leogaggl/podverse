import type { BillingPlatform, PaymentProcessorId } from '@podverse/helpers';
import { isBillingPlatform, isPaymentProcessorId } from '@podverse/helpers';

import type { CommandLineArgs } from '../index.js';

export const CHECKOUT_CHANNEL_ENABLE_HELP = `billingCheckoutChannelEnable

Turn a checkout channel on. A channel that is already on is left as it is. This command
never turns a channel off and never changes its storefronts or minimum client version.

PayPal and Strike on ios or android stay off until the channel has at least one
storefront country. Set that list in management, then run this command again.

Flags:
  --processor id   paypal, apple, google_play, strike, or test
  --platform name  web, ios, android, or foss
  --dry-run        Report whether the channel would be turned on; write nothing
  --help           Show this text
`;

export type CheckoutChannelEnableRequest =
  | { kind: 'help' }
  | { kind: 'apply' | 'dry-run'; processorId: PaymentProcessorId; platform: BillingPlatform };

export type ParseCheckoutChannelEnableResult =
  { ok: true; request: CheckoutChannelEnableRequest } | { ok: false; message: string };

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

export function parseCheckoutChannelEnableArgs(
  args: CommandLineArgs
): ParseCheckoutChannelEnableResult {
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

  const platformRaw = optionValue(args, 'platform');
  if (platformRaw === null || !isBillingPlatform(platformRaw)) {
    return {
      ok: false,
      message: '--platform must be web, ios, android, or foss.',
    };
  }

  return {
    ok: true,
    request: {
      kind: hasOption(args, 'dry-run') ? 'dry-run' : 'apply',
      processorId: processorRaw,
      platform: platformRaw,
    },
  };
}
