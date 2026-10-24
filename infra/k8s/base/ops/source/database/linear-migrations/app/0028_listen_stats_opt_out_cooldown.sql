-- When the account last turned Taste Profile off after a Yes. For STATS_ALL_TIME_RECOUNT_DAYS
-- after it, the listener's new listens feed the Taste Profile and count toward no popularity
-- total.
ALTER TABLE public.account_settings
    ADD COLUMN listen_stats_opted_out_at timestamp with time zone;

-- Listens stored on the UTC day of the listener's last opt-out, which the opt-out deleted. The
-- stored daily cap adds them for the rest of that day.
ALTER TABLE listener_identity.stats_listener
    ADD COLUMN opt_out_day date,
    ADD COLUMN opt_out_day_stored_count integer DEFAULT 0 NOT NULL,
    ADD COLUMN opt_out_day_first_stored_at timestamp with time zone,
    ADD CONSTRAINT stats_listener_opt_out_day_check
        CHECK ((opt_out_day IS NULL) = (opt_out_day_first_stored_at IS NULL)
               AND opt_out_day_stored_count >= 0
               AND (opt_out_day IS NOT NULL OR opt_out_day_stored_count = 0));
