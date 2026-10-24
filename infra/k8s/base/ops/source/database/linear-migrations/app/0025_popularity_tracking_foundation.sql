-- Popularity Tracking stores: the account-to-listener mapping, monthly-partitioned listen and open
-- events, per-show taste profiles, and anonymous daily and range totals. Contracts and lifetimes are
-- in docs/features/POPULARITY-TRACKING.md.

-- The only link from an account to its listener id. It lives in its own schema so that no grant on
-- public, default privilege, or bulk re-grant reaches it; only the read-write role has USAGE.
CREATE SCHEMA listener_identity;

CREATE TABLE listener_identity.stats_listener (
    listener_id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stats_listener_pkey PRIMARY KEY (listener_id),
    CONSTRAINT stats_listener_account_id_key UNIQUE (account_id),
    CONSTRAINT stats_listener_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE
);

-- One row per counted listen. created_at is server receive time and the only clock.
CREATE SEQUENCE public.stats_listen_event_id_seq AS bigint;

CREATE TABLE public.stats_listen_event (
    id bigint DEFAULT nextval('public.stats_listen_event_id_seq') NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    listener_id uuid NOT NULL,
    channel_id integer NOT NULL,
    item_id integer NOT NULL,
    clip_id integer,
    client_listen_id uuid,
    seconds_heard integer DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    CONSTRAINT stats_listen_event_pkey PRIMARY KEY (created_at, id),
    CONSTRAINT stats_listen_event_listener_id_fkey
        FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE,
    CONSTRAINT stats_listen_event_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE,
    CONSTRAINT stats_listen_event_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE,
    CONSTRAINT stats_listen_event_clip_id_fkey
        FOREIGN KEY (clip_id) REFERENCES public.clip(id) ON DELETE CASCADE,
    CONSTRAINT stats_listen_event_seconds_heard_check CHECK (seconds_heard >= 0)
) PARTITION BY RANGE (created_at);

ALTER SEQUENCE public.stats_listen_event_id_seq OWNED BY public.stats_listen_event.id;

CREATE TABLE public.stats_listen_event_default PARTITION OF public.stats_listen_event DEFAULT;

CREATE INDEX stats_listen_event_listener_created_idx
    ON public.stats_listen_event (listener_id, created_at);

CREATE INDEX stats_listen_event_item_id_idx ON public.stats_listen_event (item_id);

CREATE INDEX stats_listen_event_channel_id_idx ON public.stats_listen_event (channel_id);

CREATE INDEX stats_listen_event_clip_id_idx
    ON public.stats_listen_event (clip_id) WHERE clip_id IS NOT NULL;

-- Profile and playlist opens. They count toward popularity and never feed taste profiles.
CREATE SEQUENCE public.stats_open_event_id_seq AS bigint;

CREATE TABLE public.stats_open_event (
    id bigint DEFAULT nextval('public.stats_open_event_id_seq') NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    listener_id uuid NOT NULL,
    account_id integer,
    playlist_id integer,
    CONSTRAINT stats_open_event_pkey PRIMARY KEY (created_at, id),
    CONSTRAINT stats_open_event_listener_id_fkey
        FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE,
    CONSTRAINT stats_open_event_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE,
    CONSTRAINT stats_open_event_playlist_id_fkey
        FOREIGN KEY (playlist_id) REFERENCES public.playlist(id) ON DELETE CASCADE,
    CONSTRAINT stats_open_event_target_check CHECK (num_nonnulls(account_id, playlist_id) = 1)
) PARTITION BY RANGE (created_at);

ALTER SEQUENCE public.stats_open_event_id_seq OWNED BY public.stats_open_event.id;

CREATE TABLE public.stats_open_event_default PARTITION OF public.stats_open_event DEFAULT;

CREATE INDEX stats_open_event_listener_created_idx
    ON public.stats_open_event (listener_id, created_at);

CREATE INDEX stats_open_event_account_id_idx
    ON public.stats_open_event (account_id) WHERE account_id IS NOT NULL;

