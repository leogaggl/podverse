'use client';

import React, { useEffect, useRef, useState } from 'react';

import { formatHHMMSS } from '@podverse/helpers';
import { clampRatio } from '@podverse/helpers/math';

import { usePlayerTransport } from '../../../hooks/usePlayerTransport';
import { useRemotePlaybackPositionSeconds } from '../../../hooks/useRemotePlaybackPositionSeconds';
import type { RemotePlayerDisplay } from '../../../lib/crossDevicePlayback/remotePlayerDisplay';

import styles from '../../../styles/components/MediaPlayer/Sliders/MediaPlayerProgress.module.scss';

type RemoteMediaPlayerProgressProps = {
  remote: RemotePlayerDisplay;
  includeMobileTime?: boolean;
};

/**
 * Progress for another device. Length is that device's `duration_seconds` (its own file), and a
 * drag sends one seek when the pointer is released.
 */
export const RemoteMediaPlayerProgress: React.FC<RemoteMediaPlayerProgressProps> = ({
  remote,
  includeMobileTime,
}) => {
  const estimated = useRemotePlaybackPositionSeconds(true) ?? 0;
  const { seekTo } = usePlayerTransport();
  const barRef = useRef<HTMLDivElement>(null);
  const [dragSeconds, setDragSeconds] = useState<number | null>(null);
  const dragSecondsRef = useRef<number | null>(null);
  const removeWindowListenersRef = useRef<(() => void) | null>(null);

  const duration =
    remote.state.duration_seconds !== null && remote.state.duration_seconds > 0
      ? remote.state.duration_seconds
      : 0;
  const durationRef = useRef(duration);
  durationRef.current = duration;

  useEffect(() => {
    return () => {
      removeWindowListenersRef.current?.();
      removeWindowListenersRef.current = null;
    };
  }, []);

  const assignDragSeconds = (value: number | null) => {
    dragSecondsRef.current = value;
    setDragSeconds(value);
  };

  const secondsFromClientX = (clientX: number): number | null => {
    const currentDuration = durationRef.current;
    if (barRef.current === null || currentDuration === 0) {
      return null;
    }
    const x = clientX - barRef.current.getBoundingClientRect().left;
    const percent = Math.min(Math.max(x / barRef.current.getBoundingClientRect().width, 0), 1);
    return Math.round(percent * currentDuration);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const seconds = secondsFromClientX(event.clientX);
    if (seconds === null) {
      return;
    }
    assignDragSeconds(seconds);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const next = secondsFromClientX(moveEvent.clientX);
      if (next === null || next === dragSecondsRef.current) {
        return;
      }
      assignDragSeconds(next);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      removeWindowListenersRef.current = null;
      const released = dragSecondsRef.current;
      if (typeof released === 'number' && durationRef.current > 0) {
        seekTo(released);
      }
      assignDragSeconds(null);
    };

    removeWindowListenersRef.current?.();
    removeWindowListenersRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!remote.controls.showsProgress) {
    return null;
  }

  const shown = Math.min(
    dragSeconds ?? estimated,
    duration > 0 ? duration : Number.POSITIVE_INFINITY
  );
  const ratio = duration > 0 ? clampRatio(shown / duration) : 0;
  const durationLabel = duration > 0 ? formatHHMMSS(duration) : '';

  return (
    <div className={styles.mediaPlayerProgress}>
      <span className={styles.mediaPlayerProgressTime}>{formatHHMMSS(shown)}</span>
      <div
        className={styles.customProgressBar}
        ref={barRef}
        onMouseDown={handleMouseDown}
        role="slider"
        aria-valuenow={shown}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuetext={`${formatHHMMSS(shown)} of ${formatHHMMSS(duration)}`}
        aria-disabled={duration === 0 ? true : undefined}
        tabIndex={0}
        data-testid="media-player-remote-progress"
      >
        <div className={styles.customProgressBarInner}>
          <div className={styles.progressLevel} style={{ width: `${ratio * 100}%` }} />
          <div className={styles.progressRemaining} style={{ width: `${(1 - ratio) * 100}%` }} />
        </div>
      </div>
      <span className={styles.mediaPlayerProgressDuration}>{durationLabel}</span>
      {includeMobileTime && (
        <div className={styles.mobileTimeWrapper}>
          <span className={styles.mediaPlayerProgressTimeMobile}>{formatHHMMSS(shown)}</span>
          <span className={styles.mediaPlayerProgressDurationMobile}>{durationLabel}</span>
        </div>
      )}
    </div>
  );
};
