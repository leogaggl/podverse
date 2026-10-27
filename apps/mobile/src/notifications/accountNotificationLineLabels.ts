import type { AccountNotificationLineLabels } from '@podverse/helpers';
import { getRelativeTimeParts } from '@podverse/helpers';

export function accountNotificationLineLabels(
  t: (key: string) => string
): AccountNotificationLineLabels {
  return {
    livestream: t('notifications_page.line_livestream'),
    'livestream-scheduled': t('notifications_page.line_livestream_scheduled'),
    'livestream-started': t('notifications_page.line_livestream_started'),
    new: t('notifications_page.line_new_content'),
    'new-album': t('notifications_page.line_new_album'),
    'new-episode': t('notifications_page.line_new_episode'),
    'new-podcast': t('notifications_page.line_new_podcast'),
    'new-track': t('notifications_page.line_new_track'),
    'new-video': t('notifications_page.line_new_video'),
    'new-video-channel': t('notifications_page.line_new_video_channel'),
    'podcast-index-feed': t('notifications_page.line_podcast_index_feed'),
    systemUpdate: t('notifications_page.line_system_update'),
  };
}

type RelativeTimeTranslator = (key: string, options?: { count: number }) => string;

/** Smaller second line under a notification title, such as "2 hours ago". */
export function formatNotificationRelativeTime(isoDate: string, t: RelativeTimeTranslator): string {
  const parts = getRelativeTimeParts(isoDate);
  if (parts === null) {
    return '';
  }
  if (parts.value === 0) {
    return t('notifications_page.relative_time_just_now');
  }

  const direction = parts.value < 0 ? 'ago' : 'from_now';
  const count = Math.abs(parts.value);
  return t(`notifications_page.relative_time_${parts.unit}s_${direction}`, { count });
}
