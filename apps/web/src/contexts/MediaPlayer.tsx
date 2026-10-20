import type { ReactNode, RefObject } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import type {
  AddByRSSResourceData,
  DTOChannel,
  DTOClip,
  DTOItem,
  DTOItemChapter,
  DTOItemSoundbite,
  EnclosureSelectedParams,
  LabeledItemEnclosure,
  PlaybackMode,
  PlaybackSpeedValue,
} from '@podverse/helpers';

import { addByRSSPlaybackIdentity } from '../hooks/playbackHandoffState';
import type {
  MusicItemPlaybackIntent,
  PlaybackLoadDecision,
  PlaybackLoadRequest,
  PlaybackTarget,
} from '../lib/playback';
import { resolvePlaybackLoadDecision } from '../lib/playback';
import type { MPPlaybackError } from '../utils/media/playbackErrorCopy';
import { playbackErrorIdentity, reducePlaybackError } from '../utils/media/playbackErrorCopy';
import { useQueueResourcesAbridgedIndex } from './QueueResourcesAbridgedIndex';

/** State for "now playing" when the source is add-by-RSS (no DTO item). */
export type MediaPlayerAddByRSSState = {
  idText: string;
  resourceData: AddByRSSResourceData;
} | null;

type MediaPlayerContextType = {
  /** When set, now playing is an add-by-RSS item; use for display, saves, and lists. */
  mpAddByRSS: MediaPlayerAddByRSSState;
  /** Loads an add-by-RSS item: sets both `mpAddByRSS` and `mpAddByRSSMediaSource`. */
  setMPAddByRSS: (val: MediaPlayerAddByRSSState) => void;
  /**
   * The add-by-RSS item the media element was loaded with. Media elements read this, not
   * `mpAddByRSS`, so a metadata update cannot reload media or move the position.
   */
  mpAddByRSSMediaSource: MediaPlayerAddByRSSState;
  /**
   * Replaces `mpAddByRSS` metadata (title, artwork, bundle) for the item already loaded. Ignored
   * unless `next` has the loaded item's Add by RSS identity. Leaves the media source untouched.
   */
  updateMPAddByRSSMetadata: (next: NonNullable<MediaPlayerAddByRSSState>) => void;
  mpChannel: DTOChannel | null;
  setMPChannel: (val: DTOChannel | null) => void;
  mpItem: DTOItem | null;
  setMPItem: (val: DTOItem | null) => void;
  mpItemLabeledItemEnclosures: LabeledItemEnclosure[];
  setMPItemLabeledItemEnclosures: (val: LabeledItemEnclosure[]) => void;
  mpEnclosureSelectedParams: EnclosureSelectedParams;
  setMPEnclosureSelectedParams: (val: EnclosureSelectedParams) => void;
  mpClip: DTOClip | null;
  setMPClip: (val: DTOClip | null) => void;
  mpItemChapter: DTOItemChapter | null;
  setMPItemChapter: (val: DTOItemChapter | null) => void;
  mpItemChapters: DTOItemChapter[] | null;
  setMPItemChapters: (val: DTOItemChapter[] | null) => void;
  mpItemChapterShouldSeek: boolean;
  setMPItemChapterShouldSeek: (val: boolean) => void;
  mpItemSoundbite: DTOItemSoundbite | null;
  setMPItemSoundbite: (val: DTOItemSoundbite | null) => void;
  mpIsPlaying: boolean;
  setMPIsPlaying: (val: boolean) => void;
  mpPlaybackMode: PlaybackMode;
  setMPPlaybackMode: (val: PlaybackMode) => void;
  mpPlaybackSpeed: PlaybackSpeedValue;
  setMPPlaybackSpeed: (val: PlaybackSpeedValue) => void;
  mpIsMuted: boolean;
  setMPIsMuted: (val: boolean) => void;
  mpVolume: number;
  setMPVolume: (val: number) => void;
  mpDuration: number;
  setMPDuration: (val: number) => void;
  playerModalIsOpen: boolean;
  setPlayerModalIsOpen: (val: boolean) => void;
  mpShouldPlay: boolean;
  setMPShouldPlay: (val: boolean) => void;
  /** One-shot seek time for Add-by-RSS restored position; set by usePlayAddByRSS, consumed and cleared by controller. */
  addByRSSSeekToTime: number | null;
  setAddByRSSSeekToTime: (val: number | null) => void;
  /** The typed playback target being applied by the playback bridge. */
  activePlaybackTarget: PlaybackTarget | null;
  setActivePlaybackTarget: (target: PlaybackTarget | null) => void;
  /** The decision the playback bridge enacts after loadedmetadata. */
  pendingPlaybackDecision: PlaybackLoadDecision | null;
  setPendingPlaybackDecision: (decision: PlaybackLoadDecision | null) => void;
  /** Resolve and stage a target + decision in a single synchronous call. */
  applyPlaybackLoad: (request: PlaybackLoadRequest) => PlaybackLoadDecision;
  /**
   * One-shot override for the next queue-head music load (`handleLoadQueueItem`).
   * Set to `fresh_transition` before skip/ended-driven `queueResourcesLoadActive`;
   * otherwise queue hydration defaults to `session_restore`.
   */
  pendingMusicQueueLoadIntentRef: RefObject<MusicItemPlaybackIntent | null>;
  /**
   * Monotonic counter bumped by every `applyPlaybackLoad`. Automatic queue hydration
   * and queue-head loads compare against this so a load applied after they start wins.
   */
  playbackLoadGenerationRef: RefObject<number>;
  /** Set while the loaded item cannot play. Cleared when a different item loads, on retry, and on `playing`. */
  mpPlaybackError: MPPlaybackError | null;
  setMPPlaybackError: (error: MPPlaybackError | null) => void;
  /** Records a failure and stops the play/pause control from staying on Play. */
  reportPlaybackError: (error: MPPlaybackError) => void;
  playbackErrorDialogOpen: boolean;
  setPlaybackErrorDialogOpen: (open: boolean) => void;
};

