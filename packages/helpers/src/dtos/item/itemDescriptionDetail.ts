export interface DTOItemDescriptionDetail {
  item_id_text: string;
  value: string | null;
  preview: string | null;
  is_truncated: boolean;
  source_length: number | null;
  /** The item's `<link>`; where the full notes live when `is_truncated`. */
  link_url: string | null;
}
