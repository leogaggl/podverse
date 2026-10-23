import React, { useEffect, useMemo, useRef } from 'react';

import type {
  DTOItem,
  EnclosureSelectedParams,
  LabeledItemEnclosure,
  SelectedLabeledItemEnclosureAndSource,
} from '@podverse/helpers';
import { getSelectedLabeledItemEnclosureAndSource, isEqual, isHlsSource } from '@podverse/helpers';

import type { MediaElementSource } from '../../../hooks/useMediaElementBridge';
import { MediaElement } from '../MediaElement/MediaElement';
import { resolveLivestreamSourceType } from './livestreamSourceType';

export interface MediaPlayerControllerLiveStreamAVProps {
  mediaType: 'audio' | 'video';
  mpItem: DTOItem | null;
  mpItemLabeledEnclosures: LabeledItemEnclosure[];
  mpEnclosureSelectedParams: EnclosureSelectedParams;
  style?: React.CSSProperties;
  hidden: boolean;
  mpIsPlaying: boolean;
}

function LivestreamMediaElement({
  mediaType,
  source,
  playing,
  style,
}: {
  mediaType: 'audio' | 'video';
  source: MediaElementSource;
  playing: boolean;
  style?: React.CSSProperties;
}) {
  const liveMediaRef = useRef<HTMLMediaElement | null>(null);

  useEffect(() => {
    const media = liveMediaRef.current;
    if (media === null) {
      return;
    }
    if (!playing) {
      media.pause();
      return;
    }
    const start = () => {
      void media.play().catch(() => undefined);
    };
    if (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      start();
      return;
    }
    media.addEventListener('canplay', start, { once: true });
    return () => {
      media.removeEventListener('canplay', start);
    };
  }, [playing]);

  return (
    <MediaElement
      source={source}
      isVideo={mediaType === 'video'}
      mediaRef={liveMediaRef}
      playsInline={mediaType === 'video'}
      style={{ width: '100%', ...style }}
    />
  );
}

export const MediaPlayerControllerLiveStreamAV: React.FC<
  MediaPlayerControllerLiveStreamAVProps
> = ({
  mediaType,
  mpItem,
  mpItemLabeledEnclosures,
  mpEnclosureSelectedParams,
  style,
  hidden,
  mpIsPlaying,
}) => {
  const prevSelectedRef = useRef<SelectedLabeledItemEnclosureAndSource | null>(null);

  const selectedItemEnclosureAndSource = useMemo(() => {
    const next = getSelectedLabeledItemEnclosureAndSource({
      labeledItemEnclosures: mpItemLabeledEnclosures,
      type: mpEnclosureSelectedParams.type,
      enclosureRowIndex: mpEnclosureSelectedParams.enclosureRowSelected,
      sourceRowIndex: mpEnclosureSelectedParams.sourceRowSelected,
    });
    if (isEqual(prevSelectedRef.current, next)) {
      return prevSelectedRef.current;
    }
    prevSelectedRef.current = next;
    return next;
  }, [mpItemLabeledEnclosures, mpEnclosureSelectedParams]);

  const source = useMemo((): MediaElementSource | null => {
    const labeled = selectedItemEnclosureAndSource?.labeledItemEnclosure;
    const srcObj = selectedItemEnclosureAndSource?.source;
    const srcUrl = typeof srcObj?.uri === 'string' ? srcObj.uri.trim() : '';
    if (labeled === null || labeled === undefined || srcUrl === '') {
      return null;
    }
    if (labeled.mediaType !== mediaType) {
      return null;
    }
    const srcType = resolveLivestreamSourceType(
      srcUrl,
      labeled.enclosure.type,
      srcObj?.content_type
    );
    if (!mpItem?.live_item || srcType === null) {
      return null;
    }
    return {
      kind: 'file',
      src: srcUrl,
      mimeType: srcType,
      delivery: isHlsSource(srcUrl, srcType) ? 'hls' : 'file',
    };
  }, [mediaType, mpItem?.live_item, selectedItemEnclosureAndSource]);

  const hiddenCommon = hidden || mediaType === 'audio';

  return (
    <div {...{ [`data-livestream-player-${mediaType}`]: true }} hidden={hiddenCommon} style={style}>
      {source === null ? null : (
        <LivestreamMediaElement
          key={`${source.delivery}:${source.src}`}
          mediaType={mediaType}
          source={source}
          playing={mpIsPlaying}
          style={style}
        />
      )}
    </div>
  );
};

// Each source mounts its own media element. Leaving a livestream unmounts that element, so the
// next livestream always starts from a fresh element.
