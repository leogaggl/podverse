export interface DTOItemDescription {
  id: number;
  item_id: number;
  value: string;
  preview?: string | null;
  is_truncated?: boolean;
  source_length?: number | null;
}