export const MediaPlayerContext = createContext<MediaPlayerContextType | undefined>(undefined);

type MediaPlayerProviderProps = {
  children: ReactNode;
};

export const MediaPlayerProvider = ({ children }: MediaPlayerProviderProps) => {
  const { queueResourcesAbridgedIndex } = useQueueResourcesAbridgedIndex();
  const [mpAddByRSS, setMPAddByRSSDisplay] = useState<MediaPlayerAddByRSSState>(null);
  const [mpAddByRSSMediaSource, setMPAddByRSSMediaSource] =
    useState<MediaPlayerAddByRSSState>(null);
  const setMPAddByRSS = useCallback((val: MediaPlayerAddByRSSState) => {
    setMPAddByRSSDisplay(val);
    setMPAddByRSSMediaSource(val);
  }, []);
  const updateMPAddByRSSMetadata = useCallback((next: NonNullable<MediaPlayerAddByRSSState>) => {
    const nextIdentity = addByRSSPlaybackIdentity(next.resourceData);
    if (nextIdentity === null) {
      return;
    }
    setMPAddByRSSDisplay((current) =>
      current !== null && addByRSSPlaybackIdentity(current.resourceData) === nextIdentity
        ? next
        : current
    );
  }, []);
  const [mpChannel, setMPChannel] = useState<DTOChannel | null>(null);
  const [mpItem, setMPItem] = useState<DTOItem | null>(null);
  const [mpItemLabeledItemEnclosures, setMPItemLabeledItemEnclosures] = useState<
    LabeledItemEnclosure[]
  >([]);
  const [mpEnclosureSelectedParams, setMPEnclosureSelectedParams] =
    useState<EnclosureSelectedParams>({
      type: 'default',
      enclosureRowSelected: null,
      sourceRowSelected: null,
    });
  const [mpClip, setMPClip] = useState<DTOClip | null>(null);
  const [mpItemChapter, setMPItemChapter] = useState<DTOItemChapter | null>(null);
  const [mpItemChapters, setMPItemChapters] = useState<DTOItemChapter[] | null>(null);
  const [mpItemChapterShouldSeek, setMPItemChapterShouldSeek] = useState<boolean>(false);
  const [mpItemSoundbite, setMPItemSoundbite] = useState<DTOItemSoundbite | null>(null);
  const [mpIsPlaying, setMPIsPlaying] = useState<boolean>(false);
  const [mpPlaybackError, setMPPlaybackError] = useState<MPPlaybackError | null>(null);
  const [playbackErrorDialogOpen, setPlaybackErrorDialogOpen] = useState(false);
  const [mpPlaybackMode, setMPPlaybackMode] = useState<PlaybackMode>('autoplay-next');
  const [mpPlaybackSpeed, setMPPlaybackSpeed] = useState<PlaybackSpeedValue>(1.0);
  const [mpIsMuted, setMPIsMuted] = useState<boolean>(false);
  const [mpVolume, setMPVolume] = useState<number>(1.0);
  const [mpDuration, setMPDuration] = useState<number>(0);
  const [playerModalIsOpen, setPlayerModalIsOpen] = useState<boolean>(false);
  const [mpShouldPlay, setMPShouldPlay] = useState<boolean>(false);
  const reportPlaybackError = useCallback((error: MPPlaybackError) => {
    setMPPlaybackError((current) => {
      if (
        current !== null &&
        current.identity === error.identity &&
        current.kind === error.kind &&
        current.code === error.code &&
        current.message === error.message
      ) {
        return current;
      }
      return reducePlaybackError(current, { type: 'report', error });
    });
    setMPIsPlaying(false);
    setMPShouldPlay(false);
  }, []);
  const loadedIdentity = playbackErrorIdentity({
    addByRssResourceData: mpAddByRSS?.resourceData ?? null,
    itemIdText: mpItem?.id_text ?? null,
    clipIdText: mpClip?.id_text ?? null,
    soundbiteIdText: mpItemSoundbite?.id_text ?? null,
  });
  useEffect(() => {
    setMPPlaybackError((current) =>
      reducePlaybackError(current, { type: 'identity', identity: loadedIdentity })
    );
  }, [loadedIdentity]);
  useEffect(() => {
    if (mpPlaybackError === null) {
      setPlaybackErrorDialogOpen(false);
    }
  }, [mpPlaybackError]);
  const [addByRSSSeekToTime, setAddByRSSSeekToTime] = useState<number | null>(null);
  const [activePlaybackTarget, setActivePlaybackTarget] = useState<PlaybackTarget | null>(null);
  const [pendingPlaybackDecision, setPendingPlaybackDecision] =
    useState<PlaybackLoadDecision | null>(null);
  const pendingMusicQueueLoadIntentRef = useRef<MusicItemPlaybackIntent | null>(null);
  const playbackLoadGenerationRef = useRef(0);

  const applyPlaybackLoad = useCallback(
    (request: PlaybackLoadRequest): PlaybackLoadDecision => {
      playbackLoadGenerationRef.current += 1;
      const decision = resolvePlaybackLoadDecision(request, {
        abridged: queueResourcesAbridgedIndex,
      });
      setActivePlaybackTarget(request.target);
      setPendingPlaybackDecision(decision);
      return decision;
    },
    [queueResourcesAbridgedIndex]
  );

  return (
    <MediaPlayerContext.Provider
      value={{
        mpAddByRSS,
        setMPAddByRSS,
        mpAddByRSSMediaSource,
        updateMPAddByRSSMetadata,
        mpChannel,
        setMPChannel,
        mpItem,
        setMPItem,
        mpItemLabeledItemEnclosures,
        setMPItemLabeledItemEnclosures,
        mpEnclosureSelectedParams,
        setMPEnclosureSelectedParams,
        mpClip,
        setMPClip,
        mpItemChapter,
        setMPItemChapter,
        mpItemChapters,
        setMPItemChapters,
        mpItemChapterShouldSeek,
        setMPItemChapterShouldSeek,
        mpItemSoundbite,
        setMPItemSoundbite,
        mpIsPlaying,
        setMPIsPlaying,
        mpPlaybackMode,
        setMPPlaybackMode,
        mpPlaybackSpeed,
        setMPPlaybackSpeed,
        mpIsMuted,
        setMPIsMuted,
        mpVolume,
        setMPVolume,
        mpDuration,
        setMPDuration,
        playerModalIsOpen,
        setPlayerModalIsOpen,
        mpShouldPlay,
        setMPShouldPlay,
        addByRSSSeekToTime,
        setAddByRSSSeekToTime,
        activePlaybackTarget,
        setActivePlaybackTarget,
        pendingPlaybackDecision,
        setPendingPlaybackDecision,
        applyPlaybackLoad,
        pendingMusicQueueLoadIntentRef,
        playbackLoadGenerationRef,
        mpPlaybackError,
        setMPPlaybackError,
        reportPlaybackError,
        playbackErrorDialogOpen,
        setPlaybackErrorDialogOpen,
      }}
    >
      {children}
    </MediaPlayerContext.Provider>
  );
};

export function useMediaPlayer() {
  const ctx = useContext(MediaPlayerContext);
  if (!ctx) {
    throw new Error('useMediaPlayer must be used within a MediaPlayerProvider');
  }
  return ctx;
}
