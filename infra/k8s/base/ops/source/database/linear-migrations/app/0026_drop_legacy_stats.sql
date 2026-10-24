-- The Popularity Tracking tables replace these per-entity event, guid mapping, and rolling
-- aggregate tables, and their data is not kept.
DROP TABLE public.stats_track_event_account;
DROP TABLE public.stats_track_event_channel;
DROP TABLE public.stats_track_event_clip;
DROP TABLE public.stats_track_event_item;
DROP TABLE public.stats_track_event_playlist;

DROP TABLE public.stats_track_account_guid;

DROP TABLE public.stats_aggregated_account;
DROP TABLE public.stats_aggregated_channel;
DROP TABLE public.stats_aggregated_clip;
DROP TABLE public.stats_aggregated_item;
DROP TABLE public.stats_aggregated_playlist;
