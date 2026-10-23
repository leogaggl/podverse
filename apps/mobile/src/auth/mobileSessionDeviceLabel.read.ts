import { Platform } from 'react-native';

import type { MobileSessionDeviceFacts } from './mobileSessionDeviceLabel';
import { mobileSessionDeviceLabel } from './mobileSessionDeviceLabel';

const readFacts = (): MobileSessionDeviceFacts => {
  if (Platform.OS === 'ios') {
    return {
      interfaceIdiom: Platform.constants.interfaceIdiom,
      os: 'ios',
    };
  }
  if (Platform.OS === 'android') {
    return {
      manufacturer: Platform.constants.Manufacturer,
      model: Platform.constants.Model,
      os: 'android',
    };
  }
  return { os: 'other' };
};

/** Brand-name label for this device, or null when the platform has none to send. */
export const readMobileSessionDeviceLabel = (): string | null =>
  mobileSessionDeviceLabel(readFacts());
