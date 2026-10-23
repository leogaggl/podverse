-- False for a stored listen past the listener's daily popularity cap: it feeds taste rows and
-- adds nothing to daily or range totals.
ALTER TABLE public.stats_listen_event
    ADD COLUMN popularity_counted boolean DEFAULT true NOT NULL;
