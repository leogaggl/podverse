-- item_flag_status_id 3 is ItemFlagStatusStatusEnum.Archived.

ALTER TABLE public.item
    ADD COLUMN archived_slimmed_at timestamp without time zone;

ALTER TABLE public.channel
    ADD COLUMN archived_slimmed_at timestamp without time zone;

CREATE INDEX item_archived_unslimmed_idx
    ON public.item (id)
    WHERE item_flag_status_id = 3 AND archived_slimmed_at IS NULL;
