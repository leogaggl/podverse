import { joinDeviceModel } from '../lib/device/deviceModel';

export type MobileSessionDeviceFacts =
  | { os: 'ios'; interfaceIdiom: string }
  | { os: 'android'; manufacturer: string; model: string }
  | { os: 'other' };

const LABEL_SEPARATOR = ' · ';

/** Label the server shows in the session list: "<device> · <OS>", brand names only. */
export const mobileSessionDeviceLabel = (facts: MobileSessionDeviceFacts): string | null => {
  switch (facts.os) {
    case 'ios':
      if (facts.interfaceIdiom === 'phone') {
        return `iPhone${LABEL_SEPARATOR}iOS`;
      }
      if (facts.interfaceIdiom === 'pad') {
        return `iPad${LABEL_SEPARATOR}iOS`;
      }
      return 'iOS';
    case 'android': {
      const model = joinDeviceModel(facts.manufacturer, facts.model);
      if (model === null) {
        return 'Android';
      }
      return `${model}${LABEL_SEPARATOR}Android`;
    }
    case 'other':
      return null;
  }
};
