-- A channel whose feed has carried a podcast:liveItem at least once. The parser sets it and never
-- clears it, so it outlasts the live item itself, which is archived once it leaves the feed.
ALTER TABLE public.channel
    ADD COLUMN may_have_live_items boolean DEFAULT false NOT NULL;

UPDATE public.channel
SET may_have_live_items = true
WHERE id IN (
    SELECT item.channel_id
    FROM public.live_item
    JOIN public.item ON item.id = live_item.item_id
);
