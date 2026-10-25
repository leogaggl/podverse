import type { PlaybackDeviceListEntry } from '@podverse/helpers';

export type PlaybackDeviceNameLabels = {
  unnamedWebDevice: string;
  unnamedMobileDevice: string;
  withNumber: (name: string, number: number) => string;
};

export function formatPlaybackDeviceName(
  entry: Pick<PlaybackDeviceListEntry, 'device' | 'sameLabelNumber'>,
  labels: PlaybackDeviceNameLabels
): string {
  const trimmedLabel = entry.device.device_label?.trim() ?? '';
  const name =
    trimmedLabel.length > 0
      ? trimmedLabel
      : entry.device.client_type === 'mobile'
        ? labels.unnamedMobileDevice
        : labels.unnamedWebDevice;
  if (entry.sameLabelNumber === null) {
    return name;
  }
  return labels.withNumber(name, entry.sameLabelNumber);
}