CREATE INDEX stats_open_event_playlist_id_idx
    ON public.stats_open_event (playlist_id) WHERE playlist_id IS NOT NULL;

-- One row per listener and show. Scores are stored faded to scores_updated_at.
CREATE TABLE public.stats_taste_profile (
    listener_id uuid NOT NULL,
    channel_id integer NOT NULL,
    listen_count integer DEFAULT 0 NOT NULL,
    completion_count integer DEFAULT 0 NOT NULL,
    first_listened_at timestamp with time zone NOT NULL,
    last_listened_at timestamp with time zone NOT NULL,
    recent_score double precision DEFAULT 0 NOT NULL,
    long_term_score double precision DEFAULT 0 NOT NULL,
    scores_updated_at timestamp with time zone NOT NULL,
    CONSTRAINT stats_taste_profile_pkey PRIMARY KEY (listener_id, channel_id),
    CONSTRAINT stats_taste_profile_listener_id_fkey
        FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE,
    CONSTRAINT stats_taste_profile_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE,
    CONSTRAINT stats_taste_profile_counts_check
        CHECK (listen_count >= 0 AND completion_count >= 0),
    CONSTRAINT stats_taste_profile_scores_check
        CHECK (recent_score >= 0 AND long_term_score >= 0),
    CONSTRAINT stats_taste_profile_listened_order_check
        CHECK (first_listened_at <= last_listened_at)
);

CREATE INDEX stats_taste_profile_channel_id_idx ON public.stats_taste_profile (channel_id);

-- Hidden From Taste Profile: shows that listening never adds back to the taste profile.
CREATE TABLE public.stats_taste_profile_hidden (
    listener_id uuid NOT NULL,
    channel_id integer NOT NULL,
    hidden_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stats_taste_profile_hidden_pkey PRIMARY KEY (listener_id, channel_id),
    CONSTRAINT stats_taste_profile_hidden_listener_id_fkey
        FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE,
    CONSTRAINT stats_taste_profile_hidden_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE
);

CREATE INDEX stats_taste_profile_hidden_channel_id_idx
    ON public.stats_taste_profile_hidden (channel_id);

-- Anonymous daily totals per entity and UTC day of the counted events' created_at.
CREATE TABLE public.stats_daily_channel (
    channel_id integer NOT NULL,
    day date NOT NULL,
    listener_count integer DEFAULT 0 NOT NULL,
    completion_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_daily_channel_pkey PRIMARY KEY (channel_id, day),
    CONSTRAINT stats_daily_channel_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE,
    CONSTRAINT stats_daily_channel_counts_check
        CHECK (listener_count >= 0 AND completion_count >= 0 AND completion_count <= listener_count)
);

CREATE INDEX stats_daily_channel_day_idx
    ON public.stats_daily_channel (day, channel_id) INCLUDE (listener_count);

CREATE TABLE public.stats_daily_item (
    item_id integer NOT NULL,
    day date NOT NULL,
    listener_count integer DEFAULT 0 NOT NULL,
    completion_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_daily_item_pkey PRIMARY KEY (item_id, day),
    CONSTRAINT stats_daily_item_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE,
    CONSTRAINT stats_daily_item_counts_check
        CHECK (listener_count >= 0 AND completion_count >= 0 AND completion_count <= listener_count)
);

CREATE INDEX stats_daily_item_day_idx
    ON public.stats_daily_item (day, item_id) INCLUDE (listener_count);

CREATE TABLE public.stats_daily_clip (
    clip_id integer NOT NULL,
    day date NOT NULL,
    listener_count integer DEFAULT 0 NOT NULL,
    completion_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_daily_clip_pkey PRIMARY KEY (clip_id, day),
    CONSTRAINT stats_daily_clip_clip_id_fkey
        FOREIGN KEY (clip_id) REFERENCES public.clip(id) ON DELETE CASCADE,
    CONSTRAINT stats_daily_clip_counts_check
        CHECK (listener_count >= 0 AND completion_count >= 0 AND completion_count <= listener_count)
);

