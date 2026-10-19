'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type { DTOClip } from '@podverse/helpers';
import { Button, MainColumnStack } from '@podverse/ui';

import { ROUTES } from '../../constants/routes';
import { useConfig } from '../../contexts/Config';
import { getApiRequestService } from '../../factories/apiRequestService';
import { useMembershipGate } from '../../hooks/useMembershipGate';
import { MainWrapper } from '../Main/MainWrapper';
import { ReadableTimeRange } from '../Time/ReadableTimeRange';

type RemovedClipPageProps = { kind: 'visitor' } | { kind: 'owner'; clip: DTOClip };

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function RemovedClipPage(props: RemovedClipPageProps) {
  const tFeatures = useTranslations('features');
  const tInfo = useTranslations('info');
  const tMisc = useTranslations('misc');
  const config = useConfig();
  const router = useRouter();
  const { tryHandleMembershipGateError } = useMembershipGate();
  const sentence = tInfo('removed.clip_source_removed', {
    brand_name: config.public.brand.name,
  });

  if (props.kind === 'visitor') {
    return (
      <MainWrapper>
        <MainColumnStack>
          <p>{sentence}</p>
        </MainColumnStack>
      </MainWrapper>
    );
  }

  const { clip } = props;
  const episodeTitle = clip.removed_source?.item_title;
  const showTitle = clip.removed_source?.channel_title;

  const handleDelete = async () => {
    if (!window.confirm(tFeatures('clip.delete_clip_confirm'))) {
      return;
    }
    try {
      await getApiRequestService().reqClipDelete(clip.id_text);
      router.push(ROUTES.CLIPS);
    } catch (error) {
      if (!tryHandleMembershipGateError(error)) {
        throw error;
      }
    }
  };

  return (
    <MainWrapper>
      <MainColumnStack>
        <h1>{nonEmpty(clip.title) ? clip.title : tMisc('untitled')}</h1>
        <p>
          <ReadableTimeRange startTime={clip.start_time} endTime={clip.end_time} />
        </p>
        {nonEmpty(episodeTitle) ? <p>{episodeTitle}</p> : null}
        {nonEmpty(showTitle) ? <p>{showTitle}</p> : null}
        <p>{sentence}</p>
        <Button variant="danger" type="button" onClick={handleDelete}>
          {tFeatures('clip.delete_clip')}
        </Button>
      </MainColumnStack>
    </MainWrapper>
  );
}
