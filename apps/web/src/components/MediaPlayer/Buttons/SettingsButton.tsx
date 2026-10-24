'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FaGear } from 'react-icons/fa6';

import { getNextPlaybackSpeed, getPlaybackTranslationKey } from '@podverse/helpers';
import type { DropdownMenuPanelItem } from '@podverse/ui';
import { DropdownMenuPanel, useDropdownKeyboardNavigation } from '@podverse/ui';

import { useMediaPlayer } from '../../../contexts/MediaPlayer';
import {
  getSleepTimerMinutes,
  setSleepTimerMinutes,
  subscribeSleepTimer,
} from '../sleepTimerState';

import styles from '../../../styles/components/MediaPlayer/Buttons/SettingsButton.module.scss';

export const SettingsButton = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const { mpPlaybackSpeed, setMPPlaybackSpeed } = useMediaPlayer();
  const tMediaPlayer = useTranslations('media_player');
  const sleepMinutes = useSyncExternalStore(
    subscribeSleepTimer,
    getSleepTimerMinutes,
    getSleepTimerMinutes
  );
  const [menuPage, setMenuPage] = useState<'root' | 'sleep'>('root');
  const selectItemRef = useRef<(idx: number) => void>(() => {});

  const sleepValueLabel =
    sleepMinutes === 15
      ? tMediaPlayer('sleep_timer.minutes_15')
      : sleepMinutes === 30
        ? tMediaPlayer('sleep_timer.minutes_30')
        : sleepMinutes === 60
          ? tMediaPlayer('sleep_timer.minutes_60')
          : tMediaPlayer('sleep_timer.off');

  const itemCount = menuPage === 'sleep' ? 4 : 2;

  const { open, setOpen, focusedIndex, setFocusedIndex, handleButtonKeyDown, handleMenuKeyDown } =
    useDropdownKeyboardNavigation({
      itemCount,
      onItemSelect: (idx) => {
        selectItemRef.current(idx);
      },
      onClose: () => setOpen(false),
      closeOnItemSelect: false,
      buttonRef,
      menuRef,
    });

  const setOpenRef = useRef(setOpen);
  const setFocusedIndexRef = useRef(setFocusedIndex);
  setOpenRef.current = setOpen;
  setFocusedIndexRef.current = setFocusedIndex;

  const closeMenu = () => {
    setOpenRef.current(false);
  };

  const selectSleepMinutes = (minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    closeMenu();
  };

  const rootItems: DropdownMenuPanelItem[] = [
    {
      label: tMediaPlayer('playback_speed.playback_speed_with_value', {
        speed: tMediaPlayer(`playback_speed.speeds.${getPlaybackTranslationKey(mpPlaybackSpeed)}`),
      }),
      onClick: () => {
        setMPPlaybackSpeed(getNextPlaybackSpeed(mpPlaybackSpeed));
        closeMenu();
      },
    },
    {
      dismissOnSelect: false,
      label: tMediaPlayer('sleep_timer.sleep_timer_with_value', { value: sleepValueLabel }),
      onClick: () => {
        setMenuPage('sleep');
        setFocusedIndexRef.current(0);
      },
    },
  ];

  const sleepItems: DropdownMenuPanelItem[] = [
    {
      label: tMediaPlayer('sleep_timer.off'),
      onClick: () => {
        selectSleepMinutes(null);
      },
    },
    {
      label: tMediaPlayer('sleep_timer.minutes_15'),
      onClick: () => {
        selectSleepMinutes(15);
      },
    },
    {
      label: tMediaPlayer('sleep_timer.minutes_30'),
      onClick: () => {
        selectSleepMinutes(30);
      },
    },
    {
      label: tMediaPlayer('sleep_timer.minutes_60'),
      onClick: () => {
        selectSleepMinutes(60);
      },
    },
  ];

  const menuItems = menuPage === 'sleep' ? sleepItems : rootItems;
  selectItemRef.current = (idx) => {
    menuItems[idx]?.onClick();
  };

  useEffect(() => {
    if (!open) {
      setMenuPage('root');
    }
  }, [open]);

  return (
    <div className={styles.settingsDropdownWrapper}>
      <button
        ref={buttonRef}
        className={styles.settingsButton}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={tMediaPlayer('player_settings')}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleButtonKeyDown}
        type="button"
      >
        <FaGear aria-hidden />
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
};