CREATE INDEX stats_daily_clip_day_idx
    ON public.stats_daily_clip (day, clip_id) INCLUDE (listener_count);

CREATE TABLE public.stats_daily_playlist (
    playlist_id integer NOT NULL,
    day date NOT NULL,
    listener_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_daily_playlist_pkey PRIMARY KEY (playlist_id, day),
    CONSTRAINT stats_daily_playlist_playlist_id_fkey
        FOREIGN KEY (playlist_id) REFERENCES public.playlist(id) ON DELETE CASCADE,
    CONSTRAINT stats_daily_playlist_counts_check CHECK (listener_count >= 0)
);

CREATE INDEX stats_daily_playlist_day_idx
    ON public.stats_daily_playlist (day, playlist_id) INCLUDE (listener_count);

-- account_id is the profile that was opened.
CREATE TABLE public.stats_daily_account (
    account_id integer NOT NULL,
    day date NOT NULL,
    listener_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_daily_account_pkey PRIMARY KEY (account_id, day),
    CONSTRAINT stats_daily_account_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE,
    CONSTRAINT stats_daily_account_counts_check CHECK (listener_count >= 0)
);

CREATE INDEX stats_daily_account_day_idx
    ON public.stats_daily_account (day, account_id) INCLUDE (listener_count);

-- Range totals, rebuilt from the daily totals. Public and management sorts read these.
CREATE TABLE public.stats_popularity_channel (
    channel_id integer NOT NULL,
    day_count integer DEFAULT 0 NOT NULL,
    week_count integer DEFAULT 0 NOT NULL,
    month_count integer DEFAULT 0 NOT NULL,
    all_time_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_popularity_channel_pkey PRIMARY KEY (channel_id),
    CONSTRAINT stats_popularity_channel_channel_id_fkey
        FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE
);

CREATE INDEX stats_popularity_channel_day_count_idx
    ON public.stats_popularity_channel (day_count DESC, channel_id);
CREATE INDEX stats_popularity_channel_week_count_idx
    ON public.stats_popularity_channel (week_count DESC, channel_id);
CREATE INDEX stats_popularity_channel_month_count_idx
    ON public.stats_popularity_channel (month_count DESC, channel_id);
CREATE INDEX stats_popularity_channel_all_time_count_idx
    ON public.stats_popularity_channel (all_time_count DESC, channel_id);

CREATE TABLE public.stats_popularity_item (
    item_id integer NOT NULL,
    day_count integer DEFAULT 0 NOT NULL,
    week_count integer DEFAULT 0 NOT NULL,
    month_count integer DEFAULT 0 NOT NULL,
    all_time_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_popularity_item_pkey PRIMARY KEY (item_id),
    CONSTRAINT stats_popularity_item_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE
);

CREATE INDEX stats_popularity_item_day_count_idx
    ON public.stats_popularity_item (day_count DESC, item_id);
CREATE INDEX stats_popularity_item_week_count_idx
    ON public.stats_popularity_item (week_count DESC, item_id);
CREATE INDEX stats_popularity_item_month_count_idx
    ON public.stats_popularity_item (month_count DESC, item_id);
CREATE INDEX stats_popularity_item_all_time_count_idx
    ON public.stats_popularity_item (all_time_count DESC, item_id);

CREATE TABLE public.stats_popularity_clip (
    clip_id integer NOT NULL,
    day_count integer DEFAULT 0 NOT NULL,
    week_count integer DEFAULT 0 NOT NULL,
    month_count integer DEFAULT 0 NOT NULL,
    all_time_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_popularity_clip_pkey PRIMARY KEY (clip_id),
    CONSTRAINT stats_popularity_clip_clip_id_fkey
        FOREIGN KEY (clip_id) REFERENCES public.clip(id) ON DELETE CASCADE
);

CREATE INDEX stats_popularity_clip_day_count_idx
    ON public.stats_popularity_clip (day_count DESC, clip_id);
CREATE INDEX stats_popularity_clip_week_count_idx
    ON public.stats_popularity_clip (week_count DESC, clip_id);
