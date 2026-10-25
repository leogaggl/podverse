import { describe, expect, it } from 'vitest';

import type { DTOPlaybackDevice } from '@podverse/helpers';

import type { PlaybackDeviceNameLabels } from './playbackDeviceName';
import { formatPlaybackDeviceName } from './playbackDeviceName';

const labels: PlaybackDeviceNameLabels = {
  unnamedWebDevice: 'Web Browser',
  unnamedMobileDevice: 'Mobile App',
  withNumber: (name, number) => `${name} (${number})`,
};

function named(
  device: Partial<DTOPlaybackDevice> & Pick<DTOPlaybackDevice, 'client_type' | 'device_label'>,
  sameLabelNumber: number | null = null
) {
  return formatPlaybackDeviceName(
    {
      device: {
        session_id_text: 'session-1',
        session_created_at: '2026-01-01T00:00:00.000Z',
        ...device,
      },
      sameLabelNumber,
    },
    labels
  );
}

describe('formatPlaybackDeviceName', () => {
  it('uses the trimmed device label', () => {
    expect(named({ client_type: 'web', device_label: '  Kitchen Speaker  ' })).toBe(
      'Kitchen Speaker'
    );
  });

  it('falls back when a web label is null or whitespace', () => {
    expect(named({ client_type: 'web', device_label: null })).toBe('Web Browser');
    expect(named({ client_type: 'web', device_label: '   ' })).toBe('Web Browser');
  });

  it('falls back to the mobile name when a mobile label is empty', () => {
    expect(named({ client_type: 'mobile', device_label: null })).toBe('Mobile App');
  });

  it('adds the shared-label number', () => {
    expect(named({ client_type: 'mobile', device_label: 'Phone' }, 2)).toBe('Phone (2)');
  });
});
