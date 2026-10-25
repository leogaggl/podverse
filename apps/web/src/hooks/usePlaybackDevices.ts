'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';

import type { PlaybackDeviceListEntry } from '@podverse/helpers';
import { buildPlaybackDeviceList, shouldShowPlaybackDeviceSwitch } from '@podverse/helpers';

import { useCrossDevicePlaybackSnapshot } from '../contexts/CrossDevicePlayback';
import { formatPlaybackDeviceName } from '../lib/crossDevicePlayback/playbackDeviceName';

export type PlaybackDevicesView = {
  entries: PlaybackDeviceListEntry[];
  /** Availability is `ready` and at least two devices are connected. */
  showSwitch: boolean;
  /** Display name; null → `cross_device.unknown_device`. */
  formatName: (entry: PlaybackDeviceListEntry | null) => string;
};

export function usePlaybackDevices(): PlaybackDevicesView {
  const availability = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.availability);
  const devices = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.devices);
  const thisSessionIdText = useCrossDevicePlaybackSnapshot(
    (snapshot) => snapshot.thisSessionIdText
  );
  const activeSessionIdText = useCrossDevicePlaybackSnapshot(
    (snapshot) => snapshot.displayState?.active_session_id_text ?? null
  );
  const t = useTranslations('media_player');

  const entries = useMemo(
    () =>
      buildPlaybackDeviceList({
        devices: devices?.devices ?? [],
        thisSessionIdText,
        activeSessionIdText,
      }),
    [activeSessionIdText, devices, thisSessionIdText]
  );
  const showSwitch =
    availability === 'ready' && shouldShowPlaybackDeviceSwitch(devices?.devices ?? []);
  const formatName = useCallback(
    (entry: PlaybackDeviceListEntry | null) => {
      if (entry === null) {
        return t('cross_device.unknown_device');
      }
      return formatPlaybackDeviceName(entry, {
        unnamedWebDevice: t('cross_device.unnamed_web_device'),
        unnamedMobileDevice: t('cross_device.unnamed_mobile_device'),
        withNumber: (name, number) => t('cross_device.device_with_number', { name, number }),
      });
    },
    [t]
  );

  return { entries, showSwitch, formatName };
}