CREATE INDEX stats_popularity_clip_month_count_idx
    ON public.stats_popularity_clip (month_count DESC, clip_id);
CREATE INDEX stats_popularity_clip_all_time_count_idx
    ON public.stats_popularity_clip (all_time_count DESC, clip_id);

CREATE TABLE public.stats_popularity_playlist (
    playlist_id integer NOT NULL,
    day_count integer DEFAULT 0 NOT NULL,
    week_count integer DEFAULT 0 NOT NULL,
    month_count integer DEFAULT 0 NOT NULL,
    all_time_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_popularity_playlist_pkey PRIMARY KEY (playlist_id),
    CONSTRAINT stats_popularity_playlist_playlist_id_fkey
        FOREIGN KEY (playlist_id) REFERENCES public.playlist(id) ON DELETE CASCADE
);

CREATE INDEX stats_popularity_playlist_day_count_idx
    ON public.stats_popularity_playlist (day_count DESC, playlist_id);
CREATE INDEX stats_popularity_playlist_week_count_idx
    ON public.stats_popularity_playlist (week_count DESC, playlist_id);
CREATE INDEX stats_popularity_playlist_month_count_idx
    ON public.stats_popularity_playlist (month_count DESC, playlist_id);
CREATE INDEX stats_popularity_playlist_all_time_count_idx
    ON public.stats_popularity_playlist (all_time_count DESC, playlist_id);

CREATE TABLE public.stats_popularity_account (
    account_id integer NOT NULL,
    day_count integer DEFAULT 0 NOT NULL,
    week_count integer DEFAULT 0 NOT NULL,
    month_count integer DEFAULT 0 NOT NULL,
    all_time_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_popularity_account_pkey PRIMARY KEY (account_id),
    CONSTRAINT stats_popularity_account_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE
);

CREATE INDEX stats_popularity_account_day_count_idx
    ON public.stats_popularity_account (day_count DESC, account_id);
CREATE INDEX stats_popularity_account_week_count_idx
    ON public.stats_popularity_account (week_count DESC, account_id);
CREATE INDEX stats_popularity_account_month_count_idx
    ON public.stats_popularity_account (month_count DESC, account_id);
CREATE INDEX stats_popularity_account_all_time_count_idx
    ON public.stats_popularity_account (all_time_count DESC, account_id);

-- Creates <parent>_pYYYYMM for one UTC month and returns false when it already exists. Rows that
-- reached the default partition for that month move into the new partition. Locking the parent
-- locks every partition, the default included, so inserts wait for the move; taking the parent
-- before its partitions matches the order inserts lock in, so the two cannot deadlock.
CREATE FUNCTION public.stats_event_ensure_month_partition(parent_table text, month_start date)
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
AS $$
DECLARE
    partition_name text;
    default_name text;
    range_start timestamp with time zone;
    range_end timestamp with time zone;
    default_has_rows boolean;
BEGIN
    IF parent_table IS NULL OR parent_table NOT IN ('stats_listen_event', 'stats_open_event') THEN
        RAISE EXCEPTION 'unsupported partitioned table: %', parent_table
            USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF month_start IS NULL OR month_start <> date_trunc('month', month_start)::date THEN
        RAISE EXCEPTION 'month_start must be the first day of a month: %', month_start
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    partition_name := parent_table || '_p' || to_char(month_start, 'YYYYMM');
    default_name := parent_table || '_default';
    range_start := month_start::timestamp AT TIME ZONE 'UTC';
    range_end := (month_start + interval '1 month')::timestamp AT TIME ZONE 'UTC';

    IF to_regclass(format('public.%I', partition_name)) IS NOT NULL THEN
        RETURN false;
    END IF;

    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', parent_table);

    IF to_regclass(format('public.%I', partition_name)) IS NOT NULL THEN
        RETURN false;
    END IF;

    EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.%I WHERE created_at >= $1 AND created_at < $2)',
        default_name
    ) INTO default_has_rows USING range_start, range_end;

    IF default_has_rows THEN
        EXECUTE format('ALTER TABLE public.%I DETACH PARTITION public.%I', parent_table, default_name);
    END IF;

    EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
        partition_name, parent_table, range_start, range_end
    );

    IF default_has_rows THEN
        EXECUTE format(
            'WITH moved AS (DELETE FROM public.%I WHERE created_at >= $1 AND created_at < $2 RETURNING *) '
                || 'INSERT INTO public.%I SELECT * FROM moved',
            default_name, partition_name
        ) USING range_start, range_end;
        EXECUTE format('ALTER TABLE public.%I ATTACH PARTITION public.%I DEFAULT', parent_table, default_name);
    END IF;

    RETURN true;
