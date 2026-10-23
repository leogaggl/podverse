-- True when this listen started the listener's N-day all-time period for that entity
-- (STATS_ALL_TIME_RECOUNT_DAYS): the item, the channel, or the clip.
ALTER TABLE public.stats_listen_event
    ADD COLUMN item_all_time_counted boolean DEFAULT false NOT NULL,
    ADD COLUMN channel_all_time_counted boolean DEFAULT false NOT NULL,
    ADD COLUMN clip_all_time_counted boolean DEFAULT false NOT NULL;

-- True when this open started the opener's N-day all-time period for the profile or playlist.
ALTER TABLE public.stats_open_event
    ADD COLUMN all_time_counted boolean DEFAULT false NOT NULL;

-- Listeners who added to the entity's all-time total on this day. Range totals sum this column
-- for all_time_count. Rows already stored counted every listener of their day.
ALTER TABLE public.stats_daily_channel ADD COLUMN all_time_listener_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.stats_daily_item ADD COLUMN all_time_listener_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.stats_daily_clip ADD COLUMN all_time_listener_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.stats_daily_playlist ADD COLUMN all_time_listener_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.stats_daily_account ADD COLUMN all_time_listener_count integer DEFAULT 0 NOT NULL;

UPDATE public.stats_daily_channel SET all_time_listener_count = listener_count WHERE listener_count <> 0;
UPDATE public.stats_daily_item SET all_time_listener_count = listener_count WHERE listener_count <> 0;
UPDATE public.stats_daily_clip SET all_time_listener_count = listener_count WHERE listener_count <> 0;
UPDATE public.stats_daily_playlist SET all_time_listener_count = listener_count WHERE listener_count <> 0;
UPDATE public.stats_daily_account SET all_time_listener_count = listener_count WHERE listener_count <> 0;

ALTER TABLE public.stats_daily_channel ADD CONSTRAINT stats_daily_channel_all_time_check
    CHECK (all_time_listener_count >= 0 AND all_time_listener_count <= listener_count);
ALTER TABLE public.stats_daily_item ADD CONSTRAINT stats_daily_item_all_time_check
    CHECK (all_time_listener_count >= 0 AND all_time_listener_count <= listener_count);
ALTER TABLE public.stats_daily_clip ADD CONSTRAINT stats_daily_clip_all_time_check
    CHECK (all_time_listener_count >= 0 AND all_time_listener_count <= listener_count);
ALTER TABLE public.stats_daily_playlist ADD CONSTRAINT stats_daily_playlist_all_time_check
    CHECK (all_time_listener_count >= 0 AND all_time_listener_count <= listener_count);
ALTER TABLE public.stats_daily_account ADD CONSTRAINT stats_daily_account_all_time_check
    CHECK (all_time_listener_count >= 0 AND all_time_listener_count <= listener_count);
