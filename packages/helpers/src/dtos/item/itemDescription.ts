export interface DTOItemDescription {
  id: number;
  item_id: number;
  /** Omitted in list responses; present on item detail and `GET /item/:idOrIdText/description`. */
  value?: string;
  preview?: string | null;
  is_truncated?: boolean;
  source_length?: number | null;
}
