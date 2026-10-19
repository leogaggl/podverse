'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

import type { DTOClip } from '@podverse/helpers';
import { hhmmssToSecondsNumeric } from '@podverse/helpers';

import { ClipForm } from '../../../../components/Clip/ClipForm';
import { useAutoQueue } from '../../../../contexts/AutoQueue';
import { getApiRequestService } from '../../../../factories/apiRequestService';
import { useMembershipGate } from '../../../../hooks/useMembershipGate';
import { useClipEditPageContext } from './ClipEditPageContext';

type ClipEditPageFormProps = {
  ssrClip: DTOClip;
};

export const ClipEditPageForm: React.FC<ClipEditPageFormProps> = ({ ssrClip }) => {
  const router = useRouter();
  const { tryHandleMembershipGateError } = useMembershipGate();
  const {
    sharableStatus,
    setSharableStatus,
    title,
    setTitle,
    startTimeString,
    setStartTimeString,
    endTimeString,
    setEndTimeString,
    isUpdating,
    setIsUpdating,
  } = useClipEditPageContext();

  const { setAutoQueueConfig, autoQueueConfig } = useAutoQueue();

  const clipItem = ssrClip.item ?? null;
  if (clipItem === null) {
    return null;
  }

  const onCancel = () => {
    setAutoQueueConfig({
      playlist_id_text: autoQueueConfig.playlist_id_text,
      disabled: false,
      random: autoQueueConfig.random,
      repeat: autoQueueConfig.repeat,
      nextPage: autoQueueConfig.nextPage,
      shuffleHash: autoQueueConfig.shuffleHash,
    });
    router.push('/');
  };

  const onSubmit = async () => {
    setIsUpdating(true);

    const finalTitle = title?.trim();
    const finalSharableStatusId = parseInt(sharableStatus, 10);
    const finalStartTime = hhmmssToSecondsNumeric(startTimeString);
    const finalEndTime = endTimeString ? hhmmssToSecondsNumeric(endTimeString) : null;

    try {
      const clip = await getApiRequestService().reqClipUpdate(ssrClip.id_text, {
        item_id_text: clipItem.id_text,
        sharable_status_id: finalSharableStatusId,
        title: finalTitle,
        description: '',
        start_time: finalStartTime,
        end_time: finalEndTime,
      });

      setAutoQueueConfig({
        playlist_id_text: autoQueueConfig.playlist_id_text,
        disabled: false,
        random: autoQueueConfig.random,
        repeat: autoQueueConfig.repeat,
        nextPage: autoQueueConfig.nextPage,
        shuffleHash: autoQueueConfig.shuffleHash,
      });

      router.push(`/clip/${clip.id_text}`);
    } catch (error) {
      if (!tryHandleMembershipGateError(error)) {
        throw error;
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const channel = clipItem.channel;
  if (channel === null || channel === undefined) {
    return null;
  }

  return (
    <ClipForm
      channel={channel}
      item={clipItem}
      sharableStatus={sharableStatus}
      setSharableStatus={setSharableStatus}
      title={title}
      setTitle={setTitle}
      startTimeString={startTimeString}
      setStartTimeString={setStartTimeString}
      endTimeString={endTimeString}
      setEndTimeString={setEndTimeString}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isUpdating={isUpdating}
      edit_clip_id_text={ssrClip.id_text}
    />
  );
};
