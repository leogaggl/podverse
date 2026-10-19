export interface DTOChannelDescription {
  id: number;
  channel_id: number;
  /** Omitted in list responses; present on channel detail. */
  value?: string;
  preview?: string | null;
  is_truncated?: boolean;
  source_length?: number | null;
}