END;
$$;

-- Drops every <parent>_pYYYYMM partition that ends on or before cutoff (UTC midnight), deletes
-- older rows from the default partition, and returns how many partitions it dropped. A partition
-- whose range reaches past cutoff is never touched.
CREATE FUNCTION public.stats_event_drop_month_partitions_before(parent_table text, cutoff date)
    RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
AS $$
DECLARE
    partition_row record;
    dropped integer := 0;
BEGIN
    IF parent_table IS NULL OR parent_table NOT IN ('stats_listen_event', 'stats_open_event') THEN
        RAISE EXCEPTION 'unsupported partitioned table: %', parent_table
            USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF cutoff IS NULL THEN
        RAISE EXCEPTION 'cutoff is required' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', parent_table);

    FOR partition_row IN
        SELECT child.relname::text AS partition_name,
               to_date(substring(child.relname::text FROM '_p([0-9]{6})$'), 'YYYYMM') AS month_start
        FROM pg_inherits
        JOIN pg_class child ON child.oid = pg_inherits.inhrelid
        WHERE pg_inherits.inhparent = to_regclass(format('public.%I', parent_table))
          AND child.relname::text ~ ('^' || parent_table || '_p[0-9]{6}$')
        ORDER BY child.relname
    LOOP
        IF (partition_row.month_start + interval '1 month')::date <= cutoff THEN
            EXECUTE format('DROP TABLE public.%I', partition_row.partition_name);
            dropped := dropped + 1;
        END IF;
    END LOOP;

    EXECUTE format('DELETE FROM public.%I WHERE created_at < $1', parent_table || '_default')
        USING cutoff::timestamp AT TIME ZONE 'UTC';

    RETURN dropped;
END;
$$;

GRANT USAGE ON SCHEMA listener_identity TO podverse_app_read_write;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE listener_identity.stats_listener TO podverse_app_read_write;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_listen_event TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_listen_event TO podverse_app_read;
GRANT SELECT, USAGE, UPDATE ON SEQUENCE public.stats_listen_event_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.stats_listen_event_id_seq TO podverse_app_read;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_open_event TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_open_event TO podverse_app_read;
GRANT SELECT, USAGE, UPDATE ON SEQUENCE public.stats_open_event_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.stats_open_event_id_seq TO podverse_app_read;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_taste_profile TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_taste_profile TO podverse_app_read;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_taste_profile_hidden TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_taste_profile_hidden TO podverse_app_read;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_daily_channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_daily_channel TO podverse_app_read;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_daily_item TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_daily_item TO podverse_app_read;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_daily_clip TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_daily_clip TO podverse_app_read;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_daily_playlist TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_daily_playlist TO podverse_app_read;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_daily_account TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_daily_account TO podverse_app_read;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_popularity_channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_popularity_channel TO podverse_app_read;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_popularity_item TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_popularity_item TO podverse_app_read;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_popularity_clip TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_popularity_clip TO podverse_app_read;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_popularity_playlist TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_popularity_playlist TO podverse_app_read;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.stats_popularity_account TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_popularity_account TO podverse_app_read;

REVOKE ALL ON FUNCTION public.stats_event_ensure_month_partition(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stats_event_ensure_month_partition(text, date) TO podverse_app_read_write;

REVOKE ALL ON FUNCTION public.stats_event_drop_month_partitions_before(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stats_event_drop_month_partitions_before(text, date) TO podverse_app_read_write;
