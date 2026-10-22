import { notFound } from 'next/navigation';

import { isAddByRSSResourceType } from '@podverse/parser-mapping';

import { AddByRSSDetailClient } from '../../../../components/AddByRSS/Detail/AddByRSSDetailClient';

type AddByRSSDetailPageProps = {
  params: Promise<{ resource: string; id_text: string }>;
};

export default async function AddByRSSDetailPage({ params }: AddByRSSDetailPageProps) {
  const { resource, id_text: idText } = await params;

  if (!isAddByRSSResourceType(resource)) {
    notFound();
  }

  return <AddByRSSDetailClient resourceType={resource} idText={idText} />;
}
