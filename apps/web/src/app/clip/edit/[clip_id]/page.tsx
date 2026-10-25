import { z } from 'zod';

import { RemovedClipPage } from '../../../../components/Clip/RemovedClipPage';
import { isRemovedClipHttpError } from '../../../../lib/clip/removedClip';
import { buildNoindexMetadata } from '../../../../lib/seo/buildNoindexMetadata';
import { getClipForSeoPage } from '../../../../lib/seo/fetchers';
import { ClipEditPageClient } from './ClipEditPageClient';

const searchParamsSchema = z.object({
  ers: z
    .string()
    .transform((v) => parseInt(v, 10))
    .refine((v) => !Number.isNaN(v) && v >= 0, { error: 'ers must be integer >= 0' })
    .optional(),
  ets: z.enum(['default', 'audio', 'video']).optional(),
});

type ClipEditPageProps = {
  params: Promise<{ clip_id: string }>;
  searchParams?: Promise<Record<string, string | string[]>>;
};

type ParsedClipEditParams = {
  ssrEnclosureTypeSelected: 'default' | 'audio' | 'video';
  ssrEnclosureRowSelected: number;
};

export async function generateMetadata() {
  return buildNoindexMetadata();
}

export default async function ClipEditPage({ params, searchParams }: ClipEditPageProps) {
  const { clip_id } = await params;
  const qp = searchParams ? await searchParams : {};
  const { ssrEnclosureRowSelected, ssrEnclosureTypeSelected } = parseSearchParams(qp);

  let ssrClip;
  try {
    ssrClip = await getClipForSeoPage(clip_id);
  } catch (error) {
    if (isRemovedClipHttpError(error)) {
      return <RemovedClipPage kind="visitor" />;
    }
    throw error;
  }

  return (
    <ClipEditPageClient
      ssrClip={ssrClip}
      ssrEnclosureTypeSelected={ssrEnclosureTypeSelected}
      ssrEnclosureRowSelected={ssrEnclosureRowSelected}
    />
  );
}

function parseSearchParams(
  raw: Record<string, string | string[] | undefined>
): ParsedClipEditParams {
  const normalized: Record<string, string | undefined> = {};
  Object.entries(raw).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      normalized[k] = v[0];
    } else {
      normalized[k] = v;
    }
  });
  const result = searchParamsSchema.safeParse(normalized);
  let ssrEnclosureTypeSelected: 'default' | 'audio' | 'video' = 'default';
  let ssrEnclosureRowSelected: number = 0;
  if (result.success) {
    const { ets, ers } = result.data;
    if (typeof ets === 'string' && ['default', 'audio', 'video'].includes(ets)) {
      ssrEnclosureTypeSelected = ets as 'default' | 'audio' | 'video';
    }
    if (typeof ers === 'number' && !Number.isNaN(ers) && ers >= 0) {
      ssrEnclosureRowSelected = ers;
    }
  }
  return { ssrEnclosureTypeSelected, ssrEnclosureRowSelected };
}
