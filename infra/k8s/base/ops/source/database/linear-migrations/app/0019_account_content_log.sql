-- Eligible retire count from the last Podcast Index dead-feed run that accepted it.
-- Null means no baseline yet, so the retire pass waits for a dry run.
ALTER TABLE public.podcast_index_dead_feed_sync
    ADD COLUMN last_retire_eligible_count integer;

-- One row per account per show, explaining why content left that account's library.
-- Rows are short-lived and purged by updated_at.
CREATE TABLE public.account_content_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id integer NOT NULL,
    log_type varchar(32) NOT NULL,
    channel_id_text public.nano_id_v2 NOT NULL,
    channel_title public.varchar_normal,
    reason varchar(32) NOT NULL,
    follow_outcome varchar(32),
    clip_count integer DEFAULT 0 NOT NULL,
    playlist_entry_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_content_log_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE,
    CONSTRAINT account_content_log_type_check
        CHECK (log_type IN ('removed_content')),
    CONSTRAINT account_content_log_reason_check
        CHECK (reason IN ('left_directory', 'taken_down')),
    CONSTRAINT account_content_log_follow_outcome_check
        CHECK (
            follow_outcome IS NULL
            OR follow_outcome IN ('ended', 'moved_to_add_by_rss')
        ),
    CONSTRAINT account_content_log_counts_check
        CHECK (clip_count >= 0 AND playlist_entry_count >= 0),
    CONSTRAINT account_content_log_account_type_channel_key
        UNIQUE (account_id, log_type, channel_id_text)
);

CREATE INDEX account_content_log_account_updated_idx
    ON public.account_content_log (account_id, updated_at DESC);

CREATE INDEX account_content_log_updated_at_idx
    ON public.account_content_log (updated_at);

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.account_content_log TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_content_log TO podverse_app_read;
