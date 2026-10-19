export type AccountContentLogType = 'removed_content';
export type AccountContentLogReason = 'left_directory' | 'taken_down';
export type AccountContentLogFollowOutcome = 'ended' | 'moved_to_add_by_rss';

/** One show's entry in the signed-in account's content log. `id` is a bigint as a string. */
export type DTOAccountContentLog = {
  id: string;
  log_type: AccountContentLogType;
  channel_id_text: string;
  channel_title: string | null;
  reason: AccountContentLogReason;
  follow_outcome: AccountContentLogFollowOutcome | null;
  clip_count: number;
  playlist_entry_count: number;
  updated_at: string;
};
