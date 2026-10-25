'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useRef } from 'react';
import { FaComputer } from 'react-icons/fa6';

import type { DropdownMenuPanelItem } from '@podverse/ui';
import { DropdownMenuPanel, useDropdownKeyboardNavigation } from '@podverse/ui';

import {
  useCrossDevicePlayback,
  useCrossDevicePlaybackSnapshot,
} from '../../../contexts/CrossDevicePlayback';
import { usePlaybackDevices } from '../../../hooks/usePlaybackDevices';
import { useRemotePlayerDisplay } from '../../../hooks/useRemotePlayerDisplay';
import type { PlaybackDeviceMenuDescriptionPart } from '../../../lib/crossDevicePlayback/playbackDeviceMenu';
import { buildPlaybackDeviceMenuEntries } from '../../../lib/crossDevicePlayback/playbackDeviceMenu';

import styles from '../../../styles/components/MediaPlayer/Buttons/PlaybackDevicesButton.module.scss';

function descriptionPartLabel(
  part: PlaybackDeviceMenuDescriptionPart,
  tMediaPlayer: ReturnType<typeof useTranslations>
): string {
  switch (part) {
    case 'this_device':
      return tMediaPlayer('cross_device.this_device');
    case 'sending':
      return tMediaPlayer('cross_device.sending');
    case 'playing_in_another_tab':
      return tMediaPlayer('cross_device.playing_in_another_tab');
    case 'playing':
      return tMediaPlayer('cross_device.playing');
    default: {
      const unexpected: never = part;
      return unexpected;
    }
  }
}

function PlaybackDevicesMenu() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const { entries, formatName } = usePlaybackDevices();
  const { transferTo } = useCrossDevicePlayback();
  const role = useCrossDevicePlaybackSnapshot((snapshot) => snapshot.role);
  const thisTabHoldsAudio = useCrossDevicePlaybackSnapshot(
    (snapshot) => snapshot.thisTabHoldsAudio
  );
  const pendingTransferTargetSessionIdText = useCrossDevicePlaybackSnapshot(
    (snapshot) => snapshot.pendingTransfer?.targetSessionIdText ?? null
  );
  const isRemoteView = useRemotePlayerDisplay() !== null;
  const tMediaPlayer = useTranslations('media_player');

  const menuEntries = useMemo(
    () =>
      buildPlaybackDeviceMenuEntries({
        entries,
        role,
        thisTabHoldsAudio,
        pendingTransferTargetSessionIdText,
      }),
    [entries, pendingTransferTargetSessionIdText, role, thisTabHoldsAudio]
  );

  const menuItems = useMemo<DropdownMenuPanelItem[]>(
    () =>
      menuEntries.map((menuEntry) => {
        const targetSessionIdText = menuEntry.transferTargetSessionIdText;
        const description =
          menuEntry.descriptionParts.length === 0
            ? undefined
            : menuEntry.descriptionParts
                .map((part) => descriptionPartLabel(part, tMediaPlayer))
                .join(' · ');
        return {
          key: menuEntry.entry.device.session_id_text,
          label: formatName(menuEntry.entry),
          description,
          checked: menuEntry.checked,
          onClick: () => {
            if (targetSessionIdText !== null) {
              void transferTo(targetSessionIdText);
            }
          },
        };
      }),
    [formatName, menuEntries, tMediaPlayer, transferTo]
  );

  const { open, setOpen, focusedIndex, setFocusedIndex, handleButtonKeyDown, handleMenuKeyDown } =
    useDropdownKeyboardNavigation({
      itemCount: menuItems.length,
      onItemSelect: (idx) => {
        menuItems[idx]?.onClick();
      },
      onClose: () => setOpen(false),
      buttonRef,
      menuRef,
    });

  return (
    <div className={styles.devicesDropdownWrapper}>
      <button
        ref={buttonRef}
        className={styles.devicesButton}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={tMediaPlayer('cross_device.devices_button')}
        data-remote-active={isRemoteView ? 'true' : undefined}
        data-testid="media-player-devices-button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleButtonKeyDown}
        type="button"
      >
        <FaComputer aria-hidden />
      </button>
      <DropdownMenuPanel
        menuItems={menuItems}
        open={open}
        menuRef={menuRef}
        focusedIndex={focusedIndex}
        setFocusedIndex={setFocusedIndex}
        handleMenuKeyDown={handleMenuKeyDown}
        setOpen={setOpen}
        verticalPosition="above"
      />
    </div>
  );
}

export const PlaybackDevicesButton: React.FC = () => {
  const { showSwitch } = usePlaybackDevices();
  return showSwitch ? <PlaybackDevicesMenu /> : null;
};
