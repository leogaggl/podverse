import { buildNoindexMetadata } from '../../../../lib/seo/buildNoindexMetadata';
import { getPlaylistForSeoPage } from '../../../../lib/seo/fetchers';
import { PlaylistEditPageClient } from './PlaylistEditPageClient';

type PlaylistEditPageProps = {
  params: Promise<{ playlist_id: string }>;
};

export async function generateMetadata() {
  return buildNoindexMetadata();
}

export default async function PlaylistEditPage({ params }: PlaylistEditPageProps) {
  const { playlist_id } = await params;
  const ssrPlaylist = await getPlaylistForSeoPage(playlist_id);

  return <PlaylistEditPageClient ssrPlaylist={ssrPlaylist} />;
}
