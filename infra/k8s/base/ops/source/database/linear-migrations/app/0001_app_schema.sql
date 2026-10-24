-- GENERATED FILE (do not edit) — see scripts/database/squash-linear-migrations.sh

-- App schema + reference data (apply after 0000_init_helpers.sql).

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3 (Debian 18.3-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: listener_identity; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA listener_identity;


--
-- Name: account_fcm_device_platform_options; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_fcm_device_platform_options AS ENUM (
    'web',
    'ios',
    'android'
);


--
-- Name: list_position; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: media_player_time; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: nano_id_v2; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: notification_category_options; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_category_options AS ENUM (
    'new-content',
    'livestream',
    'product-update',
    'maintenance',
    'terms-of-service',
    'general'
);


--
-- Name: notification_channel_type_options; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_channel_type_options AS ENUM (
    'new-item',
    'livestream-scheduled',
    'livestream-started'
);


--
-- Name: numeric_20_11; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: on_demand_parser_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.on_demand_parser_event_type AS ENUM (
    'add',
    'refresh',
    'remoteItem'
);


--
-- Name: server_time; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: server_time_with_default; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_email; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_fcm_token; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_fqdn; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_guid; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_locale; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_long; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_longer; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_md5; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_normal; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_password; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_short; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_slug; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_uri; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: varchar_url; Type: DOMAIN; Schema: public; Owner: -
--



--
-- Name: add_by_rss_hash_id_from_feed(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_by_rss_hash_id_from_feed(feed_url text, guid text, enclosure_url text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT md5(
    '{"feed_url":' || to_json(public.add_by_rss_js_trim(feed_url))::text ||
    CASE
      WHEN NULLIF(public.add_by_rss_js_trim(guid), '') IS NOT NULL
        THEN ',"guid":' || to_json(public.add_by_rss_js_trim(guid))::text
      WHEN NULLIF(public.add_by_rss_js_trim(enclosure_url), '') IS NOT NULL
        THEN ',"enclosure_url":' || to_json(public.add_by_rss_js_trim(enclosure_url))::text
      ELSE ''
    END || '}'
  )
$$;


--
-- Name: add_by_rss_hash_id_from_resource_data(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_by_rss_hash_id_from_resource_data(data jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN NULLIF(public.add_by_rss_js_trim(data->>'feed_url'), '') IS NULL THEN NULL
    ELSE public.add_by_rss_hash_id_from_feed(
      data->>'feed_url',
      CASE
        WHEN public.add_by_rss_is_device_local_guid(data->>'guid', data->>'channel_id_text')
          THEN NULL
        ELSE data->>'guid'
      END,
      data->>'enclosure_url'
    )
  END
$$;


--
-- Name: add_by_rss_is_device_local_guid(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_by_rss_is_device_local_guid(guid text, channel_id_text text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
  SELECT COALESCE(
    NULLIF(public.add_by_rss_js_trim(channel_id_text), '') IS NOT NULL
      AND left(
        public.add_by_rss_js_trim(guid),
        length(public.add_by_rss_js_trim(channel_id_text)) + 1
      ) = public.add_by_rss_js_trim(channel_id_text) || '-'
      AND substr(
        public.add_by_rss_js_trim(guid),
        length(public.add_by_rss_js_trim(channel_id_text)) + 2
      ) ~ '^[0-9]+$',
    false
  )
$_$;


--
-- Name: add_by_rss_js_trim(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_by_rss_js_trim(value text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT btrim(
    value,
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
  )
$$;


--
-- Name: enforce_playlist_resource_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_playlist_resource_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    resource_count INTEGER;
    max_resources CONSTANT INTEGER := 10000;
BEGIN
    SELECT COUNT(*) INTO resource_count
    FROM playlist_resource
    WHERE playlist_id = NEW.playlist_id;

    IF resource_count >= max_resources THEN
        RAISE EXCEPTION 'Playlist % cannot have more than % resources', NEW.playlist_id, max_resources;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: enforce_queue_resource_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_queue_resource_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    resource_count INTEGER;
    max_resources CONSTANT INTEGER := 10000;
    min_id INTEGER;
BEGIN
    SELECT COUNT(*) INTO resource_count
    FROM queue_resource
    WHERE queue_id = NEW.queue_id;

    IF resource_count >= max_resources THEN
        -- Evict the oldest listened history row first so retention follows history ordering.
        SELECT id INTO min_id
        FROM queue_resource
        WHERE queue_id = NEW.queue_id
          AND list_position < 0
        ORDER BY last_played_at ASC NULLS FIRST, list_position ASC
        LIMIT 1;

        IF min_id IS NULL THEN
            -- Fallback when a queue has no history rows yet (all upcoming/now-playing).
            SELECT id INTO min_id
            FROM queue_resource
            WHERE queue_id = NEW.queue_id
            ORDER BY list_position ASC
            LIMIT 1;
        END IF;

        IF min_id IS NOT NULL THEN
            DELETE FROM queue_resource WHERE id = min_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: feed_after_insert_lifecycle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.feed_after_insert_lifecycle() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO feed_lifecycle_state (
    feed_id,
    feed_lifecycle_state_type_id,
    reason_key,
    note,
    updated_by_source
  )
  VALUES (
    NEW.id,
    (SELECT id FROM feed_lifecycle_state_type WHERE state_key = 'active' LIMIT 1),
    NULL,
    NULL,
    'system'
  );
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at_field(); Type: FUNCTION; Schema: public; Owner: -
--



--
-- Name: stats_event_drop_month_partitions_before(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stats_event_drop_month_partitions_before(parent_table text, cutoff date) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
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
$_$;


--
-- Name: stats_event_ensure_month_partition(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stats_event_ensure_month_partition(parent_table text, month_start date) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
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
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: stats_listener; Type: TABLE; Schema: listener_identity; Owner: -
--

CREATE TABLE listener_identity.stats_listener (
    listener_id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    opt_out_day date,
    opt_out_day_stored_count integer DEFAULT 0 NOT NULL,
    opt_out_day_first_stored_at timestamp with time zone,
    CONSTRAINT stats_listener_opt_out_day_check CHECK ((((opt_out_day IS NULL) = (opt_out_day_first_stored_at IS NULL)) AND (opt_out_day_stored_count >= 0) AND ((opt_out_day IS NOT NULL) OR (opt_out_day_stored_count = 0))))
);


--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id integer NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    verified boolean DEFAULT false,
    sharable_status_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    notifications_last_read_at timestamp with time zone,
    billing_customer_ref uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: account_api_key; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_api_key (
    id bigint NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    account_id integer NOT NULL,
    name public.varchar_short NOT NULL,
    token_hash character varying(64) NOT NULL,
    token_hint character varying(4) NOT NULL,
    permissions jsonb NOT NULL,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_api_key_name_check CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT account_api_key_permissions_check CHECK ((jsonb_typeof(permissions) = 'object'::text))
);


--
-- Name: account_api_key_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account_api_key ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.account_api_key_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: account_content_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_content_log (
    id bigint NOT NULL,
    account_id integer NOT NULL,
    log_type character varying(32) NOT NULL,
    channel_id_text public.nano_id_v2 NOT NULL,
    channel_title public.varchar_normal,
    reason character varying(32) NOT NULL,
    follow_outcome character varying(32),
    clip_count integer DEFAULT 0 NOT NULL,
    playlist_entry_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_content_log_counts_check CHECK (((clip_count >= 0) AND (playlist_entry_count >= 0))),
    CONSTRAINT account_content_log_follow_outcome_check CHECK (((follow_outcome IS NULL) OR ((follow_outcome)::text = ANY (ARRAY[('ended'::character varying)::text, ('moved_to_add_by_rss'::character varying)::text])))),
    CONSTRAINT account_content_log_reason_check CHECK (((reason)::text = ANY (ARRAY[('left_directory'::character varying)::text, ('taken_down'::character varying)::text]))),
    CONSTRAINT account_content_log_type_check CHECK (((log_type)::text = 'removed_content'::text))
);


--
-- Name: account_content_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account_content_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.account_content_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: account_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_credentials (
    id integer NOT NULL,
    account_id integer NOT NULL,
    email public.varchar_email,
    username character varying(32),
    password public.varchar_password NOT NULL,
    CONSTRAINT account_credentials_username_check CHECK ((length((username)::text) >= 3)),
    CONSTRAINT chk_account_credentials_email_or_username CHECK (((email IS NOT NULL) OR (username IS NOT NULL)))
);


--
-- Name: account_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_credentials_id_seq OWNED BY public.account_credentials.id;


--
-- Name: account_device_auto_download_channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_device_auto_download_channel (
    id integer NOT NULL,
    account_id integer NOT NULL,
    installation_id character varying(36) NOT NULL,
    channel_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: account_device_auto_download_channel_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account_device_auto_download_channel ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.account_device_auto_download_channel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: account_email_change_verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_email_change_verification (
    id integer NOT NULL,
    account_id integer NOT NULL,
    verification_token public.varchar_guid,
    verification_token_expires_at timestamp without time zone,
    pending_email_address public.varchar_email
);


--
-- Name: account_email_change_verification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_email_change_verification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_email_change_verification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_email_change_verification_id_seq OWNED BY public.account_email_change_verification.id;


--
-- Name: account_fcm_device; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_fcm_device (
    id integer NOT NULL,
    account_id integer NOT NULL,
    fcm_token public.varchar_fcm_token NOT NULL,
    installation_id public.varchar_guid NOT NULL,
    platform public.account_fcm_device_platform_options NOT NULL,
    locale public.varchar_locale NOT NULL,
    created_at public.server_time_with_default NOT NULL,
    updated_at public.server_time_with_default NOT NULL
);


--
-- Name: account_fcm_device_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_fcm_device_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_fcm_device_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_fcm_device_id_seq OWNED BY public.account_fcm_device.id;


--
-- Name: account_following_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_following_account (
    account_id integer NOT NULL,
    following_account_id integer NOT NULL
);


--
-- Name: account_following_add_by_rss_channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_following_add_by_rss_channel (
    account_id integer NOT NULL,
    feed_url public.varchar_url NOT NULL,
    title public.varchar_normal,
    image_url public.varchar_url,
    last_seen_at timestamp with time zone,
    requires_credentials boolean DEFAULT false CONSTRAINT account_following_add_by_rss_chan_requires_credentials_not_null NOT NULL
);


--
-- Name: account_following_channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_following_channel (
    account_id integer NOT NULL,
    channel_id integer NOT NULL,
    last_seen_at timestamp with time zone
);


--
-- Name: account_following_playlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_following_playlist (
    account_id integer NOT NULL,
    playlist_id integer NOT NULL
);


--
-- Name: account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_id_seq OWNED BY public.account.id;


--
-- Name: account_membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_membership (
    id integer NOT NULL,
    tier text,
    CONSTRAINT account_membership_tier_check CHECK ((tier = ANY (ARRAY['trial'::text, 'premium'::text])))
);


--
-- Name: account_membership_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_membership_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_membership_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_membership_id_seq OWNED BY public.account_membership.id;


--
-- Name: account_membership_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_membership_status (
    id integer NOT NULL,
    account_id integer NOT NULL,
    account_membership_id integer NOT NULL,
    membership_expires_at timestamp without time zone,
    allow_directory_add_by_rss boolean,
    max_add_by_rss_feeds integer,
    max_manual_refreshes_per_hour integer,
    track_stats boolean,
    allow_notifications boolean,
    billing_cadence text,
    last_extension_idempotency_key character varying(128),
    CONSTRAINT account_membership_status_billing_cadence_check CHECK ((billing_cadence = ANY (ARRAY['monthly'::text, 'annual'::text]))),
    CONSTRAINT account_membership_status_max_add_by_rss_feeds_check CHECK (((max_add_by_rss_feeds IS NULL) OR (max_add_by_rss_feeds >= 0))),
    CONSTRAINT account_membership_status_max_manual_refreshes_per_hour_check CHECK (((max_manual_refreshes_per_hour IS NULL) OR (max_manual_refreshes_per_hour >= 0)))
);


--
-- Name: account_membership_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_membership_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_membership_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_membership_status_id_seq OWNED BY public.account_membership_status.id;


--
-- Name: account_metaboost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_metaboost (
    account_id integer NOT NULL,
    sender_guid uuid NOT NULL
);


--
-- Name: account_notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_notification (
    id integer NOT NULL,
    account_id integer NOT NULL,
    category public.notification_category_options NOT NULL,
    title public.varchar_normal NOT NULL,
    body text,
    link_path public.varchar_normal,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '1 mon'::interval) NOT NULL,
    read_at timestamp with time zone
);


--
-- Name: account_notification_channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_notification_channel (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    account_id integer NOT NULL
);


--
-- Name: account_notification_channel_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_notification_channel_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_notification_channel_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_notification_channel_id_seq OWNED BY public.account_notification_channel.id;


--
-- Name: account_notification_channel_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_notification_channel_type (
    id integer NOT NULL,
    account_notification_channel_id integer CONSTRAINT account_notification_channe_account_notification_chann_not_null NOT NULL,
    type public.notification_channel_type_options NOT NULL
);


--
-- Name: account_notification_channel_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_notification_channel_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_notification_channel_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_notification_channel_type_id_seq OWNED BY public.account_notification_channel_type.id;


--
-- Name: account_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account_notification ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.account_notification_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: account_notification_preference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_notification_preference (
    id integer NOT NULL,
    account_id integer NOT NULL,
    category public.notification_category_options NOT NULL,
    in_app_enabled boolean DEFAULT true NOT NULL,
    push_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: account_notification_preference_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account_notification_preference ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.account_notification_preference_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: account_pending_following_channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_pending_following_channel (
    id integer NOT NULL,
    account_id integer NOT NULL,
    podcast_index_id integer,
    feed_url public.varchar_url NOT NULL,
    created_at public.server_time_with_default NOT NULL
);


--
-- Name: account_pending_following_channel_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account_pending_following_channel ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.account_pending_following_channel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: account_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_profile (
    id integer NOT NULL,
    account_id integer NOT NULL,
    display_name public.varchar_normal,
    bio public.varchar_long
);


--
-- Name: account_profile_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_profile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_profile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_profile_id_seq OWNED BY public.account_profile.id;


--
-- Name: account_reset_password; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_reset_password (
    id integer NOT NULL,
    account_id integer NOT NULL,
    reset_token public.varchar_guid,
    reset_token_expires_at timestamp without time zone
);


--
-- Name: account_reset_password_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_reset_password_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_reset_password_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_reset_password_id_seq OWNED BY public.account_reset_password.id;


--
-- Name: account_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_session (
    id bigint NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    account_id integer NOT NULL,
    client_type character varying(16) NOT NULL,
    device_label public.varchar_normal,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    idle_expires_at timestamp with time zone NOT NULL,
    refresh_token_hash character varying(64),
    previous_refresh_token_hash character varying(64),
    revoked_at timestamp with time zone,
    revoked_reason character varying(32),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_session_client_type_check CHECK (((client_type)::text = ANY (ARRAY[('web'::character varying)::text, ('mobile'::character varying)::text]))),
    CONSTRAINT account_session_revoked_pair_check CHECK (((revoked_at IS NULL) = (revoked_reason IS NULL))),
    CONSTRAINT account_session_revoked_reason_check CHECK (((revoked_reason IS NULL) OR ((revoked_reason)::text = ANY (ARRAY[('signed_out'::character varying)::text, ('signed_out_elsewhere'::character varying)::text, ('password_changed'::character varying)::text, ('admin_password_set'::character varying)::text, ('admin_force_logout'::character varying)::text, ('refresh_reuse'::character varying)::text]))))
);


--
-- Name: account_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account_session ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.account_session_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: account_set_password; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_set_password (
    id integer NOT NULL,
    account_id integer NOT NULL,
    set_password_token public.varchar_guid,
    set_password_token_expires_at timestamp without time zone
);


--
-- Name: account_set_password_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_set_password_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_set_password_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_set_password_id_seq OWNED BY public.account_set_password.id;


--
-- Name: account_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_settings (
    id integer NOT NULL,
    account_id integer NOT NULL,
    allow_listen_stats boolean DEFAULT false NOT NULL,
    listen_stats_accepted boolean,
    listen_stats_agreement_version character varying(64),
    listen_stats_decided_at timestamp with time zone,
    listen_stats_opted_out_at timestamp with time zone
);


--
-- Name: account_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_settings_id_seq OWNED BY public.account_settings.id;


--
-- Name: account_settings_locale; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_settings_locale (
    id integer NOT NULL,
    account_settings_id integer NOT NULL,
    locale public.varchar_locale DEFAULT 'en-US'::character varying NOT NULL
);


--
-- Name: account_settings_locale_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_settings_locale_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_settings_locale_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_settings_locale_id_seq OWNED BY public.account_settings_locale.id;


--
-- Name: account_settings_notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_settings_notification (
    id integer NOT NULL,
    account_settings_id integer NOT NULL,
    auto_enable_on_subscribe boolean DEFAULT false NOT NULL
);


--
-- Name: account_settings_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_settings_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_settings_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_settings_notification_id_seq OWNED BY public.account_settings_notification.id;


--
-- Name: account_settings_notification_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_settings_notification_type (
    id integer NOT NULL,
    account_settings_notification_id integer CONSTRAINT account_settings_notificati_account_settings_notificat_not_null NOT NULL,
    type public.notification_channel_type_options NOT NULL
);


--
-- Name: account_settings_notification_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_settings_notification_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_settings_notification_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_settings_notification_type_id_seq OWNED BY public.account_settings_notification_type.id;


--
-- Name: account_settings_playback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_settings_playback (
    id integer NOT NULL,
    account_settings_id integer NOT NULL,
    preferred_media_type character varying DEFAULT 'video'::character varying NOT NULL,
    CONSTRAINT account_settings_playback_preferred_media_type_check CHECK (((preferred_media_type)::text = ANY (ARRAY[('audio'::character varying)::text, ('video'::character varying)::text])))
);


--
-- Name: account_settings_playback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_settings_playback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_settings_playback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_settings_playback_id_seq OWNED BY public.account_settings_playback.id;


--
-- Name: account_terms_acceptance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_terms_acceptance (
    account_id integer NOT NULL,
    terms_version character varying(64) NOT NULL,
    accepted_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: account_up_device; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_up_device (
    id integer NOT NULL,
    account_id integer NOT NULL,
    up_endpoint public.varchar_url NOT NULL,
    up_auth_key public.varchar_long,
    locale public.varchar_locale NOT NULL,
    created_at public.server_time_with_default NOT NULL,
    updated_at public.server_time_with_default NOT NULL
);


--
-- Name: account_up_device_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_up_device_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_up_device_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_up_device_id_seq OWNED BY public.account_up_device.id;


--
-- Name: account_verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_verification (
    id integer NOT NULL,
    account_id integer NOT NULL,
    verification_token public.varchar_guid,
    verification_token_expires_at timestamp without time zone
);


--
-- Name: account_verification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_verification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_verification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_verification_id_seq OWNED BY public.account_verification.id;


--
-- Name: account_webpush_device; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_webpush_device (
    id integer NOT NULL,
    account_id integer NOT NULL,
    endpoint public.varchar_url NOT NULL,
    p256dh public.varchar_long NOT NULL,
    auth public.varchar_long NOT NULL,
    locale public.varchar_locale NOT NULL,
    created_at public.server_time_with_default NOT NULL,
    updated_at public.server_time_with_default NOT NULL
);


--
-- Name: account_webpush_device_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_webpush_device_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_webpush_device_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_webpush_device_id_seq OWNED BY public.account_webpush_device.id;


--
-- Name: admin_notification_campaign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notification_campaign (
    id integer NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    title public.varchar_normal NOT NULL,
    body text,
    link_path public.varchar_normal,
    category public.notification_category_options NOT NULL,
    audience jsonb DEFAULT '{"type": "all-valid-membership"}'::jsonb NOT NULL,
    send_push boolean DEFAULT false NOT NULL,
    status public.varchar_short DEFAULT 'draft'::character varying NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_by_admin_id integer,
    scheduled_job_dedupe_key public.varchar_normal,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_notification_campaign_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('scheduled'::character varying)::text, ('sending'::character varying)::text, ('sent'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: admin_notification_campaign_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.admin_notification_campaign ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.admin_notification_campaign_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: billing_checkout_channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_checkout_channel (
    id integer NOT NULL,
    processor_id character varying(32) NOT NULL,
    platform text NOT NULL,
    storefront_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    min_client_version character varying(32),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT billing_checkout_channel_min_client_version_check CHECK (((min_client_version IS NULL) OR ((min_client_version)::text ~ '^[0-9]+(\.[0-9]+)*$'::text))),
    CONSTRAINT billing_checkout_channel_platform_check CHECK ((platform = ANY (ARRAY['web'::text, 'ios'::text, 'android'::text, 'foss'::text]))),
    CONSTRAINT billing_checkout_channel_storefront_allowlist_check CHECK ((array_to_string(storefront_allowlist, ','::text) ~ '^([A-Z]{2}(,[A-Z]{2})*)?$'::text))
);


--
-- Name: billing_checkout_channel_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.billing_checkout_channel ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.billing_checkout_channel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: billing_checkout_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_checkout_session (
    id integer NOT NULL,
    processor_id character varying(32) NOT NULL,
    external_id text NOT NULL,
    account_id integer NOT NULL,
    billing_processor_product_id integer NOT NULL,
    amount numeric(19,4) NOT NULL,
    currency_code character(3) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    settled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT billing_checkout_session_amount_check CHECK ((amount >= (0)::numeric))
);


--
-- Name: billing_checkout_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.billing_checkout_session ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.billing_checkout_session_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: billing_membership_grant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_membership_grant (
    id integer NOT NULL,
    account_id integer NOT NULL,
    source text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    billing_transaction_id integer,
    membership_claim_token_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT billing_membership_grant_claim_token_check CHECK (((source <> 'claim_token'::text) OR (membership_claim_token_id IS NOT NULL))),
    CONSTRAINT billing_membership_grant_one_time_purchase_check CHECK (((source <> 'one_time_purchase'::text) OR (billing_transaction_id IS NOT NULL))),
    CONSTRAINT billing_membership_grant_source_check CHECK ((source = ANY (ARRAY['one_time_purchase'::text, 'claim_token'::text, 'admin'::text, 'trial'::text, 'legacy_import'::text, 'migration_baseline'::text]))),
    CONSTRAINT billing_membership_grant_window_check CHECK ((ends_at >= starts_at))
);


--
-- Name: billing_membership_grant_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.billing_membership_grant ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.billing_membership_grant_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: billing_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_price (
    id integer NOT NULL,
    billing_product_id integer NOT NULL,
    currency_code character(3) NOT NULL,
    billing_cadence text NOT NULL,
    amount_cents integer NOT NULL,
    effective_from timestamp without time zone DEFAULT now() NOT NULL,
    effective_to timestamp without time zone,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default,
    CONSTRAINT billing_price_amount_cents_check CHECK ((amount_cents >= 0)),
    CONSTRAINT billing_price_billing_cadence_check CHECK ((billing_cadence = ANY (ARRAY['monthly'::text, 'annual'::text]))),
    CONSTRAINT billing_price_effective_window_check CHECK (((effective_to IS NULL) OR (effective_to > effective_from)))
);


--
-- Name: billing_price_change_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_price_change_audit (
    id integer NOT NULL,
    billing_price_id integer,
    changed_by_admin_account_id integer,
    change_reason text,
    previous_amount_cents integer,
    new_amount_cents integer,
    previous_effective_from timestamp without time zone,
    previous_effective_to timestamp without time zone,
    new_effective_from timestamp without time zone,
    new_effective_to timestamp without time zone,
    created_at public.server_time_with_default,
    CONSTRAINT billing_price_change_audit_new_amount_cents_check CHECK (((new_amount_cents IS NULL) OR (new_amount_cents >= 0))),
    CONSTRAINT billing_price_change_audit_previous_amount_cents_check CHECK (((previous_amount_cents IS NULL) OR (previous_amount_cents >= 0)))
);


--
-- Name: billing_price_change_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.billing_price_change_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: billing_price_change_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.billing_price_change_audit_id_seq OWNED BY public.billing_price_change_audit.id;


--
-- Name: billing_price_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.billing_price_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: billing_price_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.billing_price_id_seq OWNED BY public.billing_price.id;


--
-- Name: billing_processor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_processor (
    id character varying(32) NOT NULL,
    display_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: billing_processor_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_processor_product (
    id integer NOT NULL,
    processor_id character varying(32) NOT NULL,
    external_product_id character varying(255) NOT NULL,
    external_base_plan_id character varying(255),
    billing_product_id integer NOT NULL,
    billing_cadence text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT billing_processor_product_billing_cadence_check CHECK ((billing_cadence = ANY (ARRAY['monthly'::text, 'annual'::text])))
);


--
-- Name: billing_processor_product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.billing_processor_product ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.billing_processor_product_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: billing_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_product (
    id integer NOT NULL,
    product_code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default
);


--
-- Name: billing_product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.billing_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: billing_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.billing_product_id_seq OWNED BY public.billing_product.id;


--
-- Name: billing_transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_transaction (
    id integer NOT NULL,
    account_id integer NOT NULL,
    processor_id character varying(32) NOT NULL,
    external_transaction_id text NOT NULL,
    amount numeric(19,4),
    currency_code character(3),
    settled_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revocation_reason text,
    is_sandbox boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT billing_transaction_amount_check CHECK (((amount IS NULL) OR (amount >= (0)::numeric))),
    CONSTRAINT billing_transaction_amount_currency_check CHECK (((amount IS NULL) = (currency_code IS NULL))),
    CONSTRAINT billing_transaction_revocation_check CHECK (((revoked_at IS NULL) = (revocation_reason IS NULL))),
    CONSTRAINT billing_transaction_revocation_reason_check CHECK ((revocation_reason = ANY (ARRAY['refund'::text, 'chargeback'::text, 'store_revoke'::text])))
);


--
-- Name: billing_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.billing_transaction ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.billing_transaction_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: billing_webhook_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_webhook_event (
    id bigint NOT NULL,
    processor_id character varying(32) NOT NULL,
    external_event_id text NOT NULL,
    schema_version character varying(32) NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    process_error text,
    CONSTRAINT billing_webhook_event_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT billing_webhook_event_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text])))
);


--
-- Name: billing_webhook_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.billing_webhook_event ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.billing_webhook_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category (
    id integer NOT NULL,
    parent_id integer,
    display_name public.varchar_normal NOT NULL,
    slug public.varchar_normal NOT NULL,
    mapping_key public.varchar_normal NOT NULL
);


--
-- Name: category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.category_id_seq OWNED BY public.category.id;


--
-- Name: channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel (
    id integer NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    slug public.varchar_slug,
    feed_id integer NOT NULL,
    podcast_guid uuid,
    title public.varchar_normal,
    sortable_title public.varchar_short,
    medium_id integer NOT NULL,
    has_podcast_index_value boolean DEFAULT false,
    has_value_time_splits boolean DEFAULT false,
    archived_slimmed_at timestamp without time zone,
    follow_conversion_status character varying(16),
    follow_conversion_attempts smallint DEFAULT 0 NOT NULL,
    follow_conversion_last_attempt_at timestamp without time zone,
    may_have_live_items boolean DEFAULT false NOT NULL,
    CONSTRAINT channel_follow_conversion_status_check CHECK (((follow_conversion_status IS NULL) OR ((follow_conversion_status)::text = ANY (ARRAY[('converted'::character varying)::text, ('no_followers'::character varying)::text, ('unreachable'::character varying)::text, ('skipped'::character varying)::text]))))
);


--
-- Name: channel_about; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_about (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    author public.varchar_normal,
    episode_count integer,
    explicit boolean,
    itunes_type_id integer,
    language public.varchar_short,
    last_pub_date public.server_time_with_default,
    website_link_url public.varchar_url
);


--
-- Name: channel_about_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_about_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_about_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_about_id_seq OWNED BY public.channel_about.id;


--
-- Name: channel_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_category (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    category_id integer NOT NULL
);


--
-- Name: channel_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_category_id_seq OWNED BY public.channel_category.id;


--
-- Name: channel_chat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_chat (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    server public.varchar_fqdn NOT NULL,
    protocol public.varchar_short NOT NULL,
    account_id public.varchar_normal,
    space public.varchar_normal
);


--
-- Name: channel_chat_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_chat_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_chat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_chat_id_seq OWNED BY public.channel_chat.id;


--
-- Name: channel_description; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_description (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    value text NOT NULL,
    preview character varying(400),
    is_truncated boolean DEFAULT false NOT NULL,
    source_length integer,
    CONSTRAINT channel_description_value_length_check CHECK ((char_length(value) <= 150000))
);


--
-- Name: channel_description_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_description_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_description_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_description_id_seq OWNED BY public.channel_description.id;


--
-- Name: channel_funding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_funding (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    url public.varchar_url NOT NULL,
    title public.varchar_normal
);


--
-- Name: channel_funding_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_funding_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_funding_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_funding_id_seq OWNED BY public.channel_funding.id;


--
-- Name: channel_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_id_seq OWNED BY public.channel.id;


--
-- Name: channel_image; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_image (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    url public.varchar_url NOT NULL,
    image_width_size integer,
    is_resized boolean DEFAULT false
);


--
-- Name: channel_image_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_image_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_image_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_image_id_seq OWNED BY public.channel_image.id;


--
-- Name: channel_internal_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_internal_settings (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    embed_approved_media_url_paths text
);


--
-- Name: channel_internal_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_internal_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_internal_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_internal_settings_id_seq OWNED BY public.channel_internal_settings.id;


--
-- Name: channel_itunes_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_itunes_type (
    id integer NOT NULL,
    itunes_type text,
    CONSTRAINT channel_itunes_type_itunes_type_check CHECK ((itunes_type = ANY (ARRAY['episodic'::text, 'serial'::text])))
);


--
-- Name: channel_itunes_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_itunes_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_itunes_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_itunes_type_id_seq OWNED BY public.channel_itunes_type.id;


--
-- Name: channel_license; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_license (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    identifier public.varchar_normal NOT NULL,
    url public.varchar_url
);


--
-- Name: channel_license_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_license_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_license_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_license_id_seq OWNED BY public.channel_license.id;


--
-- Name: channel_location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_location (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    geo public.varchar_normal,
    osm public.varchar_normal,
    name public.varchar_normal,
    CONSTRAINT channel_location_check CHECK (((geo IS NOT NULL) OR (osm IS NOT NULL)))
);


--
-- Name: channel_location_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_location_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_location_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_location_id_seq OWNED BY public.channel_location.id;


--
-- Name: channel_merge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_merge (
    id integer NOT NULL,
    from_podcast_index_id integer NOT NULL,
    to_podcast_index_id integer NOT NULL,
    from_channel_id integer,
    to_channel_id integer,
    mode text,
    status text NOT NULL,
    confidence numeric(5,4),
    match_stats jsonb DEFAULT '{}'::jsonb NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_at timestamp with time zone,
    CONSTRAINT channel_merge_confidence_check CHECK (((confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))),
    CONSTRAINT channel_merge_mode_check CHECK (((mode IS NULL) OR (mode = ANY (ARRAY['repoint'::text, 'absorb'::text])))),
    CONSTRAINT channel_merge_status_check CHECK ((status = ANY (ARRAY['detected'::text, 'verified'::text, 'needs_review'::text, 'applied'::text, 'rejected'::text, 'reverted'::text])))
);


--
-- Name: channel_merge_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.channel_merge ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.channel_merge_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: channel_merge_journal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_merge_journal (
    id integer NOT NULL,
    channel_merge_id integer NOT NULL,
    table_name text NOT NULL,
    row_pk text NOT NULL,
    action text NOT NULL,
    before_json jsonb,
    after_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT channel_merge_journal_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])))
);


--
-- Name: channel_merge_journal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.channel_merge_journal ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.channel_merge_journal_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: channel_meta_boost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_meta_boost (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    standard public.varchar_short NOT NULL,
    node public.varchar_url NOT NULL
);


--
-- Name: channel_meta_boost_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_meta_boost_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_meta_boost_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_meta_boost_id_seq OWNED BY public.channel_meta_boost.id;


--
-- Name: channel_person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_person (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    name public.varchar_normal NOT NULL,
    role public.varchar_normal,
    person_group public.varchar_normal DEFAULT 'cast'::character varying,
    img public.varchar_url,
    href public.varchar_url
);


--
-- Name: channel_person_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_person_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_person_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_person_id_seq OWNED BY public.channel_person.id;


--
-- Name: channel_podroll; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_podroll (
    id integer NOT NULL,
    channel_id integer NOT NULL
);


--
-- Name: channel_podroll_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_podroll_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_podroll_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_podroll_id_seq OWNED BY public.channel_podroll.id;


--
-- Name: channel_podroll_remote_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_podroll_remote_item (
    id integer NOT NULL,
    channel_podroll_id integer NOT NULL,
    feed_guid uuid NOT NULL,
    feed_url public.varchar_url,
    item_guid public.varchar_uri,
    title public.varchar_normal,
    medium_id integer
);


--
-- Name: channel_podroll_remote_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_podroll_remote_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_podroll_remote_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_podroll_remote_item_id_seq OWNED BY public.channel_podroll_remote_item.id;


--
-- Name: channel_publisher; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_publisher (
    id integer NOT NULL,
    channel_id integer NOT NULL
);


--
-- Name: channel_publisher_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_publisher_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_publisher_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_publisher_id_seq OWNED BY public.channel_publisher.id;


--
-- Name: channel_publisher_remote_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_publisher_remote_item (
    id integer NOT NULL,
    channel_publisher_id integer NOT NULL,
    feed_guid uuid NOT NULL,
    feed_url public.varchar_url,
    item_guid public.varchar_uri,
    title public.varchar_normal,
    medium_id integer,
    item_id integer
);


--
-- Name: channel_publisher_remote_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_publisher_remote_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_publisher_remote_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_publisher_remote_item_id_seq OWNED BY public.channel_publisher_remote_item.id;


--
-- Name: channel_remote_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_remote_item (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    feed_guid uuid NOT NULL,
    feed_url public.varchar_url,
    item_guid public.varchar_uri,
    title public.varchar_normal,
    medium_id integer
);


--
-- Name: channel_remote_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_remote_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_remote_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_remote_item_id_seq OWNED BY public.channel_remote_item.id;


--
-- Name: channel_season; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_season (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    number integer NOT NULL,
    name public.varchar_normal
);


--
-- Name: channel_season_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_season_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_season_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_season_id_seq OWNED BY public.channel_season.id;


--
-- Name: channel_social_interact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_social_interact (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    protocol public.varchar_short NOT NULL,
    uri public.varchar_uri NOT NULL,
    account_id public.varchar_normal,
    account_url public.varchar_url,
    priority integer
);


--
-- Name: channel_social_interact_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_social_interact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_social_interact_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_social_interact_id_seq OWNED BY public.channel_social_interact.id;


--
-- Name: channel_trailer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_trailer (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    url public.varchar_url NOT NULL,
    title public.varchar_normal,
    pub_date timestamp with time zone NOT NULL,
    length bigint,
    type public.varchar_short,
    channel_season_id integer
);


--
-- Name: channel_trailer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_trailer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_trailer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_trailer_id_seq OWNED BY public.channel_trailer.id;


--
-- Name: channel_txt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_txt (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    purpose public.varchar_normal,
    value public.varchar_long NOT NULL
);


--
-- Name: channel_txt_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_txt_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_txt_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_txt_id_seq OWNED BY public.channel_txt.id;


--
-- Name: channel_value; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_value (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    type public.varchar_short NOT NULL,
    method public.varchar_short NOT NULL,
    suggested double precision
);


--
-- Name: channel_value_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_value_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_value_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_value_id_seq OWNED BY public.channel_value.id;


--
-- Name: channel_value_recipient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_value_recipient (
    id integer NOT NULL,
    channel_value_id integer NOT NULL,
    type public.varchar_short NOT NULL,
    address public.varchar_long NOT NULL,
    split double precision NOT NULL,
    name public.varchar_normal,
    custom_key public.varchar_long,
    custom_value public.varchar_long,
    fee boolean DEFAULT false
);


--
-- Name: channel_value_recipient_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_value_recipient_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_value_recipient_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_value_recipient_id_seq OWNED BY public.channel_value_recipient.id;


--
-- Name: channel_verified_publisher; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_verified_publisher (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    publisher_channel_id integer NOT NULL,
    item_id integer,
    claim_position smallint NOT NULL,
    CONSTRAINT channel_verified_publisher_claim_position_check CHECK ((claim_position >= 0)),
    CONSTRAINT channel_verified_publisher_not_self_check CHECK ((channel_id <> publisher_channel_id))
);


--
-- Name: channel_verified_publisher_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.channel_verified_publisher ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.channel_verified_publisher_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: clip; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clip (
    id integer NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    account_id integer NOT NULL,
    item_id integer,
    start_time public.media_player_time NOT NULL,
    end_time public.media_player_time,
    title public.varchar_normal,
    description public.varchar_long,
    sharable_status_id integer NOT NULL,
    created_at public.server_time_with_default,
    removed_source jsonb,
    source_removed_at timestamp without time zone
);


--
-- Name: clip_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clip_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clip_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clip_id_seq OWNED BY public.clip.id;


--
-- Name: embed_demo_showcase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embed_demo_showcase (
    showcase_id character varying(64) NOT NULL,
    resource_id_text character varying(15) NOT NULL,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default,
    play_resource_id_text character varying(15)
);


--
-- Name: feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed (
    id integer NOT NULL,
    url public.varchar_url NOT NULL,
    podcast_index_id integer NOT NULL,
    last_parsed_file_hash public.varchar_md5,
    is_parsing public.server_time,
    parsing_priority integer DEFAULT 0,
    container_id character varying(12),
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default,
    spam_item_limit_override integer,
    max_response_body_bytes_override integer,
    description_length_tier_override character varying(16),
    description_truncated_count integer DEFAULT 0 NOT NULL,
    description_longest_source_length integer,
    description_truncated_at timestamp without time zone,
    CONSTRAINT feed_description_length_tier_override_check CHECK (((description_length_tier_override IS NULL) OR ((description_length_tier_override)::text = ANY (ARRAY[('standard'::character varying)::text, ('extended'::character varying)::text, ('maximum'::character varying)::text])))),
    CONSTRAINT feed_max_response_body_bytes_override_positive_check CHECK (((max_response_body_bytes_override IS NULL) OR (max_response_body_bytes_override > 0))),
    CONSTRAINT feed_parsing_priority_check CHECK (((parsing_priority >= 0) AND (parsing_priority <= 5))),
    CONSTRAINT feed_spam_item_limit_override_positive_check CHECK (((spam_item_limit_override IS NULL) OR (spam_item_limit_override > 0)))
);


--
-- Name: feed_condition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_condition (
    id integer NOT NULL,
    feed_id integer NOT NULL,
    feed_condition_type_id integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    source character varying(16) DEFAULT 'auto'::character varying NOT NULL,
    note text,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default
);


--
-- Name: feed_condition_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_condition_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_condition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_condition_id_seq OWNED BY public.feed_condition.id;


--
-- Name: feed_condition_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_condition_type (
    id integer NOT NULL,
    condition_key character varying(64) NOT NULL,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default
);


--
-- Name: feed_condition_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_condition_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_condition_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_condition_type_id_seq OWNED BY public.feed_condition_type.id;


--
-- Name: feed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_id_seq OWNED BY public.feed.id;


--
-- Name: feed_lifecycle_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_lifecycle_event (
    id integer NOT NULL,
    feed_id integer NOT NULL,
    from_lifecycle_state_type_id integer,
    to_lifecycle_state_type_id integer NOT NULL,
    reason_key character varying(64),
    note text,
    source character varying(16) NOT NULL,
    created_at public.server_time_with_default
);


--
-- Name: feed_lifecycle_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_lifecycle_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_lifecycle_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_lifecycle_event_id_seq OWNED BY public.feed_lifecycle_event.id;


--
-- Name: feed_lifecycle_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_lifecycle_state (
    id integer NOT NULL,
    feed_id integer NOT NULL,
    feed_lifecycle_state_type_id integer NOT NULL,
    reason_key character varying(64),
    note text,
    updated_by_source character varying(16) DEFAULT 'system'::character varying NOT NULL,
    updated_by_admin_id integer,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default
);


--
-- Name: feed_lifecycle_state_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_lifecycle_state_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_lifecycle_state_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_lifecycle_state_id_seq OWNED BY public.feed_lifecycle_state.id;


--
-- Name: feed_lifecycle_state_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_lifecycle_state_type (
    id integer NOT NULL,
    state_key character varying(64) NOT NULL,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default
);


--
-- Name: feed_lifecycle_state_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_lifecycle_state_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_lifecycle_state_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_lifecycle_state_type_id_seq OWNED BY public.feed_lifecycle_state_type.id;


--
-- Name: feed_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_log (
    id integer NOT NULL,
    feed_id integer NOT NULL,
    last_http_status integer,
    last_good_http_status_time public.server_time,
    last_finished_parse_time public.server_time,
    parse_errors integer DEFAULT 0,
    last_failed_parse_time public.server_time
);


--
-- Name: feed_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_log_id_seq OWNED BY public.feed_log.id;


--
-- Name: feed_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_policy (
    id integer NOT NULL,
    feed_id integer NOT NULL,
    parse_allowed boolean DEFAULT true NOT NULL,
    public_visible boolean DEFAULT true NOT NULL,
    add_allowed boolean DEFAULT true NOT NULL,
    primary_block_reason character varying(64),
    last_policy_refresh_at timestamp without time zone,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default
);


--
-- Name: feed_policy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_policy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_policy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_policy_id_seq OWNED BY public.feed_policy.id;


--
-- Name: feed_policy_override; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_policy_override (
    id integer NOT NULL,
    feed_id integer NOT NULL,
    parse_allowed_override boolean,
    public_visible_override boolean,
    add_allowed_override boolean,
    note text,
    updated_by_admin_id integer,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default
);


--
-- Name: feed_policy_override_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_policy_override_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_policy_override_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_policy_override_id_seq OWNED BY public.feed_policy_override.id;


--
-- Name: feed_takedown_reason; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_takedown_reason (
    id integer NOT NULL,
    reason text NOT NULL,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default
);


--
-- Name: feed_takedown_reason_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feed_takedown_reason_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feed_takedown_reason_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.feed_takedown_reason_id_seq OWNED BY public.feed_takedown_reason.id;


--
-- Name: image_shrink_source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_shrink_source (
    id integer NOT NULL,
    url public.varchar_url NOT NULL,
    etag public.varchar_normal,
    last_modified public.varchar_normal,
    content_length integer,
    checksum_sha256 public.varchar_normal,
    last_checked_at public.server_time,
    last_changed_at public.server_time,
    created_at public.server_time_with_default NOT NULL,
    updated_at public.server_time_with_default NOT NULL,
    last_deep_checked_at public.server_time
);


--
-- Name: image_shrink_source_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.image_shrink_source_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: image_shrink_source_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.image_shrink_source_id_seq OWNED BY public.image_shrink_source.id;


--
-- Name: item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item (
    id integer NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    slug public.varchar_slug,
    channel_id integer NOT NULL,
    guid public.varchar_uri,
    guid_enclosure_url public.varchar_url,
    pub_date timestamp with time zone,
    title public.varchar_normal,
    item_flag_status_id integer NOT NULL,
    archived_slimmed_at timestamp without time zone,
    CONSTRAINT item_check CHECK (((guid IS NOT NULL) OR (guid_enclosure_url IS NOT NULL)))
);


--
-- Name: item_about; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_about (
    id integer NOT NULL,
    item_id integer NOT NULL,
    duration public.media_player_time,
    explicit boolean,
    website_link_url public.varchar_url,
    item_itunes_episode_type_id integer
);


--
-- Name: item_about_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_about_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_about_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_about_id_seq OWNED BY public.item_about.id;


--
-- Name: item_chapter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_chapter (
    id integer NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    item_chapters_object_id integer NOT NULL,
    data_hash public.varchar_md5 NOT NULL,
    start_time public.media_player_time NOT NULL,
    end_time public.media_player_time,
    title public.varchar_normal,
    img public.varchar_url,
    web_url public.varchar_url,
    table_of_contents boolean DEFAULT true
);


--
-- Name: item_chapter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_chapter_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_chapter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_chapter_id_seq OWNED BY public.item_chapter.id;


--
-- Name: item_chapter_location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_chapter_location (
    id integer NOT NULL,
    item_chapter_id integer NOT NULL,
    geo public.varchar_normal,
    osm public.varchar_normal,
    name public.varchar_normal,
    CONSTRAINT item_chapter_location_check CHECK (((geo IS NOT NULL) OR (osm IS NOT NULL)))
);


--
-- Name: item_chapter_location_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_chapter_location_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_chapter_location_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_chapter_location_id_seq OWNED BY public.item_chapter_location.id;


--
-- Name: item_chapters_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_chapters_feed (
    id integer NOT NULL,
    item_id integer NOT NULL,
    url public.varchar_url NOT NULL,
    type public.varchar_short NOT NULL
);


--
-- Name: item_chapters_feed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_chapters_feed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_chapters_feed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_chapters_feed_id_seq OWNED BY public.item_chapters_feed.id;


--
-- Name: item_chapters_feed_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_chapters_feed_log (
    id integer NOT NULL,
    item_chapters_feed_id integer NOT NULL,
    last_http_status integer,
    last_good_http_status_time public.server_time,
    last_finished_parse_time public.server_time,
    parse_errors integer DEFAULT 0
);


--
-- Name: item_chapters_feed_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_chapters_feed_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_chapters_feed_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_chapters_feed_log_id_seq OWNED BY public.item_chapters_feed_log.id;


--
-- Name: item_chapters_object; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_chapters_object (
    id integer NOT NULL,
    item_chapters_feed_id integer NOT NULL,
    version public.varchar_short,
    author public.varchar_normal,
    title public.varchar_normal,
    podcast_name public.varchar_normal,
    description public.varchar_longer,
    file_name public.varchar_normal,
    waypoints boolean
);


--
-- Name: item_chapters_object_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_chapters_object_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_chapters_object_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_chapters_object_id_seq OWNED BY public.item_chapters_object.id;


--
-- Name: item_chat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_chat (
    id integer NOT NULL,
    item_id integer NOT NULL,
    server public.varchar_fqdn NOT NULL,
    protocol public.varchar_short NOT NULL,
    account_id public.varchar_normal,
    space public.varchar_normal
);


--
-- Name: item_chat_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_chat_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_chat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_chat_id_seq OWNED BY public.item_chat.id;


--
-- Name: item_content_link; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_content_link (
    id integer NOT NULL,
    item_id integer NOT NULL,
    href public.varchar_url NOT NULL,
    title public.varchar_normal
);


--
-- Name: item_content_link_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_content_link_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_content_link_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_content_link_id_seq OWNED BY public.item_content_link.id;


--
-- Name: item_description; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_description (
    id integer NOT NULL,
    item_id integer NOT NULL,
    value text NOT NULL,
    preview character varying(400),
    is_truncated boolean DEFAULT false NOT NULL,
    source_length integer,
    CONSTRAINT item_description_value_length_check CHECK ((char_length(value) <= 150000))
);


--
-- Name: item_description_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_description_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_description_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_description_id_seq OWNED BY public.item_description.id;


--
-- Name: item_enclosure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_enclosure (
    id integer NOT NULL,
    item_id integer NOT NULL,
    type public.varchar_short NOT NULL,
    length bigint,
    bitrate integer,
    height integer,
    language public.varchar_short,
    title public.varchar_short,
    rel public.varchar_short,
    codecs public.varchar_short,
    item_enclosure_default boolean DEFAULT false
);


--
-- Name: item_enclosure_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_enclosure_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_enclosure_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_enclosure_id_seq OWNED BY public.item_enclosure.id;


--
-- Name: item_enclosure_integrity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_enclosure_integrity (
    id integer NOT NULL,
    item_enclosure_id integer NOT NULL,
    type text NOT NULL,
    value public.varchar_long NOT NULL,
    CONSTRAINT item_enclosure_integrity_type_check CHECK ((type = ANY (ARRAY['sri'::text, 'pgp-signature'::text])))
);


--
-- Name: item_enclosure_integrity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_enclosure_integrity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_enclosure_integrity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_enclosure_integrity_id_seq OWNED BY public.item_enclosure_integrity.id;


--
-- Name: item_enclosure_source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_enclosure_source (
    id integer NOT NULL,
    item_enclosure_id integer NOT NULL,
    uri public.varchar_uri NOT NULL,
    content_type public.varchar_short
);


--
-- Name: item_enclosure_source_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_enclosure_source_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_enclosure_source_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_enclosure_source_id_seq OWNED BY public.item_enclosure_source.id;


--
-- Name: item_flag_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_flag_status (
    id integer NOT NULL,
    status text,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default,
    CONSTRAINT item_flag_status_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending-archive'::text, 'archived'::text, 'pending-delete'::text])))
);


--
-- Name: item_flag_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_flag_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_flag_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_flag_status_id_seq OWNED BY public.item_flag_status.id;


--
-- Name: item_funding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_funding (
    id integer NOT NULL,
    item_id integer NOT NULL,
    url public.varchar_url NOT NULL,
    title public.varchar_normal
);


--
-- Name: item_funding_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_funding_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_funding_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_funding_id_seq OWNED BY public.item_funding.id;


--
-- Name: item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_id_seq OWNED BY public.item.id;


--
-- Name: item_image; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_image (
    id integer NOT NULL,
    item_id integer NOT NULL,
    url public.varchar_url NOT NULL,
    image_width_size integer,
    is_resized boolean DEFAULT false
);


--
-- Name: item_image_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_image_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_image_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_image_id_seq OWNED BY public.item_image.id;


--
-- Name: item_itunes_episode_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_itunes_episode_type (
    id integer NOT NULL,
    itunes_episode_type text,
    CONSTRAINT item_itunes_episode_type_itunes_episode_type_check CHECK ((itunes_episode_type = ANY (ARRAY['full'::text, 'trailer'::text, 'bonus'::text])))
);


--
-- Name: item_itunes_episode_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_itunes_episode_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_itunes_episode_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_itunes_episode_type_id_seq OWNED BY public.item_itunes_episode_type.id;


--
-- Name: item_license; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_license (
    id integer NOT NULL,
    item_id integer NOT NULL,
    identifier public.varchar_normal NOT NULL,
    url public.varchar_url
);


--
-- Name: item_license_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_license_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_license_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_license_id_seq OWNED BY public.item_license.id;


--
-- Name: item_location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_location (
    id integer NOT NULL,
    item_id integer NOT NULL,
    geo public.varchar_normal,
    osm public.varchar_normal,
    name public.varchar_normal,
    CONSTRAINT item_location_check CHECK (((geo IS NOT NULL) OR (osm IS NOT NULL)))
);


--
-- Name: item_location_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_location_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_location_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_location_id_seq OWNED BY public.item_location.id;


--
-- Name: item_merge_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_merge_map (
    id integer NOT NULL,
    channel_merge_id integer NOT NULL,
    from_item_id integer NOT NULL,
    to_item_id integer,
    match_tier text,
    CONSTRAINT item_merge_map_match_tier_check CHECK (((match_tier IS NULL) OR (match_tier = ANY (ARRAY['guid'::text, 'enclosure'::text, 'fuzzy'::text]))))
);


--
-- Name: item_merge_map_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.item_merge_map ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.item_merge_map_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: item_person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_person (
    id integer NOT NULL,
    item_id integer NOT NULL,
    name public.varchar_normal NOT NULL,
    role public.varchar_normal,
    person_group public.varchar_normal DEFAULT 'cast'::character varying,
    img public.varchar_url,
    href public.varchar_url
);


--
-- Name: item_person_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_person_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_person_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_person_id_seq OWNED BY public.item_person.id;


--
-- Name: item_season; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_season (
    id integer NOT NULL,
    channel_season_id integer NOT NULL,
    item_id integer NOT NULL,
    title public.varchar_normal
);


--
-- Name: item_season_episode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_season_episode (
    id integer NOT NULL,
    item_id integer NOT NULL,
    display public.varchar_short,
    number double precision NOT NULL
);


--
-- Name: item_season_episode_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_season_episode_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_season_episode_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_season_episode_id_seq OWNED BY public.item_season_episode.id;


--
-- Name: item_season_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_season_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_season_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_season_id_seq OWNED BY public.item_season.id;


--
-- Name: item_social_interact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_social_interact (
    id integer NOT NULL,
    item_id integer NOT NULL,
    protocol public.varchar_short NOT NULL,
    uri public.varchar_uri NOT NULL,
    account_id public.varchar_normal,
    account_url public.varchar_url,
    priority integer
);


--
-- Name: item_social_interact_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_social_interact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_social_interact_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_social_interact_id_seq OWNED BY public.item_social_interact.id;


--
-- Name: item_soundbite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_soundbite (
    id integer NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    item_id integer NOT NULL,
    start_time public.media_player_time NOT NULL,
    duration public.media_player_time NOT NULL,
    title public.varchar_normal
);


--
-- Name: item_soundbite_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_soundbite_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_soundbite_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_soundbite_id_seq OWNED BY public.item_soundbite.id;


--
-- Name: item_transcript; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_transcript (
    id integer NOT NULL,
    item_id integer NOT NULL,
    url public.varchar_url NOT NULL,
    type public.varchar_short NOT NULL,
    language public.varchar_short,
    rel character varying(50),
    CONSTRAINT item_transcript_rel_check CHECK (((rel IS NULL) OR ((rel)::text = 'captions'::text)))
);


--
-- Name: item_transcript_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_transcript_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_transcript_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_transcript_id_seq OWNED BY public.item_transcript.id;


--
-- Name: item_txt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_txt (
    id integer NOT NULL,
    item_id integer NOT NULL,
    purpose public.varchar_normal,
    value public.varchar_long NOT NULL
);


--
-- Name: item_txt_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_txt_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_txt_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_txt_id_seq OWNED BY public.item_txt.id;


--
-- Name: item_value; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_value (
    id integer NOT NULL,
    item_id integer NOT NULL,
    type public.varchar_short NOT NULL,
    method public.varchar_short NOT NULL,
    suggested double precision
);


--
-- Name: item_value_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_value_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_value_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_value_id_seq OWNED BY public.item_value.id;


--
-- Name: item_value_recipient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_value_recipient (
    id integer NOT NULL,
    item_value_id integer NOT NULL,
    type public.varchar_short NOT NULL,
    address public.varchar_long NOT NULL,
    split double precision NOT NULL,
    name public.varchar_normal,
    custom_key public.varchar_long,
    custom_value public.varchar_long,
    fee boolean DEFAULT false
);


--
-- Name: item_value_recipient_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_value_recipient_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_value_recipient_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_value_recipient_id_seq OWNED BY public.item_value_recipient.id;


--
-- Name: item_value_time_split; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_value_time_split (
    id integer NOT NULL,
    item_value_id integer NOT NULL,
    start_time public.media_player_time NOT NULL,
    duration public.media_player_time NOT NULL,
    remote_start_time public.media_player_time DEFAULT 0,
    remote_percentage public.media_player_time DEFAULT 100
);


--
-- Name: item_value_time_split_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_value_time_split_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_value_time_split_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_value_time_split_id_seq OWNED BY public.item_value_time_split.id;


--
-- Name: item_value_time_split_recipient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_value_time_split_recipient (
    id integer NOT NULL,
    item_value_time_split_id integer CONSTRAINT item_value_time_split_recipie_item_value_time_split_id_not_null NOT NULL,
    type public.varchar_short NOT NULL,
    address public.varchar_long NOT NULL,
    split double precision NOT NULL,
    name public.varchar_normal,
    custom_key public.varchar_long,
    custom_value public.varchar_long,
    fee boolean DEFAULT false
);


--
-- Name: item_value_time_split_recipient_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_value_time_split_recipient_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_value_time_split_recipient_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_value_time_split_recipient_id_seq OWNED BY public.item_value_time_split_recipient.id;


--
-- Name: item_value_time_split_remote_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_value_time_split_remote_item (
    id integer NOT NULL,
    item_value_time_split_id integer CONSTRAINT item_value_time_split_remote__item_value_time_split_id_not_null NOT NULL,
    feed_guid uuid NOT NULL,
    feed_url public.varchar_url,
    item_guid public.varchar_uri,
    title public.varchar_normal
);


--
-- Name: item_value_time_split_remote_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_value_time_split_remote_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: item_value_time_split_remote_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.item_value_time_split_remote_item_id_seq OWNED BY public.item_value_time_split_remote_item.id;



--
-- Name: live_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_item (
    id integer NOT NULL,
    item_id integer NOT NULL,
    live_item_status_id integer NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    chat_web_url public.varchar_url
);


--
-- Name: live_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_item_id_seq OWNED BY public.live_item.id;


--
-- Name: live_item_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_item_status (
    id integer NOT NULL,
    status text,
    CONSTRAINT live_item_status_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'live'::text, 'ended'::text])))
);


--
-- Name: live_item_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_item_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_item_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_item_status_id_seq OWNED BY public.live_item_status.id;


--
-- Name: medium; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medium (
    id integer NOT NULL,
    value text,
    CONSTRAINT medium_value_check CHECK ((value = ANY (ARRAY['publisher'::text, 'podcast'::text, 'music'::text, 'video'::text, 'film'::text, 'audiobook'::text, 'newsletter'::text, 'blog'::text, 'course'::text, 'mixed'::text, 'podcastL'::text, 'musicL'::text, 'videoL'::text, 'filmL'::text, 'audiobookL'::text, 'newsletterL'::text, 'blogL'::text, 'publisherL'::text, 'courseL'::text, 'av'::text, 'publisher-podcast'::text, 'publisher-music'::text, 'publisher-video'::text, 'publisher-film'::text, 'publisher-audiobook'::text, 'publisher-newsletter'::text, 'publisher-blog'::text, 'publisher-course'::text, 'publisher-av'::text])))
);


--
-- Name: medium_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medium_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medium_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medium_id_seq OWNED BY public.medium.id;


--
-- Name: membership_claim_token; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membership_claim_token (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claimed boolean DEFAULT false,
    months_to_add integer DEFAULT 1,
    account_membership_id integer
);


--
-- Name: on_demand_parser_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.on_demand_parser_event (
    id integer NOT NULL,
    account_id integer NOT NULL,
    podcast_index_id integer NOT NULL,
    remote_parent_podcast_index_id integer,
    type public.on_demand_parser_event_type NOT NULL,
    created_at public.server_time_with_default NOT NULL
);


--
-- Name: on_demand_parser_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.on_demand_parser_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: on_demand_parser_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.on_demand_parser_event_id_seq OWNED BY public.on_demand_parser_event.id;


--
-- Name: playlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlist (
    id integer NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    account_id integer NOT NULL,
    sharable_status_id integer NOT NULL,
    title public.varchar_normal,
    description public.varchar_long,
    is_default_likes boolean DEFAULT false,
    item_count integer DEFAULT 0,
    medium_id integer NOT NULL,
    last_updated public.server_time_with_default NOT NULL
);


--
-- Name: playlist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.playlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: playlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.playlist_id_seq OWNED BY public.playlist.id;


--
-- Name: playlist_resource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlist_resource (
    id integer NOT NULL,
    playlist_id integer NOT NULL,
    list_position public.list_position NOT NULL,
    item_id integer,
    clip_id integer,
    item_soundbite_id integer,
    add_by_rss_resource_data jsonb,
    add_by_rss_hash_id public.varchar_md5,
    removed_source jsonb,
    source_removed_at timestamp without time zone,
    CONSTRAINT playlist_resource_check CHECK (((num_nonnulls(item_id, add_by_rss_hash_id, clip_id, item_soundbite_id) = 1) OR ((num_nonnulls(item_id, add_by_rss_hash_id, clip_id, item_soundbite_id) = 0) AND (source_removed_at IS NOT NULL))))
);


--
-- Name: playlist_resource_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.playlist_resource_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: playlist_resource_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.playlist_resource_id_seq OWNED BY public.playlist_resource.id;


--
-- Name: podcast_index_dead_feed_sync; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.podcast_index_dead_feed_sync (
    id smallint NOT NULL,
    last_modified text,
    etag text,
    synced_at timestamp with time zone,
    last_retire_eligible_count integer,
    CONSTRAINT podcast_index_dead_feed_sync_singleton CHECK ((id = 1))
);


--
-- Name: product_membership_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_membership_settings (
    id integer DEFAULT 1 NOT NULL,
    free_trial_expiration_seconds integer CONSTRAINT product_membership_settings_free_trial_expiration_seco_not_null NOT NULL,
    created_at public.server_time_with_default,
    updated_at public.server_time_with_default,
    trial_max_add_by_rss_feeds integer DEFAULT 10 NOT NULL,
    trial_max_manual_refreshes_per_hour integer DEFAULT 5 CONSTRAINT product_membership_settings_trial_max_manual_refreshes_not_null NOT NULL,
    premium_max_add_by_rss_feeds integer DEFAULT 100 CONSTRAINT product_membership_settings_premium_max_add_by_rss_fee_not_null NOT NULL,
    premium_max_manual_refreshes_per_hour integer DEFAULT 20 CONSTRAINT product_membership_settings_premium_max_manual_refresh_not_null NOT NULL,
    CONSTRAINT product_membership_settings_free_trial_expiration_seconds_check CHECK ((free_trial_expiration_seconds > 0)),
    CONSTRAINT product_membership_settings_id_check CHECK ((id = 1)),
    CONSTRAINT product_membership_settings_premium_max_add_by_rss_feeds_check CHECK ((premium_max_add_by_rss_feeds >= 0)),
    CONSTRAINT product_membership_settings_premium_max_manual_refreshes__check CHECK ((premium_max_manual_refreshes_per_hour >= 0)),
    CONSTRAINT product_membership_settings_trial_max_add_by_rss_feeds_check CHECK ((trial_max_add_by_rss_feeds >= 0)),
    CONSTRAINT product_membership_settings_trial_max_manual_refreshes_pe_check CHECK ((trial_max_manual_refreshes_per_hour >= 0))
);


--
-- Name: queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue (
    id integer NOT NULL,
    id_text public.nano_id_v2 NOT NULL,
    account_id integer NOT NULL,
    medium_id integer NOT NULL,
    is_active_queue boolean DEFAULT false NOT NULL
);


--
-- Name: queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.queue_id_seq OWNED BY public.queue.id;


--
-- Name: queue_resource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_resource (
    id integer NOT NULL,
    queue_id integer NOT NULL,
    list_position public.list_position NOT NULL,
    playback_position public.media_player_time DEFAULT 0 NOT NULL,
    media_file_duration public.media_player_time DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    item_id integer,
    clip_id integer,
    item_soundbite_id integer,
    add_by_rss_resource_data jsonb,
    add_by_rss_hash_id public.varchar_md5,
    last_played_at timestamp with time zone,
    last_played_received_at timestamp with time zone,
    CONSTRAINT queue_resource_check CHECK (((((((item_id IS NOT NULL))::integer + ((add_by_rss_hash_id IS NOT NULL))::integer) + ((clip_id IS NOT NULL))::integer) + ((item_soundbite_id IS NOT NULL))::integer) = 1))
);


--
-- Name: queue_resource_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.queue_resource_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: queue_resource_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.queue_resource_id_seq OWNED BY public.queue_resource.id;


--
-- Name: scheduled_job; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_job (
    id integer NOT NULL,
    job_type public.varchar_normal NOT NULL,
    dedupe_key public.varchar_normal NOT NULL,
    run_after timestamp with time zone NOT NULL,
    status public.varchar_short DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    locked_at timestamp with time zone,
    locked_by public.varchar_short,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scheduled_job_attempts_nonnegative CHECK ((attempts >= 0)),
    CONSTRAINT scheduled_job_max_attempts_positive CHECK ((max_attempts > 0)),
    CONSTRAINT scheduled_job_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('running'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: scheduled_job_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_job ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.scheduled_job_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sharable_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sharable_status (
    id integer NOT NULL,
    status text,
    CONSTRAINT sharable_status_status_check CHECK ((status = ANY (ARRAY['public'::text, 'unlisted'::text, 'private'::text])))
);


--
-- Name: sharable_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sharable_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sharable_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sharable_status_id_seq OWNED BY public.sharable_status.id;


--
-- Name: stats_daily_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_daily_account (
    account_id integer NOT NULL,
    day date NOT NULL,
    listener_count integer DEFAULT 0 NOT NULL,
    all_time_listener_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_daily_account_all_time_check CHECK (((all_time_listener_count >= 0) AND (all_time_listener_count <= listener_count))),
    CONSTRAINT stats_daily_account_counts_check CHECK ((listener_count >= 0))
);


--
-- Name: stats_daily_channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_daily_channel (
    channel_id integer NOT NULL,
    day date NOT NULL,
    listener_count integer DEFAULT 0 NOT NULL,
    completion_count integer DEFAULT 0 NOT NULL,
    all_time_listener_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_daily_channel_all_time_check CHECK (((all_time_listener_count >= 0) AND (all_time_listener_count <= listener_count))),
    CONSTRAINT stats_daily_channel_counts_check CHECK (((listener_count >= 0) AND (completion_count >= 0) AND (completion_count <= listener_count)))
);


--
-- Name: stats_daily_clip; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_daily_clip (
    clip_id integer NOT NULL,
    day date NOT NULL,
    listener_count integer DEFAULT 0 NOT NULL,
    completion_count integer DEFAULT 0 NOT NULL,
    all_time_listener_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_daily_clip_all_time_check CHECK (((all_time_listener_count >= 0) AND (all_time_listener_count <= listener_count))),
    CONSTRAINT stats_daily_clip_counts_check CHECK (((listener_count >= 0) AND (completion_count >= 0) AND (completion_count <= listener_count)))
);


--
-- Name: stats_daily_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_daily_item (
    item_id integer NOT NULL,
    day date NOT NULL,
    listener_count integer DEFAULT 0 NOT NULL,
    completion_count integer DEFAULT 0 NOT NULL,
    all_time_listener_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_daily_item_all_time_check CHECK (((all_time_listener_count >= 0) AND (all_time_listener_count <= listener_count))),
    CONSTRAINT stats_daily_item_counts_check CHECK (((listener_count >= 0) AND (completion_count >= 0) AND (completion_count <= listener_count)))
);


--
-- Name: stats_daily_playlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_daily_playlist (
    playlist_id integer NOT NULL,
    day date NOT NULL,
    listener_count integer DEFAULT 0 NOT NULL,
    all_time_listener_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT stats_daily_playlist_all_time_check CHECK (((all_time_listener_count >= 0) AND (all_time_listener_count <= listener_count))),
    CONSTRAINT stats_daily_playlist_counts_check CHECK ((listener_count >= 0))
);


--
-- Name: stats_flag_signal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_flag_signal (
    listener_id uuid NOT NULL,
    too_soon_minutes integer NOT NULL,
    last_too_soon_minute timestamp with time zone NOT NULL,
    CONSTRAINT stats_flag_signal_too_soon_minutes_check CHECK ((too_soon_minutes >= 1))
);


--
-- Name: stats_flagged_listener; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_flagged_listener (
    id integer NOT NULL,
    listener_id uuid NOT NULL,
    reason text NOT NULL,
    flagged_at timestamp with time zone NOT NULL,
    times_flagged integer DEFAULT 1 NOT NULL,
    cleared_at timestamp with time zone,
    cleared_by_admin_id integer,
    CONSTRAINT stats_flagged_listener_cleared_check CHECK (((cleared_at IS NULL) = (cleared_by_admin_id IS NULL))),
    CONSTRAINT stats_flagged_listener_reason_check CHECK ((reason = ANY (ARRAY['stored_cap_reached'::text, 'too_soon_minutes'::text]))),
    CONSTRAINT stats_flagged_listener_times_flagged_check CHECK ((times_flagged >= 1))
);


--
-- Name: stats_flagged_listener_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.stats_flagged_listener ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.stats_flagged_listener_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stats_listen_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_listen_event (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    listener_id uuid NOT NULL,
    channel_id integer NOT NULL,
    item_id integer NOT NULL,
    clip_id integer,
    client_listen_id uuid,
    seconds_heard integer DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    popularity_counted boolean DEFAULT true NOT NULL,
    item_all_time_counted boolean DEFAULT false NOT NULL,
    channel_all_time_counted boolean DEFAULT false NOT NULL,
    clip_all_time_counted boolean DEFAULT false NOT NULL,
    CONSTRAINT stats_listen_event_seconds_heard_check CHECK ((seconds_heard >= 0))
)
PARTITION BY RANGE (created_at);


--
-- Name: stats_listen_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stats_listen_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stats_listen_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stats_listen_event_id_seq OWNED BY public.stats_listen_event.id;


--
-- Name: stats_listen_event_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_listen_event_default (
    id bigint DEFAULT nextval('public.stats_listen_event_id_seq'::regclass) CONSTRAINT stats_listen_event_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT stats_listen_event_created_at_not_null NOT NULL,
    listener_id uuid CONSTRAINT stats_listen_event_listener_id_not_null NOT NULL,
    channel_id integer CONSTRAINT stats_listen_event_channel_id_not_null NOT NULL,
    item_id integer CONSTRAINT stats_listen_event_item_id_not_null NOT NULL,
    clip_id integer,
    client_listen_id uuid,
    seconds_heard integer DEFAULT 0 CONSTRAINT stats_listen_event_seconds_heard_not_null NOT NULL,
    completed boolean DEFAULT false CONSTRAINT stats_listen_event_completed_not_null NOT NULL,
    popularity_counted boolean DEFAULT true CONSTRAINT stats_listen_event_popularity_counted_not_null NOT NULL,
    item_all_time_counted boolean DEFAULT false CONSTRAINT stats_listen_event_item_all_time_counted_not_null NOT NULL,
    channel_all_time_counted boolean DEFAULT false CONSTRAINT stats_listen_event_channel_all_time_counted_not_null NOT NULL,
    clip_all_time_counted boolean DEFAULT false CONSTRAINT stats_listen_event_clip_all_time_counted_not_null NOT NULL,
    CONSTRAINT stats_listen_event_seconds_heard_check CHECK ((seconds_heard >= 0))
);


--
-- Name: stats_open_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_open_event (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    listener_id uuid NOT NULL,
    account_id integer,
    playlist_id integer,
    popularity_counted boolean DEFAULT true NOT NULL,
    all_time_counted boolean DEFAULT false NOT NULL,
    CONSTRAINT stats_open_event_target_check CHECK ((num_nonnulls(account_id, playlist_id) = 1))
)
PARTITION BY RANGE (created_at);


--
-- Name: stats_open_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stats_open_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stats_open_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stats_open_event_id_seq OWNED BY public.stats_open_event.id;


--
-- Name: stats_open_event_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_open_event_default (
    id bigint DEFAULT nextval('public.stats_open_event_id_seq'::regclass) CONSTRAINT stats_open_event_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT stats_open_event_created_at_not_null NOT NULL,
    listener_id uuid CONSTRAINT stats_open_event_listener_id_not_null NOT NULL,
    account_id integer,
    playlist_id integer,
    popularity_counted boolean DEFAULT true CONSTRAINT stats_open_event_popularity_counted_not_null NOT NULL,
    all_time_counted boolean DEFAULT false CONSTRAINT stats_open_event_all_time_counted_not_null NOT NULL,
    CONSTRAINT stats_open_event_target_check CHECK ((num_nonnulls(account_id, playlist_id) = 1))
);


--
-- Name: stats_popularity_account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_popularity_account (
    account_id integer NOT NULL,
    day_count integer DEFAULT 0 NOT NULL,
    week_count integer DEFAULT 0 NOT NULL,
    month_count integer DEFAULT 0 NOT NULL,
    all_time_count integer DEFAULT 0 NOT NULL
);


--
-- Name: stats_popularity_channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_popularity_channel (
    channel_id integer NOT NULL,
    day_count integer DEFAULT 0 NOT NULL,
    week_count integer DEFAULT 0 NOT NULL,
    month_count integer DEFAULT 0 NOT NULL,
    all_time_count integer DEFAULT 0 NOT NULL
);


--
-- Name: stats_popularity_clip; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_popularity_clip (
    clip_id integer NOT NULL,
    day_count integer DEFAULT 0 NOT NULL,
    week_count integer DEFAULT 0 NOT NULL,
    month_count integer DEFAULT 0 NOT NULL,
    all_time_count integer DEFAULT 0 NOT NULL
);


--
-- Name: stats_popularity_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_popularity_item (
    item_id integer NOT NULL,
    day_count integer DEFAULT 0 NOT NULL,
    week_count integer DEFAULT 0 NOT NULL,
    month_count integer DEFAULT 0 NOT NULL,
    all_time_count integer DEFAULT 0 NOT NULL
);


--
-- Name: stats_popularity_playlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_popularity_playlist (
    playlist_id integer NOT NULL,
    day_count integer DEFAULT 0 NOT NULL,
    week_count integer DEFAULT 0 NOT NULL,
    month_count integer DEFAULT 0 NOT NULL,
    all_time_count integer DEFAULT 0 NOT NULL
);


--
-- Name: stats_taste_profile; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT stats_taste_profile_counts_check CHECK (((listen_count >= 0) AND (completion_count >= 0))),
    CONSTRAINT stats_taste_profile_listened_order_check CHECK ((first_listened_at <= last_listened_at)),
    CONSTRAINT stats_taste_profile_scores_check CHECK (((recent_score >= (0)::double precision) AND (long_term_score >= (0)::double precision)))
);


--
-- Name: stats_taste_profile_hidden; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_taste_profile_hidden (
    listener_id uuid NOT NULL,
    channel_id integer NOT NULL,
    hidden_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stats_listen_event_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_listen_event ATTACH PARTITION public.stats_listen_event_default DEFAULT;


--
-- Name: stats_open_event_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_open_event ATTACH PARTITION public.stats_open_event_default DEFAULT;


--
-- Name: account id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account ALTER COLUMN id SET DEFAULT nextval('public.account_id_seq'::regclass);


--
-- Name: account_credentials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_credentials ALTER COLUMN id SET DEFAULT nextval('public.account_credentials_id_seq'::regclass);


--
-- Name: account_email_change_verification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_email_change_verification ALTER COLUMN id SET DEFAULT nextval('public.account_email_change_verification_id_seq'::regclass);


--
-- Name: account_fcm_device id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_fcm_device ALTER COLUMN id SET DEFAULT nextval('public.account_fcm_device_id_seq'::regclass);


--
-- Name: account_membership id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_membership ALTER COLUMN id SET DEFAULT nextval('public.account_membership_id_seq'::regclass);


--
-- Name: account_membership_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_membership_status ALTER COLUMN id SET DEFAULT nextval('public.account_membership_status_id_seq'::regclass);


--
-- Name: account_notification_channel id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_channel ALTER COLUMN id SET DEFAULT nextval('public.account_notification_channel_id_seq'::regclass);


--
-- Name: account_notification_channel_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_channel_type ALTER COLUMN id SET DEFAULT nextval('public.account_notification_channel_type_id_seq'::regclass);


--
-- Name: account_profile id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_profile ALTER COLUMN id SET DEFAULT nextval('public.account_profile_id_seq'::regclass);


--
-- Name: account_reset_password id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_reset_password ALTER COLUMN id SET DEFAULT nextval('public.account_reset_password_id_seq'::regclass);


--
-- Name: account_set_password id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_set_password ALTER COLUMN id SET DEFAULT nextval('public.account_set_password_id_seq'::regclass);


--
-- Name: account_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings ALTER COLUMN id SET DEFAULT nextval('public.account_settings_id_seq'::regclass);


--
-- Name: account_settings_locale id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_locale ALTER COLUMN id SET DEFAULT nextval('public.account_settings_locale_id_seq'::regclass);


--
-- Name: account_settings_notification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_notification ALTER COLUMN id SET DEFAULT nextval('public.account_settings_notification_id_seq'::regclass);


--
-- Name: account_settings_notification_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_notification_type ALTER COLUMN id SET DEFAULT nextval('public.account_settings_notification_type_id_seq'::regclass);


--
-- Name: account_settings_playback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_playback ALTER COLUMN id SET DEFAULT nextval('public.account_settings_playback_id_seq'::regclass);


--
-- Name: account_up_device id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_up_device ALTER COLUMN id SET DEFAULT nextval('public.account_up_device_id_seq'::regclass);


--
-- Name: account_verification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_verification ALTER COLUMN id SET DEFAULT nextval('public.account_verification_id_seq'::regclass);


--
-- Name: account_webpush_device id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_webpush_device ALTER COLUMN id SET DEFAULT nextval('public.account_webpush_device_id_seq'::regclass);


--
-- Name: billing_price id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_price ALTER COLUMN id SET DEFAULT nextval('public.billing_price_id_seq'::regclass);


--
-- Name: billing_price_change_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_price_change_audit ALTER COLUMN id SET DEFAULT nextval('public.billing_price_change_audit_id_seq'::regclass);


--
-- Name: billing_product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_product ALTER COLUMN id SET DEFAULT nextval('public.billing_product_id_seq'::regclass);


--
-- Name: category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category ALTER COLUMN id SET DEFAULT nextval('public.category_id_seq'::regclass);


--
-- Name: channel id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel ALTER COLUMN id SET DEFAULT nextval('public.channel_id_seq'::regclass);


--
-- Name: channel_about id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_about ALTER COLUMN id SET DEFAULT nextval('public.channel_about_id_seq'::regclass);


--
-- Name: channel_category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_category ALTER COLUMN id SET DEFAULT nextval('public.channel_category_id_seq'::regclass);


--
-- Name: channel_chat id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_chat ALTER COLUMN id SET DEFAULT nextval('public.channel_chat_id_seq'::regclass);


--
-- Name: channel_description id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_description ALTER COLUMN id SET DEFAULT nextval('public.channel_description_id_seq'::regclass);


--
-- Name: channel_funding id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_funding ALTER COLUMN id SET DEFAULT nextval('public.channel_funding_id_seq'::regclass);


--
-- Name: channel_image id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_image ALTER COLUMN id SET DEFAULT nextval('public.channel_image_id_seq'::regclass);


--
-- Name: channel_internal_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_internal_settings ALTER COLUMN id SET DEFAULT nextval('public.channel_internal_settings_id_seq'::regclass);


--
-- Name: channel_itunes_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_itunes_type ALTER COLUMN id SET DEFAULT nextval('public.channel_itunes_type_id_seq'::regclass);


--
-- Name: channel_license id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_license ALTER COLUMN id SET DEFAULT nextval('public.channel_license_id_seq'::regclass);


--
-- Name: channel_location id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_location ALTER COLUMN id SET DEFAULT nextval('public.channel_location_id_seq'::regclass);


--
-- Name: channel_meta_boost id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_meta_boost ALTER COLUMN id SET DEFAULT nextval('public.channel_meta_boost_id_seq'::regclass);


--
-- Name: channel_person id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_person ALTER COLUMN id SET DEFAULT nextval('public.channel_person_id_seq'::regclass);


--
-- Name: channel_podroll id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_podroll ALTER COLUMN id SET DEFAULT nextval('public.channel_podroll_id_seq'::regclass);


--
-- Name: channel_podroll_remote_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_podroll_remote_item ALTER COLUMN id SET DEFAULT nextval('public.channel_podroll_remote_item_id_seq'::regclass);


--
-- Name: channel_publisher id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_publisher ALTER COLUMN id SET DEFAULT nextval('public.channel_publisher_id_seq'::regclass);


--
-- Name: channel_publisher_remote_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_publisher_remote_item ALTER COLUMN id SET DEFAULT nextval('public.channel_publisher_remote_item_id_seq'::regclass);


--
-- Name: channel_remote_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_remote_item ALTER COLUMN id SET DEFAULT nextval('public.channel_remote_item_id_seq'::regclass);


--
-- Name: channel_season id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_season ALTER COLUMN id SET DEFAULT nextval('public.channel_season_id_seq'::regclass);


--
-- Name: channel_social_interact id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_social_interact ALTER COLUMN id SET DEFAULT nextval('public.channel_social_interact_id_seq'::regclass);


--
-- Name: channel_trailer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_trailer ALTER COLUMN id SET DEFAULT nextval('public.channel_trailer_id_seq'::regclass);


--
-- Name: channel_txt id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_txt ALTER COLUMN id SET DEFAULT nextval('public.channel_txt_id_seq'::regclass);


--
-- Name: channel_value id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_value ALTER COLUMN id SET DEFAULT nextval('public.channel_value_id_seq'::regclass);


--
-- Name: channel_value_recipient id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_value_recipient ALTER COLUMN id SET DEFAULT nextval('public.channel_value_recipient_id_seq'::regclass);


--
-- Name: clip id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clip ALTER COLUMN id SET DEFAULT nextval('public.clip_id_seq'::regclass);


--
-- Name: feed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed ALTER COLUMN id SET DEFAULT nextval('public.feed_id_seq'::regclass);


--
-- Name: feed_condition id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_condition ALTER COLUMN id SET DEFAULT nextval('public.feed_condition_id_seq'::regclass);


--
-- Name: feed_condition_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_condition_type ALTER COLUMN id SET DEFAULT nextval('public.feed_condition_type_id_seq'::regclass);


--
-- Name: feed_lifecycle_event id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_event ALTER COLUMN id SET DEFAULT nextval('public.feed_lifecycle_event_id_seq'::regclass);


--
-- Name: feed_lifecycle_state id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_state ALTER COLUMN id SET DEFAULT nextval('public.feed_lifecycle_state_id_seq'::regclass);


--
-- Name: feed_lifecycle_state_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_state_type ALTER COLUMN id SET DEFAULT nextval('public.feed_lifecycle_state_type_id_seq'::regclass);


--
-- Name: feed_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_log ALTER COLUMN id SET DEFAULT nextval('public.feed_log_id_seq'::regclass);


--
-- Name: feed_policy id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_policy ALTER COLUMN id SET DEFAULT nextval('public.feed_policy_id_seq'::regclass);


--
-- Name: feed_policy_override id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_policy_override ALTER COLUMN id SET DEFAULT nextval('public.feed_policy_override_id_seq'::regclass);


--
-- Name: feed_takedown_reason id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_takedown_reason ALTER COLUMN id SET DEFAULT nextval('public.feed_takedown_reason_id_seq'::regclass);


--
-- Name: image_shrink_source id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_shrink_source ALTER COLUMN id SET DEFAULT nextval('public.image_shrink_source_id_seq'::regclass);


--
-- Name: item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item ALTER COLUMN id SET DEFAULT nextval('public.item_id_seq'::regclass);


--
-- Name: item_about id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_about ALTER COLUMN id SET DEFAULT nextval('public.item_about_id_seq'::regclass);


--
-- Name: item_chapter id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapter ALTER COLUMN id SET DEFAULT nextval('public.item_chapter_id_seq'::regclass);


--
-- Name: item_chapter_location id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapter_location ALTER COLUMN id SET DEFAULT nextval('public.item_chapter_location_id_seq'::regclass);


--
-- Name: item_chapters_feed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_feed ALTER COLUMN id SET DEFAULT nextval('public.item_chapters_feed_id_seq'::regclass);


--
-- Name: item_chapters_feed_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_feed_log ALTER COLUMN id SET DEFAULT nextval('public.item_chapters_feed_log_id_seq'::regclass);


--
-- Name: item_chapters_object id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_object ALTER COLUMN id SET DEFAULT nextval('public.item_chapters_object_id_seq'::regclass);


--
-- Name: item_chat id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chat ALTER COLUMN id SET DEFAULT nextval('public.item_chat_id_seq'::regclass);


--
-- Name: item_content_link id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_content_link ALTER COLUMN id SET DEFAULT nextval('public.item_content_link_id_seq'::regclass);


--
-- Name: item_description id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_description ALTER COLUMN id SET DEFAULT nextval('public.item_description_id_seq'::regclass);


--
-- Name: item_enclosure id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_enclosure ALTER COLUMN id SET DEFAULT nextval('public.item_enclosure_id_seq'::regclass);


--
-- Name: item_enclosure_integrity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_enclosure_integrity ALTER COLUMN id SET DEFAULT nextval('public.item_enclosure_integrity_id_seq'::regclass);


--
-- Name: item_enclosure_source id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_enclosure_source ALTER COLUMN id SET DEFAULT nextval('public.item_enclosure_source_id_seq'::regclass);


--
-- Name: item_flag_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_flag_status ALTER COLUMN id SET DEFAULT nextval('public.item_flag_status_id_seq'::regclass);


--
-- Name: item_funding id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_funding ALTER COLUMN id SET DEFAULT nextval('public.item_funding_id_seq'::regclass);


--
-- Name: item_image id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_image ALTER COLUMN id SET DEFAULT nextval('public.item_image_id_seq'::regclass);


--
-- Name: item_itunes_episode_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_itunes_episode_type ALTER COLUMN id SET DEFAULT nextval('public.item_itunes_episode_type_id_seq'::regclass);


--
-- Name: item_license id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_license ALTER COLUMN id SET DEFAULT nextval('public.item_license_id_seq'::regclass);


--
-- Name: item_location id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_location ALTER COLUMN id SET DEFAULT nextval('public.item_location_id_seq'::regclass);


--
-- Name: item_person id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_person ALTER COLUMN id SET DEFAULT nextval('public.item_person_id_seq'::regclass);


--
-- Name: item_season id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_season ALTER COLUMN id SET DEFAULT nextval('public.item_season_id_seq'::regclass);


--
-- Name: item_season_episode id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_season_episode ALTER COLUMN id SET DEFAULT nextval('public.item_season_episode_id_seq'::regclass);


--
-- Name: item_social_interact id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_social_interact ALTER COLUMN id SET DEFAULT nextval('public.item_social_interact_id_seq'::regclass);


--
-- Name: item_soundbite id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_soundbite ALTER COLUMN id SET DEFAULT nextval('public.item_soundbite_id_seq'::regclass);


--
-- Name: item_transcript id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_transcript ALTER COLUMN id SET DEFAULT nextval('public.item_transcript_id_seq'::regclass);


--
-- Name: item_txt id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_txt ALTER COLUMN id SET DEFAULT nextval('public.item_txt_id_seq'::regclass);


--
-- Name: item_value id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value ALTER COLUMN id SET DEFAULT nextval('public.item_value_id_seq'::regclass);


--
-- Name: item_value_recipient id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_recipient ALTER COLUMN id SET DEFAULT nextval('public.item_value_recipient_id_seq'::regclass);


--
-- Name: item_value_time_split id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_time_split ALTER COLUMN id SET DEFAULT nextval('public.item_value_time_split_id_seq'::regclass);


--
-- Name: item_value_time_split_recipient id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_time_split_recipient ALTER COLUMN id SET DEFAULT nextval('public.item_value_time_split_recipient_id_seq'::regclass);


--
-- Name: item_value_time_split_remote_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_time_split_remote_item ALTER COLUMN id SET DEFAULT nextval('public.item_value_time_split_remote_item_id_seq'::regclass);


--
-- Name: live_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_item ALTER COLUMN id SET DEFAULT nextval('public.live_item_id_seq'::regclass);


--
-- Name: live_item_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_item_status ALTER COLUMN id SET DEFAULT nextval('public.live_item_status_id_seq'::regclass);


--
-- Name: medium id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medium ALTER COLUMN id SET DEFAULT nextval('public.medium_id_seq'::regclass);


--
-- Name: on_demand_parser_event id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.on_demand_parser_event ALTER COLUMN id SET DEFAULT nextval('public.on_demand_parser_event_id_seq'::regclass);


--
-- Name: playlist id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist ALTER COLUMN id SET DEFAULT nextval('public.playlist_id_seq'::regclass);


--
-- Name: playlist_resource id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource ALTER COLUMN id SET DEFAULT nextval('public.playlist_resource_id_seq'::regclass);


--
-- Name: queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue ALTER COLUMN id SET DEFAULT nextval('public.queue_id_seq'::regclass);


--
-- Name: queue_resource id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource ALTER COLUMN id SET DEFAULT nextval('public.queue_resource_id_seq'::regclass);


--
-- Name: sharable_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sharable_status ALTER COLUMN id SET DEFAULT nextval('public.sharable_status_id_seq'::regclass);


--
-- Name: stats_listen_event id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_listen_event ALTER COLUMN id SET DEFAULT nextval('public.stats_listen_event_id_seq'::regclass);


--
-- Name: stats_open_event id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_open_event ALTER COLUMN id SET DEFAULT nextval('public.stats_open_event_id_seq'::regclass);


--
-- Data for Name: stats_listener; Type: TABLE DATA; Schema: listener_identity; Owner: -
--

COPY listener_identity.stats_listener (listener_id, account_id, created_at, opt_out_day, opt_out_day_stored_count, opt_out_day_first_stored_at) FROM stdin;
\.


--
-- Data for Name: account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account (id, id_text, verified, sharable_status_id, created_at, notifications_last_read_at, billing_customer_ref) FROM stdin;
\.


--
-- Data for Name: account_api_key; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_api_key (id, id_text, account_id, name, token_hash, token_hint, permissions, expires_at, last_used_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: account_content_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_content_log (id, account_id, log_type, channel_id_text, channel_title, reason, follow_outcome, clip_count, playlist_entry_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: account_credentials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_credentials (id, account_id, email, username, password) FROM stdin;
\.


--
-- Data for Name: account_device_auto_download_channel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_device_auto_download_channel (id, account_id, installation_id, channel_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: account_email_change_verification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_email_change_verification (id, account_id, verification_token, verification_token_expires_at, pending_email_address) FROM stdin;
\.


--
-- Data for Name: account_fcm_device; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_fcm_device (id, account_id, fcm_token, installation_id, platform, locale, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: account_following_account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_following_account (account_id, following_account_id) FROM stdin;
\.


--
-- Data for Name: account_following_add_by_rss_channel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_following_add_by_rss_channel (account_id, feed_url, title, image_url, last_seen_at, requires_credentials) FROM stdin;
\.


--
-- Data for Name: account_following_channel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_following_channel (account_id, channel_id, last_seen_at) FROM stdin;
\.


--
-- Data for Name: account_following_playlist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_following_playlist (account_id, playlist_id) FROM stdin;
\.


--
-- Data for Name: account_membership; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_membership (id, tier) FROM stdin;
1	trial
2	premium
\.


--
-- Data for Name: account_membership_status; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_membership_status (id, account_id, account_membership_id, membership_expires_at, allow_directory_add_by_rss, max_add_by_rss_feeds, max_manual_refreshes_per_hour, track_stats, allow_notifications, billing_cadence, last_extension_idempotency_key) FROM stdin;
\.


--
-- Data for Name: account_metaboost; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_metaboost (account_id, sender_guid) FROM stdin;
\.


--
-- Data for Name: account_notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_notification (id, account_id, category, title, body, link_path, payload, created_at, expires_at, read_at) FROM stdin;
\.


--
-- Data for Name: account_notification_channel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_notification_channel (id, channel_id, account_id) FROM stdin;
\.


--
-- Data for Name: account_notification_channel_type; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_notification_channel_type (id, account_notification_channel_id, type) FROM stdin;
\.


--
-- Data for Name: account_notification_preference; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_notification_preference (id, account_id, category, in_app_enabled, push_enabled) FROM stdin;
\.


--
-- Data for Name: account_pending_following_channel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_pending_following_channel (id, account_id, podcast_index_id, feed_url, created_at) FROM stdin;
\.


--
-- Data for Name: account_profile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_profile (id, account_id, display_name, bio) FROM stdin;
\.


--
-- Data for Name: account_reset_password; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_reset_password (id, account_id, reset_token, reset_token_expires_at) FROM stdin;
\.


--
-- Data for Name: account_session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_session (id, id_text, account_id, client_type, device_label, last_seen_at, idle_expires_at, refresh_token_hash, previous_refresh_token_hash, revoked_at, revoked_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: account_set_password; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_set_password (id, account_id, set_password_token, set_password_token_expires_at) FROM stdin;
\.


--
-- Data for Name: account_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_settings (id, account_id, allow_listen_stats, listen_stats_accepted, listen_stats_agreement_version, listen_stats_decided_at, listen_stats_opted_out_at) FROM stdin;
\.


--
-- Data for Name: account_settings_locale; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_settings_locale (id, account_settings_id, locale) FROM stdin;
\.


--
-- Data for Name: account_settings_notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_settings_notification (id, account_settings_id, auto_enable_on_subscribe) FROM stdin;
\.


--
-- Data for Name: account_settings_notification_type; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_settings_notification_type (id, account_settings_notification_id, type) FROM stdin;
\.


--
-- Data for Name: account_settings_playback; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_settings_playback (id, account_settings_id, preferred_media_type) FROM stdin;
\.


--
-- Data for Name: account_terms_acceptance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_terms_acceptance (account_id, terms_version, accepted_at) FROM stdin;
\.


--
-- Data for Name: account_up_device; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_up_device (id, account_id, up_endpoint, up_auth_key, locale, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: account_verification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_verification (id, account_id, verification_token, verification_token_expires_at) FROM stdin;
\.


--
-- Data for Name: account_webpush_device; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_webpush_device (id, account_id, endpoint, p256dh, auth, locale, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: admin_notification_campaign; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_notification_campaign (id, id_text, title, body, link_path, category, audience, send_push, status, scheduled_at, sent_at, cancelled_at, created_by_admin_id, scheduled_job_dedupe_key, last_error, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: billing_checkout_channel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_checkout_channel (id, processor_id, platform, storefront_allowlist, enabled, min_client_version, created_at, updated_at) FROM stdin;
1	paypal	web	{}	t	\N	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
2	apple	ios	{}	t	\N	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
3	google_play	android	{}	t	\N	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
4	paypal	ios	{}	f	\N	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
5	paypal	android	{}	f	\N	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
6	paypal	foss	{}	t	\N	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
7	strike	web	{}	f	\N	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
8	strike	foss	{}	f	\N	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
9	strike	ios	{}	f	\N	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
10	strike	android	{}	f	\N	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
\.


--
-- Data for Name: billing_checkout_session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_checkout_session (id, processor_id, external_id, account_id, billing_processor_product_id, amount, currency_code, expires_at, settled_at, created_at) FROM stdin;
\.


--
-- Data for Name: billing_membership_grant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_membership_grant (id, account_id, source, starts_at, ends_at, revoked_at, billing_transaction_id, membership_claim_token_id, created_at) FROM stdin;
\.


--
-- Data for Name: billing_price; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_price (id, billing_product_id, currency_code, billing_cadence, amount_cents, effective_from, effective_to, source, created_at, updated_at) FROM stdin;
1	1	USD	monthly	300	2000-01-01 00:00:00	\N	seed	2000-01-01 00:00:00	2000-01-01 00:00:00
2	1	USD	annual	3000	2000-01-01 00:00:00	\N	seed	2000-01-01 00:00:00	2000-01-01 00:00:00
\.


--
-- Data for Name: billing_price_change_audit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_price_change_audit (id, billing_price_id, changed_by_admin_account_id, change_reason, previous_amount_cents, new_amount_cents, previous_effective_from, previous_effective_to, new_effective_from, new_effective_to, created_at) FROM stdin;
\.


--
-- Data for Name: billing_processor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_processor (id, display_name, is_active, created_at, updated_at) FROM stdin;
paypal	PayPal	t	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
apple	Apple App Store	t	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
google_play	Google Play	t	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
test	Test	t	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
strike	Strike	t	2000-01-01 00:00:00+00	2000-01-01 00:00:00+00
\.


--
-- Data for Name: billing_processor_product; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_processor_product (id, processor_id, external_product_id, external_base_plan_id, billing_product_id, billing_cadence, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: billing_product; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_product (id, product_code, name, is_active, created_at, updated_at) FROM stdin;
1	membership_premium	Premium Membership	t	2000-01-01 00:00:00	2000-01-01 00:00:00
\.


--
-- Data for Name: billing_transaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_transaction (id, account_id, processor_id, external_transaction_id, amount, currency_code, settled_at, revoked_at, revocation_reason, is_sandbox, created_at) FROM stdin;
\.


--
-- Data for Name: billing_webhook_event; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_webhook_event (id, processor_id, external_event_id, schema_version, payload, status, attempts, received_at, processed_at, process_error) FROM stdin;
\.


--
-- Data for Name: category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.category (id, parent_id, display_name, slug, mapping_key) FROM stdin;
1	\N	Arts	arts	arts
2	\N	Business	business	business
3	\N	Comedy	comedy	comedy
4	\N	Education	education	education
5	\N	Fiction	fiction	fiction
6	\N	Government	government	government
7	\N	History	history	history
8	\N	Health & Fitness	health-and-fitness	healthandfitness
9	\N	Kids & Family	kids-and-family	kidsandfamily
10	\N	Leisure	leisure	leisure
11	\N	Music	music	music
12	\N	News	news	news
13	\N	Religion & Spirituality	religion-and-spirituality	religionandspirituality
14	\N	Science	science	science
15	\N	Society & Culture	society-and-culture	societyandculture
16	\N	Sports	sports	sports
17	\N	Technology	technology	technology
18	\N	True Crime	true-crime	truecrime
19	\N	TV & Film	tv-and-film	tvandfilm
20	1	Books	books	books
21	1	Design	design	design
22	1	Fashion & Beauty	fashion-and-beauty	fashionandbeauty
23	1	Food	food	food
24	1	Performing Arts	performing-arts	performingarts
25	1	Visual Arts	visual-arts	visualarts
26	2	Careers	careers	careers
27	2	Entrepreneurship	entrepreneurship	entrepreneurship
28	2	Investing	investing	investing
29	2	Management	management	management
30	2	Marketing	marketing	marketing
31	2	Non-Profit	non-profit	nonprofit
32	3	Comedy Interviews	comedy-interviews	comedyinterviews
33	3	Improv	improv	improv
34	3	Stand-Up	stand-up	standup
35	4	Courses	courses	courses
36	4	How To	how-to	howto
37	4	Language Learning	language-learning	languagelearning
38	4	Self-Improvement	self-improvement	selfimprovement
39	5	Comedy Fiction	comedy-fiction	comedyfiction
40	5	Drama	drama	drama
41	5	Science Fiction	science-fiction	sciencefiction
42	8	Alternative Health	alternative-health	alternativehealth
43	8	Fitness	fitness	fitness
44	8	Medicine	medicine	medicine
45	8	Mental Health	mental-health	mentalhealth
46	8	Nutrition	nutrition	nutrition
47	8	Sexuality	sexuality	sexuality
48	9	Education for Kids	education-for-kids	educationforkids
49	9	Parenting	parenting	parenting
50	9	Pets & Animals	pets-and-animals	petsandanimals
51	9	Stories for Kids	stories-for-kids	storiesforkids
52	10	Animation & Manga	animation-and-manga	animationandmanga
53	10	Automotive	automotive	automotive
54	10	Aviation	aviation	aviation
55	10	Crafts	crafts	crafts
56	10	Games	games	games
57	10	Hobbies	hobbies	hobbies
58	10	Home & Garden	home-and-garden	homeandgarden
59	10	Video Games	video-games	videogames
60	11	Music Commentary	music-commentary	musiccommentary
61	11	Music History	music-history	musichistory
62	11	Music Interviews	music-interviews	musicinterviews
63	12	Business News	business-news	businessnews
64	12	Daily News	daily-news	dailynews
65	12	Entertainment News	entertainment-news	entertainmentnews
66	12	News Commentary	news-commentary	newscommentary
67	12	Politics	politics	politics
68	12	Sports News	sports-news	sportsnews
69	12	Tech News	tech-news	technews
70	13	Buddhism	buddhism	buddhism
71	13	Christianity	christianity	christianity
72	13	Hinduism	hinduism	hinduism
73	13	Islam	islam	islam
74	13	Judaism	judaism	judaism
75	13	Religion	religion	religion
76	13	Spirituality	spirituality	spirituality
77	14	Astronomy	astronomy	astronomy
78	14	Chemistry	chemistry	chemistry
79	14	Earth Sciences	earth-sciences	earthsciences
80	14	Life Sciences	life-sciences	lifesciences
81	14	Mathematics	mathematics	mathematics
82	14	Natural Sciences	natural-sciences	naturalsciences
83	14	Nature	nature	nature
84	14	Physics	physics	physics
85	14	Social Sciences	social-sciences	socialsciences
86	15	Documentary	documentary	documentary
87	15	Personal Journals	personal-journals	personaljournals
88	15	Philosophy	philosophy	philosophy
89	15	Places & Travel	places-and-travel	placesandtravel
90	15	Relationships	relationships	relationships
91	16	Baseball	baseball	baseball
92	16	Basketball	basketball	basketball
93	16	Cricket	cricket	cricket
94	16	Fantasy Sports	fantasy-sports	fantasysports
95	16	Football	football	football
96	16	Golf	golf	golf
97	16	Hockey	hockey	hockey
98	16	Rugby	rugby	rugby
99	16	Running	running	running
100	16	Soccer	soccer	soccer
101	16	Swimming	swimming	swimming
102	16	Tennis	tennis	tennis
103	16	Volleyball	volleyball	volleyball
104	16	Wilderness	wilderness	wilderness
105	16	Wrestling	wrestling	wrestling
106	19	After Shows	after-shows	aftershows
107	19	Film History	film-history	filmhistory
108	19	Film Interviews	film-interviews	filminterviews
109	19	Film Reviews	film-reviews	filmreviews
110	19	TV Reviews	tv-reviews	tvreviews
\.


--
-- Data for Name: channel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel (id, id_text, slug, feed_id, podcast_guid, title, sortable_title, medium_id, has_podcast_index_value, has_value_time_splits, archived_slimmed_at, follow_conversion_status, follow_conversion_attempts, follow_conversion_last_attempt_at, may_have_live_items) FROM stdin;
\.


--
-- Data for Name: channel_about; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_about (id, channel_id, author, episode_count, explicit, itunes_type_id, language, last_pub_date, website_link_url) FROM stdin;
\.


--
-- Data for Name: channel_category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_category (id, channel_id, category_id) FROM stdin;
\.


--
-- Data for Name: channel_chat; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_chat (id, channel_id, server, protocol, account_id, space) FROM stdin;
\.


--
-- Data for Name: channel_description; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_description (id, channel_id, value, preview, is_truncated, source_length) FROM stdin;
\.


--
-- Data for Name: channel_funding; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_funding (id, channel_id, url, title) FROM stdin;
\.


--
-- Data for Name: channel_image; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_image (id, channel_id, url, image_width_size, is_resized) FROM stdin;
\.


--
-- Data for Name: channel_internal_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_internal_settings (id, channel_id, embed_approved_media_url_paths) FROM stdin;
\.


--
-- Data for Name: channel_itunes_type; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_itunes_type (id, itunes_type) FROM stdin;
1	episodic
2	serial
\.


--
-- Data for Name: channel_license; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_license (id, channel_id, identifier, url) FROM stdin;
\.


--
-- Data for Name: channel_location; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_location (id, channel_id, geo, osm, name) FROM stdin;
\.


--
-- Data for Name: channel_merge; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_merge (id, from_podcast_index_id, to_podcast_index_id, from_channel_id, to_channel_id, mode, status, confidence, match_stats, note, created_at, updated_at, applied_at) FROM stdin;
\.


--
-- Data for Name: channel_merge_journal; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_merge_journal (id, channel_merge_id, table_name, row_pk, action, before_json, after_json, created_at) FROM stdin;
\.


--
-- Data for Name: channel_meta_boost; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_meta_boost (id, channel_id, standard, node) FROM stdin;
\.


--
-- Data for Name: channel_person; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_person (id, channel_id, name, role, person_group, img, href) FROM stdin;
\.


--
-- Data for Name: channel_podroll; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_podroll (id, channel_id) FROM stdin;
\.


--
-- Data for Name: channel_podroll_remote_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_podroll_remote_item (id, channel_podroll_id, feed_guid, feed_url, item_guid, title, medium_id) FROM stdin;
\.


--
-- Data for Name: channel_publisher; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_publisher (id, channel_id) FROM stdin;
\.


--
-- Data for Name: channel_publisher_remote_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_publisher_remote_item (id, channel_publisher_id, feed_guid, feed_url, item_guid, title, medium_id, item_id) FROM stdin;
\.


--
-- Data for Name: channel_remote_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_remote_item (id, channel_id, feed_guid, feed_url, item_guid, title, medium_id) FROM stdin;
\.


--
-- Data for Name: channel_season; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_season (id, channel_id, number, name) FROM stdin;
\.


--
-- Data for Name: channel_social_interact; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_social_interact (id, channel_id, protocol, uri, account_id, account_url, priority) FROM stdin;
\.


--
-- Data for Name: channel_trailer; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_trailer (id, channel_id, url, title, pub_date, length, type, channel_season_id) FROM stdin;
\.


--
-- Data for Name: channel_txt; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_txt (id, channel_id, purpose, value) FROM stdin;
\.


--
-- Data for Name: channel_value; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_value (id, channel_id, type, method, suggested) FROM stdin;
\.


--
-- Data for Name: channel_value_recipient; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_value_recipient (id, channel_value_id, type, address, split, name, custom_key, custom_value, fee) FROM stdin;
\.


--
-- Data for Name: channel_verified_publisher; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channel_verified_publisher (id, channel_id, publisher_channel_id, item_id, claim_position) FROM stdin;
\.


--
-- Data for Name: clip; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clip (id, id_text, account_id, item_id, start_time, end_time, title, description, sharable_status_id, created_at, removed_source, source_removed_at) FROM stdin;
\.


--
-- Data for Name: embed_demo_showcase; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.embed_demo_showcase (showcase_id, resource_id_text, created_at, updated_at, play_resource_id_text) FROM stdin;
\.


--
-- Data for Name: feed; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed (id, url, podcast_index_id, last_parsed_file_hash, is_parsing, parsing_priority, container_id, created_at, updated_at, spam_item_limit_override, max_response_body_bytes_override, description_length_tier_override, description_truncated_count, description_longest_source_length, description_truncated_at) FROM stdin;
\.


--
-- Data for Name: feed_condition; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_condition (id, feed_id, feed_condition_type_id, is_active, source, note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: feed_condition_type; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_condition_type (id, condition_key, created_at, updated_at) FROM stdin;
1	spam_detected	2000-01-01 00:00:00	2000-01-01 00:00:00
2	oversized_detected	2000-01-01 00:00:00	2000-01-01 00:00:00
3	takedown_active	2000-01-01 00:00:00	2000-01-01 00:00:00
4	manual_block	2000-01-01 00:00:00	2000-01-01 00:00:00
5	parse_failure_transient	2000-01-01 00:00:00	2000-01-01 00:00:00
6	spam_permitted	2000-01-01 00:00:00	2000-01-01 00:00:00
\.


--
-- Data for Name: feed_lifecycle_event; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_lifecycle_event (id, feed_id, from_lifecycle_state_type_id, to_lifecycle_state_type_id, reason_key, note, source, created_at) FROM stdin;
\.


--
-- Data for Name: feed_lifecycle_state; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_lifecycle_state (id, feed_id, feed_lifecycle_state_type_id, reason_key, note, updated_by_source, updated_by_admin_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: feed_lifecycle_state_type; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_lifecycle_state_type (id, state_key, created_at, updated_at) FROM stdin;
1	active	2000-01-01 00:00:00	2000-01-01 00:00:00
2	pending_archive	2000-01-01 00:00:00	2000-01-01 00:00:00
3	archived	2000-01-01 00:00:00	2000-01-01 00:00:00
4	takedown	2000-01-01 00:00:00	2000-01-01 00:00:00
5	merged	2000-01-01 00:00:00	2000-01-01 00:00:00
\.


--
-- Data for Name: feed_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_log (id, feed_id, last_http_status, last_good_http_status_time, last_finished_parse_time, parse_errors, last_failed_parse_time) FROM stdin;
\.


--
-- Data for Name: feed_policy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_policy (id, feed_id, parse_allowed, public_visible, add_allowed, primary_block_reason, last_policy_refresh_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: feed_policy_override; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_policy_override (id, feed_id, parse_allowed_override, public_visible_override, add_allowed_override, note, updated_by_admin_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: feed_takedown_reason; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.feed_takedown_reason (id, reason, created_at, updated_at) FROM stdin;
1	copyright	2000-01-01 00:00:00	2000-01-01 00:00:00
2	illegal_content	2000-01-01 00:00:00	2000-01-01 00:00:00
3	spam	2000-01-01 00:00:00	2000-01-01 00:00:00
4	malware	2000-01-01 00:00:00	2000-01-01 00:00:00
5	dead_feed	2000-01-01 00:00:00	2000-01-01 00:00:00
6	owner_request	2000-01-01 00:00:00	2000-01-01 00:00:00
7	other	2000-01-01 00:00:00	2000-01-01 00:00:00
\.


--
-- Data for Name: image_shrink_source; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.image_shrink_source (id, url, etag, last_modified, content_length, checksum_sha256, last_checked_at, last_changed_at, created_at, updated_at, last_deep_checked_at) FROM stdin;
\.


--
-- Data for Name: item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item (id, id_text, slug, channel_id, guid, guid_enclosure_url, pub_date, title, item_flag_status_id, archived_slimmed_at) FROM stdin;
\.


--
-- Data for Name: item_about; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_about (id, item_id, duration, explicit, website_link_url, item_itunes_episode_type_id) FROM stdin;
\.


--
-- Data for Name: item_chapter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_chapter (id, id_text, item_chapters_object_id, data_hash, start_time, end_time, title, img, web_url, table_of_contents) FROM stdin;
\.


--
-- Data for Name: item_chapter_location; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_chapter_location (id, item_chapter_id, geo, osm, name) FROM stdin;
\.


--
-- Data for Name: item_chapters_feed; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_chapters_feed (id, item_id, url, type) FROM stdin;
\.


--
-- Data for Name: item_chapters_feed_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_chapters_feed_log (id, item_chapters_feed_id, last_http_status, last_good_http_status_time, last_finished_parse_time, parse_errors) FROM stdin;
\.


--
-- Data for Name: item_chapters_object; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_chapters_object (id, item_chapters_feed_id, version, author, title, podcast_name, description, file_name, waypoints) FROM stdin;
\.


--
-- Data for Name: item_chat; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_chat (id, item_id, server, protocol, account_id, space) FROM stdin;
\.


--
-- Data for Name: item_content_link; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_content_link (id, item_id, href, title) FROM stdin;
\.


--
-- Data for Name: item_description; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_description (id, item_id, value, preview, is_truncated, source_length) FROM stdin;
\.


--
-- Data for Name: item_enclosure; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_enclosure (id, item_id, type, length, bitrate, height, language, title, rel, codecs, item_enclosure_default) FROM stdin;
\.


--
-- Data for Name: item_enclosure_integrity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_enclosure_integrity (id, item_enclosure_id, type, value) FROM stdin;
\.


--
-- Data for Name: item_enclosure_source; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_enclosure_source (id, item_enclosure_id, uri, content_type) FROM stdin;
\.


--
-- Data for Name: item_flag_status; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_flag_status (id, status, created_at, updated_at) FROM stdin;
1	active	2000-01-01 00:00:00	2000-01-01 00:00:00
2	pending-archive	2000-01-01 00:00:00	2000-01-01 00:00:00
3	archived	2000-01-01 00:00:00	2000-01-01 00:00:00
4	pending-delete	2000-01-01 00:00:00	2000-01-01 00:00:00
\.


--
-- Data for Name: item_funding; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_funding (id, item_id, url, title) FROM stdin;
\.


--
-- Data for Name: item_image; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_image (id, item_id, url, image_width_size, is_resized) FROM stdin;
\.


--
-- Data for Name: item_itunes_episode_type; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_itunes_episode_type (id, itunes_episode_type) FROM stdin;
1	full
2	trailer
3	bonus
\.


--
-- Data for Name: item_license; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_license (id, item_id, identifier, url) FROM stdin;
\.


--
-- Data for Name: item_location; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_location (id, item_id, geo, osm, name) FROM stdin;
\.


--
-- Data for Name: item_merge_map; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_merge_map (id, channel_merge_id, from_item_id, to_item_id, match_tier) FROM stdin;
\.


--
-- Data for Name: item_person; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_person (id, item_id, name, role, person_group, img, href) FROM stdin;
\.


--
-- Data for Name: item_season; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_season (id, channel_season_id, item_id, title) FROM stdin;
\.


--
-- Data for Name: item_season_episode; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_season_episode (id, item_id, display, number) FROM stdin;
\.


--
-- Data for Name: item_social_interact; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_social_interact (id, item_id, protocol, uri, account_id, account_url, priority) FROM stdin;
\.


--
-- Data for Name: item_soundbite; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_soundbite (id, id_text, item_id, start_time, duration, title) FROM stdin;
\.


--
-- Data for Name: item_transcript; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_transcript (id, item_id, url, type, language, rel) FROM stdin;
\.


--
-- Data for Name: item_txt; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_txt (id, item_id, purpose, value) FROM stdin;
\.


--
-- Data for Name: item_value; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_value (id, item_id, type, method, suggested) FROM stdin;
\.


--
-- Data for Name: item_value_recipient; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_value_recipient (id, item_value_id, type, address, split, name, custom_key, custom_value, fee) FROM stdin;
\.


--
-- Data for Name: item_value_time_split; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_value_time_split (id, item_value_id, start_time, duration, remote_start_time, remote_percentage) FROM stdin;
\.


--
-- Data for Name: item_value_time_split_recipient; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_value_time_split_recipient (id, item_value_time_split_id, type, address, split, name, custom_key, custom_value, fee) FROM stdin;
\.


--
-- Data for Name: item_value_time_split_remote_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.item_value_time_split_remote_item (id, item_value_time_split_id, feed_guid, feed_url, item_guid, title) FROM stdin;
\.


--
-- Data for Name: live_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.live_item (id, item_id, live_item_status_id, start_time, end_time, chat_web_url) FROM stdin;
\.


--
-- Data for Name: live_item_status; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.live_item_status (id, status) FROM stdin;
1	pending
2	live
3	ended
\.


--
-- Data for Name: medium; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.medium (id, value) FROM stdin;
1	publisher
2	podcast
3	music
4	video
5	film
6	audiobook
7	newsletter
8	blog
9	course
10	mixed
11	podcastL
12	musicL
13	videoL
14	filmL
15	audiobookL
16	newsletterL
17	blogL
18	publisherL
19	courseL
20	av
21	publisher-podcast
22	publisher-music
23	publisher-video
24	publisher-film
25	publisher-audiobook
26	publisher-newsletter
27	publisher-blog
28	publisher-course
29	publisher-av
\.


--
-- Data for Name: membership_claim_token; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.membership_claim_token (id, claimed, months_to_add, account_membership_id) FROM stdin;
\.


--
-- Data for Name: on_demand_parser_event; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.on_demand_parser_event (id, account_id, podcast_index_id, remote_parent_podcast_index_id, type, created_at) FROM stdin;
\.


--
-- Data for Name: playlist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.playlist (id, id_text, account_id, sharable_status_id, title, description, is_default_likes, item_count, medium_id, last_updated) FROM stdin;
\.


--
-- Data for Name: playlist_resource; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.playlist_resource (id, playlist_id, list_position, item_id, clip_id, item_soundbite_id, add_by_rss_resource_data, add_by_rss_hash_id, removed_source, source_removed_at) FROM stdin;
\.


--
-- Data for Name: podcast_index_dead_feed_sync; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.podcast_index_dead_feed_sync (id, last_modified, etag, synced_at, last_retire_eligible_count) FROM stdin;
\.


--
-- Data for Name: product_membership_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_membership_settings (id, free_trial_expiration_seconds, created_at, updated_at, trial_max_add_by_rss_feeds, trial_max_manual_refreshes_per_hour, premium_max_add_by_rss_feeds, premium_max_manual_refreshes_per_hour) FROM stdin;
\.


--
-- Data for Name: queue; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.queue (id, id_text, account_id, medium_id, is_active_queue) FROM stdin;
\.


--
-- Data for Name: queue_resource; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.queue_resource (id, queue_id, list_position, playback_position, media_file_duration, completed, item_id, clip_id, item_soundbite_id, add_by_rss_resource_data, add_by_rss_hash_id, last_played_at, last_played_received_at) FROM stdin;
\.


--
-- Data for Name: scheduled_job; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.scheduled_job (id, job_type, dedupe_key, run_after, status, attempts, max_attempts, locked_at, locked_by, payload, last_error, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sharable_status; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sharable_status (id, status) FROM stdin;
1	public
2	unlisted
3	private
\.


--
-- Data for Name: stats_daily_account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_daily_account (account_id, day, listener_count, all_time_listener_count) FROM stdin;
\.


--
-- Data for Name: stats_daily_channel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_daily_channel (channel_id, day, listener_count, completion_count, all_time_listener_count) FROM stdin;
\.


--
-- Data for Name: stats_daily_clip; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_daily_clip (clip_id, day, listener_count, completion_count, all_time_listener_count) FROM stdin;
\.


--
-- Data for Name: stats_daily_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_daily_item (item_id, day, listener_count, completion_count, all_time_listener_count) FROM stdin;
\.


--
-- Data for Name: stats_daily_playlist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_daily_playlist (playlist_id, day, listener_count, all_time_listener_count) FROM stdin;
\.


--
-- Data for Name: stats_flag_signal; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_flag_signal (listener_id, too_soon_minutes, last_too_soon_minute) FROM stdin;
\.


--
-- Data for Name: stats_flagged_listener; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_flagged_listener (id, listener_id, reason, flagged_at, times_flagged, cleared_at, cleared_by_admin_id) FROM stdin;
\.


--
-- Data for Name: stats_listen_event_default; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_listen_event_default (id, created_at, listener_id, channel_id, item_id, clip_id, client_listen_id, seconds_heard, completed, popularity_counted, item_all_time_counted, channel_all_time_counted, clip_all_time_counted) FROM stdin;
\.


--
-- Data for Name: stats_open_event_default; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_open_event_default (id, created_at, listener_id, account_id, playlist_id, popularity_counted, all_time_counted) FROM stdin;
\.


--
-- Data for Name: stats_popularity_account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_popularity_account (account_id, day_count, week_count, month_count, all_time_count) FROM stdin;
\.


--
-- Data for Name: stats_popularity_channel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_popularity_channel (channel_id, day_count, week_count, month_count, all_time_count) FROM stdin;
\.


--
-- Data for Name: stats_popularity_clip; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_popularity_clip (clip_id, day_count, week_count, month_count, all_time_count) FROM stdin;
\.


--
-- Data for Name: stats_popularity_item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_popularity_item (item_id, day_count, week_count, month_count, all_time_count) FROM stdin;
\.


--
-- Data for Name: stats_popularity_playlist; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_popularity_playlist (playlist_id, day_count, week_count, month_count, all_time_count) FROM stdin;
\.


--
-- Data for Name: stats_taste_profile; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_taste_profile (listener_id, channel_id, listen_count, completion_count, first_listened_at, last_listened_at, recent_score, long_term_score, scores_updated_at) FROM stdin;
\.


--
-- Data for Name: stats_taste_profile_hidden; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stats_taste_profile_hidden (listener_id, channel_id, hidden_at) FROM stdin;
\.


--
-- Name: account_api_key_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_api_key_id_seq', 1, false);


--
-- Name: account_content_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_content_log_id_seq', 1, false);


--
-- Name: account_credentials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_credentials_id_seq', 1, false);


--
-- Name: account_device_auto_download_channel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_device_auto_download_channel_id_seq', 1, false);


--
-- Name: account_email_change_verification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_email_change_verification_id_seq', 1, false);


--
-- Name: account_fcm_device_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_fcm_device_id_seq', 1, false);


--
-- Name: account_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_id_seq', 1, false);


--
-- Name: account_membership_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_membership_id_seq', 2, true);


--
-- Name: account_membership_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_membership_status_id_seq', 1, false);


--
-- Name: account_notification_channel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_notification_channel_id_seq', 1, false);


--
-- Name: account_notification_channel_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_notification_channel_type_id_seq', 1, false);


--
-- Name: account_notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_notification_id_seq', 1, false);


--
-- Name: account_notification_preference_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_notification_preference_id_seq', 1, false);


--
-- Name: account_pending_following_channel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_pending_following_channel_id_seq', 1, false);


--
-- Name: account_profile_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_profile_id_seq', 1, false);


--
-- Name: account_reset_password_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_reset_password_id_seq', 1, false);


--
-- Name: account_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_session_id_seq', 1, false);


--
-- Name: account_set_password_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_set_password_id_seq', 1, false);


--
-- Name: account_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_settings_id_seq', 1, false);


--
-- Name: account_settings_locale_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_settings_locale_id_seq', 1, false);


--
-- Name: account_settings_notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_settings_notification_id_seq', 1, false);


--
-- Name: account_settings_notification_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_settings_notification_type_id_seq', 1, false);


--
-- Name: account_settings_playback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_settings_playback_id_seq', 1, false);


--
-- Name: account_up_device_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_up_device_id_seq', 1, false);


--
-- Name: account_verification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_verification_id_seq', 1, false);


--
-- Name: account_webpush_device_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_webpush_device_id_seq', 1, false);


--
-- Name: admin_notification_campaign_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_notification_campaign_id_seq', 1, false);


--
-- Name: billing_checkout_channel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_checkout_channel_id_seq', 10, true);


--
-- Name: billing_checkout_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_checkout_session_id_seq', 1, false);


--
-- Name: billing_membership_grant_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_membership_grant_id_seq', 1, false);


--
-- Name: billing_price_change_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_price_change_audit_id_seq', 1, false);


--
-- Name: billing_price_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_price_id_seq', 2, true);


--
-- Name: billing_processor_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_processor_product_id_seq', 1, false);


--
-- Name: billing_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_product_id_seq', 1, true);


--
-- Name: billing_transaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_transaction_id_seq', 1, false);


--
-- Name: billing_webhook_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_webhook_event_id_seq', 1, false);


--
-- Name: category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.category_id_seq', 110, true);


--
-- Name: channel_about_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_about_id_seq', 1, false);


--
-- Name: channel_category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_category_id_seq', 1, false);


--
-- Name: channel_chat_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_chat_id_seq', 1, false);


--
-- Name: channel_description_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_description_id_seq', 1, false);


--
-- Name: channel_funding_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_funding_id_seq', 1, false);


--
-- Name: channel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_id_seq', 1, false);


--
-- Name: channel_image_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_image_id_seq', 1, false);


--
-- Name: channel_internal_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_internal_settings_id_seq', 1, false);


--
-- Name: channel_itunes_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_itunes_type_id_seq', 2, true);


--
-- Name: channel_license_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_license_id_seq', 1, false);


--
-- Name: channel_location_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_location_id_seq', 1, false);


--
-- Name: channel_merge_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_merge_id_seq', 1, false);


--
-- Name: channel_merge_journal_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_merge_journal_id_seq', 1, false);


--
-- Name: channel_meta_boost_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_meta_boost_id_seq', 1, false);


--
-- Name: channel_person_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_person_id_seq', 1, false);


--
-- Name: channel_podroll_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_podroll_id_seq', 1, false);


--
-- Name: channel_podroll_remote_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_podroll_remote_item_id_seq', 1, false);


--
-- Name: channel_publisher_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_publisher_id_seq', 1, false);


--
-- Name: channel_publisher_remote_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_publisher_remote_item_id_seq', 1, false);


--
-- Name: channel_remote_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_remote_item_id_seq', 1, false);


--
-- Name: channel_season_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_season_id_seq', 1, false);


--
-- Name: channel_social_interact_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_social_interact_id_seq', 1, false);


--
-- Name: channel_trailer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_trailer_id_seq', 1, false);


--
-- Name: channel_txt_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_txt_id_seq', 1, false);


--
-- Name: channel_value_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_value_id_seq', 1, false);


--
-- Name: channel_value_recipient_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_value_recipient_id_seq', 1, false);


--
-- Name: channel_verified_publisher_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channel_verified_publisher_id_seq', 1, false);


--
-- Name: clip_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clip_id_seq', 1, false);


--
-- Name: feed_condition_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feed_condition_id_seq', 1, false);


--
-- Name: feed_condition_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feed_condition_type_id_seq', 6, true);


--
-- Name: feed_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feed_id_seq', 1, false);


--
-- Name: feed_lifecycle_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feed_lifecycle_event_id_seq', 1, false);


--
-- Name: feed_lifecycle_state_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feed_lifecycle_state_id_seq', 1, false);


--
-- Name: feed_lifecycle_state_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feed_lifecycle_state_type_id_seq', 5, true);


--
-- Name: feed_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feed_log_id_seq', 1, false);


--
-- Name: feed_policy_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feed_policy_id_seq', 1, false);


--
-- Name: feed_policy_override_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feed_policy_override_id_seq', 1, false);


--
-- Name: feed_takedown_reason_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.feed_takedown_reason_id_seq', 7, true);


--
-- Name: image_shrink_source_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.image_shrink_source_id_seq', 1, false);


--
-- Name: item_about_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_about_id_seq', 1, false);


--
-- Name: item_chapter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_chapter_id_seq', 1, false);


--
-- Name: item_chapter_location_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_chapter_location_id_seq', 1, false);


--
-- Name: item_chapters_feed_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_chapters_feed_id_seq', 1, false);


--
-- Name: item_chapters_feed_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_chapters_feed_log_id_seq', 1, false);


--
-- Name: item_chapters_object_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_chapters_object_id_seq', 1, false);


--
-- Name: item_chat_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_chat_id_seq', 1, false);


--
-- Name: item_content_link_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_content_link_id_seq', 1, false);


--
-- Name: item_description_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_description_id_seq', 1, false);


--
-- Name: item_enclosure_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_enclosure_id_seq', 1, false);


--
-- Name: item_enclosure_integrity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_enclosure_integrity_id_seq', 1, false);


--
-- Name: item_enclosure_source_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_enclosure_source_id_seq', 1, false);


--
-- Name: item_flag_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_flag_status_id_seq', 4, true);


--
-- Name: item_funding_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_funding_id_seq', 1, false);


--
-- Name: item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_id_seq', 1, false);


--
-- Name: item_image_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_image_id_seq', 1, false);


--
-- Name: item_itunes_episode_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_itunes_episode_type_id_seq', 3, true);


--
-- Name: item_license_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_license_id_seq', 1, false);


--
-- Name: item_location_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_location_id_seq', 1, false);


--
-- Name: item_merge_map_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_merge_map_id_seq', 1, false);


--
-- Name: item_person_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_person_id_seq', 1, false);


--
-- Name: item_season_episode_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_season_episode_id_seq', 1, false);


--
-- Name: item_season_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_season_id_seq', 1, false);


--
-- Name: item_social_interact_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_social_interact_id_seq', 1, false);


--
-- Name: item_soundbite_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_soundbite_id_seq', 1, false);


--
-- Name: item_transcript_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_transcript_id_seq', 1, false);


--
-- Name: item_txt_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_txt_id_seq', 1, false);


--
-- Name: item_value_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_value_id_seq', 1, false);


--
-- Name: item_value_recipient_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_value_recipient_id_seq', 1, false);


--
-- Name: item_value_time_split_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_value_time_split_id_seq', 1, false);


--
-- Name: item_value_time_split_recipient_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_value_time_split_recipient_id_seq', 1, false);


--
-- Name: item_value_time_split_remote_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.item_value_time_split_remote_item_id_seq', 1, false);


--
-- Name: live_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.live_item_id_seq', 1, false);


--
-- Name: live_item_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.live_item_status_id_seq', 3, true);


--
-- Name: medium_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.medium_id_seq', 29, true);


--
-- Name: on_demand_parser_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.on_demand_parser_event_id_seq', 1, false);


--
-- Name: playlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.playlist_id_seq', 1, false);


--
-- Name: playlist_resource_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.playlist_resource_id_seq', 1, false);


--
-- Name: queue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.queue_id_seq', 1, false);


--
-- Name: queue_resource_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.queue_resource_id_seq', 1, false);


--
-- Name: scheduled_job_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.scheduled_job_id_seq', 1, false);


--
-- Name: sharable_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sharable_status_id_seq', 3, true);


--
-- Name: stats_flagged_listener_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stats_flagged_listener_id_seq', 1, false);


--
-- Name: stats_listen_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stats_listen_event_id_seq', 1, false);


--
-- Name: stats_open_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stats_open_event_id_seq', 1, false);


--
-- Name: stats_listener stats_listener_account_id_key; Type: CONSTRAINT; Schema: listener_identity; Owner: -
--

ALTER TABLE ONLY listener_identity.stats_listener
    ADD CONSTRAINT stats_listener_account_id_key UNIQUE (account_id);


--
-- Name: stats_listener stats_listener_pkey; Type: CONSTRAINT; Schema: listener_identity; Owner: -
--

ALTER TABLE ONLY listener_identity.stats_listener
    ADD CONSTRAINT stats_listener_pkey PRIMARY KEY (listener_id);


--
-- Name: account_api_key account_api_key_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_api_key
    ADD CONSTRAINT account_api_key_id_text_key UNIQUE (id_text);


--
-- Name: account_api_key account_api_key_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_api_key
    ADD CONSTRAINT account_api_key_pkey PRIMARY KEY (id);


--
-- Name: account_api_key account_api_key_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_api_key
    ADD CONSTRAINT account_api_key_token_hash_key UNIQUE (token_hash);


--
-- Name: account account_billing_customer_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_billing_customer_ref_key UNIQUE (billing_customer_ref);


--
-- Name: account_content_log account_content_log_account_type_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_content_log
    ADD CONSTRAINT account_content_log_account_type_channel_key UNIQUE (account_id, log_type, channel_id_text);


--
-- Name: account_content_log account_content_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_content_log
    ADD CONSTRAINT account_content_log_pkey PRIMARY KEY (id);


--
-- Name: account_credentials account_credentials_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_credentials
    ADD CONSTRAINT account_credentials_account_id_key UNIQUE (account_id);


--
-- Name: account_credentials account_credentials_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_credentials
    ADD CONSTRAINT account_credentials_email_key UNIQUE (email);


--
-- Name: account_credentials account_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_credentials
    ADD CONSTRAINT account_credentials_pkey PRIMARY KEY (id);


--
-- Name: account_credentials account_credentials_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_credentials
    ADD CONSTRAINT account_credentials_username_key UNIQUE (username);


--
-- Name: account_device_auto_download_channel account_device_auto_download_channel_account_install_channel_ke; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_device_auto_download_channel
    ADD CONSTRAINT account_device_auto_download_channel_account_install_channel_ke UNIQUE (account_id, installation_id, channel_id);


--
-- Name: account_device_auto_download_channel account_device_auto_download_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_device_auto_download_channel
    ADD CONSTRAINT account_device_auto_download_channel_pkey PRIMARY KEY (id);


--
-- Name: account_email_change_verification account_email_change_verification_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_email_change_verification
    ADD CONSTRAINT account_email_change_verification_account_id_key UNIQUE (account_id);


--
-- Name: account_email_change_verification account_email_change_verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_email_change_verification
    ADD CONSTRAINT account_email_change_verification_pkey PRIMARY KEY (id);


--
-- Name: account_fcm_device account_fcm_device_fcm_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_fcm_device
    ADD CONSTRAINT account_fcm_device_fcm_token_key UNIQUE (fcm_token);


--
-- Name: account_fcm_device account_fcm_device_installation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_fcm_device
    ADD CONSTRAINT account_fcm_device_installation_id_key UNIQUE (installation_id);


--
-- Name: account_fcm_device account_fcm_device_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_fcm_device
    ADD CONSTRAINT account_fcm_device_pkey PRIMARY KEY (id);


--
-- Name: account_following_account account_following_account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_account
    ADD CONSTRAINT account_following_account_pkey PRIMARY KEY (account_id, following_account_id);


--
-- Name: account_following_add_by_rss_channel account_following_add_by_rss_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_add_by_rss_channel
    ADD CONSTRAINT account_following_add_by_rss_channel_pkey PRIMARY KEY (account_id, feed_url);


--
-- Name: account_following_channel account_following_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_channel
    ADD CONSTRAINT account_following_channel_pkey PRIMARY KEY (account_id, channel_id);


--
-- Name: account_following_playlist account_following_playlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_playlist
    ADD CONSTRAINT account_following_playlist_pkey PRIMARY KEY (account_id, playlist_id);


--
-- Name: account account_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_id_text_key UNIQUE (id_text);


--
-- Name: account_membership account_membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_membership
    ADD CONSTRAINT account_membership_pkey PRIMARY KEY (id);


--
-- Name: account_membership_status account_membership_status_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_membership_status
    ADD CONSTRAINT account_membership_status_account_id_key UNIQUE (account_id);


--
-- Name: account_membership_status account_membership_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_membership_status
    ADD CONSTRAINT account_membership_status_pkey PRIMARY KEY (id);


--
-- Name: account_membership account_membership_tier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_membership
    ADD CONSTRAINT account_membership_tier_key UNIQUE (tier);


--
-- Name: account_metaboost account_metaboost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_metaboost
    ADD CONSTRAINT account_metaboost_pkey PRIMARY KEY (account_id);


--
-- Name: account_metaboost account_metaboost_sender_guid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_metaboost
    ADD CONSTRAINT account_metaboost_sender_guid_key UNIQUE (sender_guid);


--
-- Name: account_notification_channel account_notification_channel_channel_id_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_channel
    ADD CONSTRAINT account_notification_channel_channel_id_account_id_key UNIQUE (channel_id, account_id);


--
-- Name: account_notification_channel account_notification_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_channel
    ADD CONSTRAINT account_notification_channel_pkey PRIMARY KEY (id);


--
-- Name: account_notification_channel_type account_notification_channel_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_channel_type
    ADD CONSTRAINT account_notification_channel_type_pkey PRIMARY KEY (id);


--
-- Name: account_notification account_notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification
    ADD CONSTRAINT account_notification_pkey PRIMARY KEY (id);


--
-- Name: account_notification_preference account_notification_preference_account_id_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_preference
    ADD CONSTRAINT account_notification_preference_account_id_category_key UNIQUE (account_id, category);


--
-- Name: account_notification_preference account_notification_preference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_preference
    ADD CONSTRAINT account_notification_preference_pkey PRIMARY KEY (id);


--
-- Name: account_pending_following_channel account_pending_following_channel_account_id_feed_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_pending_following_channel
    ADD CONSTRAINT account_pending_following_channel_account_id_feed_url_key UNIQUE (account_id, feed_url);


--
-- Name: account_pending_following_channel account_pending_following_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_pending_following_channel
    ADD CONSTRAINT account_pending_following_channel_pkey PRIMARY KEY (id);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: account_profile account_profile_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_profile
    ADD CONSTRAINT account_profile_account_id_key UNIQUE (account_id);


--
-- Name: account_profile account_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_profile
    ADD CONSTRAINT account_profile_pkey PRIMARY KEY (id);


--
-- Name: account_reset_password account_reset_password_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_reset_password
    ADD CONSTRAINT account_reset_password_account_id_key UNIQUE (account_id);


--
-- Name: account_reset_password account_reset_password_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_reset_password
    ADD CONSTRAINT account_reset_password_pkey PRIMARY KEY (id);


--
-- Name: account_session account_session_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_session
    ADD CONSTRAINT account_session_id_text_key UNIQUE (id_text);


--
-- Name: account_session account_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_session
    ADD CONSTRAINT account_session_pkey PRIMARY KEY (id);


--
-- Name: account_set_password account_set_password_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_set_password
    ADD CONSTRAINT account_set_password_account_id_key UNIQUE (account_id);


--
-- Name: account_set_password account_set_password_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_set_password
    ADD CONSTRAINT account_set_password_pkey PRIMARY KEY (id);


--
-- Name: account_settings account_settings_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings
    ADD CONSTRAINT account_settings_account_id_key UNIQUE (account_id);


--
-- Name: account_settings_locale account_settings_locale_account_settings_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_locale
    ADD CONSTRAINT account_settings_locale_account_settings_id_key UNIQUE (account_settings_id);


--
-- Name: account_settings_locale account_settings_locale_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_locale
    ADD CONSTRAINT account_settings_locale_pkey PRIMARY KEY (id);


--
-- Name: account_settings_notification account_settings_notification_account_settings_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_notification
    ADD CONSTRAINT account_settings_notification_account_settings_id_key UNIQUE (account_settings_id);


--
-- Name: account_settings_notification account_settings_notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_notification
    ADD CONSTRAINT account_settings_notification_pkey PRIMARY KEY (id);


--
-- Name: account_settings_notification_type account_settings_notification_type_notification_id_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_notification_type
    ADD CONSTRAINT account_settings_notification_type_notification_id_type_unique UNIQUE (account_settings_notification_id, type);


--
-- Name: account_settings_notification_type account_settings_notification_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_notification_type
    ADD CONSTRAINT account_settings_notification_type_pkey PRIMARY KEY (id);


--
-- Name: account_settings account_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings
    ADD CONSTRAINT account_settings_pkey PRIMARY KEY (id);


--
-- Name: account_settings_playback account_settings_playback_account_settings_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_playback
    ADD CONSTRAINT account_settings_playback_account_settings_id_key UNIQUE (account_settings_id);


--
-- Name: account_settings_playback account_settings_playback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_playback
    ADD CONSTRAINT account_settings_playback_pkey PRIMARY KEY (id);


--
-- Name: account_terms_acceptance account_terms_acceptance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_terms_acceptance
    ADD CONSTRAINT account_terms_acceptance_pkey PRIMARY KEY (account_id);


--
-- Name: account_up_device account_up_device_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_up_device
    ADD CONSTRAINT account_up_device_account_id_key UNIQUE (account_id);


--
-- Name: account_up_device account_up_device_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_up_device
    ADD CONSTRAINT account_up_device_pkey PRIMARY KEY (id);


--
-- Name: account_up_device account_up_device_up_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_up_device
    ADD CONSTRAINT account_up_device_up_endpoint_key UNIQUE (up_endpoint);


--
-- Name: account_verification account_verification_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_verification
    ADD CONSTRAINT account_verification_account_id_key UNIQUE (account_id);


--
-- Name: account_verification account_verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_verification
    ADD CONSTRAINT account_verification_pkey PRIMARY KEY (id);


--
-- Name: account_webpush_device account_webpush_device_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_webpush_device
    ADD CONSTRAINT account_webpush_device_endpoint_key UNIQUE (endpoint);


--
-- Name: account_webpush_device account_webpush_device_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_webpush_device
    ADD CONSTRAINT account_webpush_device_pkey PRIMARY KEY (id);


--
-- Name: admin_notification_campaign admin_notification_campaign_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notification_campaign
    ADD CONSTRAINT admin_notification_campaign_id_text_key UNIQUE (id_text);


--
-- Name: admin_notification_campaign admin_notification_campaign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notification_campaign
    ADD CONSTRAINT admin_notification_campaign_pkey PRIMARY KEY (id);


--
-- Name: billing_checkout_channel billing_checkout_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_checkout_channel
    ADD CONSTRAINT billing_checkout_channel_pkey PRIMARY KEY (id);


--
-- Name: billing_checkout_channel billing_checkout_channel_processor_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_checkout_channel
    ADD CONSTRAINT billing_checkout_channel_processor_platform_key UNIQUE (processor_id, platform);


--
-- Name: billing_checkout_session billing_checkout_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_checkout_session
    ADD CONSTRAINT billing_checkout_session_pkey PRIMARY KEY (id);


--
-- Name: billing_checkout_session billing_checkout_session_processor_external_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_checkout_session
    ADD CONSTRAINT billing_checkout_session_processor_external_key UNIQUE (processor_id, external_id);


--
-- Name: billing_membership_grant billing_membership_grant_billing_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_membership_grant
    ADD CONSTRAINT billing_membership_grant_billing_transaction_id_key UNIQUE (billing_transaction_id);


--
-- Name: billing_membership_grant billing_membership_grant_membership_claim_token_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_membership_grant
    ADD CONSTRAINT billing_membership_grant_membership_claim_token_id_key UNIQUE (membership_claim_token_id);


--
-- Name: billing_membership_grant billing_membership_grant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_membership_grant
    ADD CONSTRAINT billing_membership_grant_pkey PRIMARY KEY (id);


--
-- Name: billing_price_change_audit billing_price_change_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_price_change_audit
    ADD CONSTRAINT billing_price_change_audit_pkey PRIMARY KEY (id);


--
-- Name: billing_price billing_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_price
    ADD CONSTRAINT billing_price_pkey PRIMARY KEY (id);


--
-- Name: billing_price billing_price_unique_window_start; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_price
    ADD CONSTRAINT billing_price_unique_window_start UNIQUE (billing_product_id, currency_code, billing_cadence, effective_from);


--
-- Name: billing_processor billing_processor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_processor
    ADD CONSTRAINT billing_processor_pkey PRIMARY KEY (id);


--
-- Name: billing_processor_product billing_processor_product_external_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_processor_product
    ADD CONSTRAINT billing_processor_product_external_key UNIQUE NULLS NOT DISTINCT (processor_id, external_product_id, external_base_plan_id);


--
-- Name: billing_processor_product billing_processor_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_processor_product
    ADD CONSTRAINT billing_processor_product_pkey PRIMARY KEY (id);


--
-- Name: billing_product billing_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_product
    ADD CONSTRAINT billing_product_pkey PRIMARY KEY (id);


--
-- Name: billing_product billing_product_product_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_product
    ADD CONSTRAINT billing_product_product_code_key UNIQUE (product_code);


--
-- Name: billing_transaction billing_transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_transaction
    ADD CONSTRAINT billing_transaction_pkey PRIMARY KEY (id);


--
-- Name: billing_transaction billing_transaction_processor_external_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_transaction
    ADD CONSTRAINT billing_transaction_processor_external_key UNIQUE (processor_id, external_transaction_id);


--
-- Name: billing_webhook_event billing_webhook_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_webhook_event
    ADD CONSTRAINT billing_webhook_event_pkey PRIMARY KEY (id);


--
-- Name: billing_webhook_event billing_webhook_event_processor_external_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_webhook_event
    ADD CONSTRAINT billing_webhook_event_processor_external_key UNIQUE (processor_id, external_event_id);


--
-- Name: category category_display_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_display_name_key UNIQUE (display_name);


--
-- Name: category category_mapping_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_mapping_key_key UNIQUE (mapping_key);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);


--
-- Name: category category_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_slug_key UNIQUE (slug);


--
-- Name: channel_about channel_about_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_about
    ADD CONSTRAINT channel_about_channel_id_key UNIQUE (channel_id);


--
-- Name: channel_about channel_about_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_about
    ADD CONSTRAINT channel_about_pkey PRIMARY KEY (id);


--
-- Name: channel_category channel_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_category
    ADD CONSTRAINT channel_category_pkey PRIMARY KEY (id);


--
-- Name: channel_chat channel_chat_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_chat
    ADD CONSTRAINT channel_chat_channel_id_key UNIQUE (channel_id);


--
-- Name: channel_chat channel_chat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_chat
    ADD CONSTRAINT channel_chat_pkey PRIMARY KEY (id);


--
-- Name: channel_description channel_description_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_description
    ADD CONSTRAINT channel_description_channel_id_key UNIQUE (channel_id);


--
-- Name: channel_description channel_description_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_description
    ADD CONSTRAINT channel_description_pkey PRIMARY KEY (id);


--
-- Name: channel channel_feed_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT channel_feed_id_key UNIQUE (feed_id);


--
-- Name: channel_funding channel_funding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_funding
    ADD CONSTRAINT channel_funding_pkey PRIMARY KEY (id);


--
-- Name: channel channel_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT channel_id_text_key UNIQUE (id_text);


--
-- Name: channel_image channel_image_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_image
    ADD CONSTRAINT channel_image_pkey PRIMARY KEY (id);


--
-- Name: channel_internal_settings channel_internal_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_internal_settings
    ADD CONSTRAINT channel_internal_settings_pkey PRIMARY KEY (id);


--
-- Name: channel_itunes_type channel_itunes_type_itunes_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_itunes_type
    ADD CONSTRAINT channel_itunes_type_itunes_type_key UNIQUE (itunes_type);


--
-- Name: channel_itunes_type channel_itunes_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_itunes_type
    ADD CONSTRAINT channel_itunes_type_pkey PRIMARY KEY (id);


--
-- Name: channel_license channel_license_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_license
    ADD CONSTRAINT channel_license_channel_id_key UNIQUE (channel_id);


--
-- Name: channel_license channel_license_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_license
    ADD CONSTRAINT channel_license_pkey PRIMARY KEY (id);


--
-- Name: channel_location channel_location_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_location
    ADD CONSTRAINT channel_location_channel_id_key UNIQUE (channel_id);


--
-- Name: channel_location channel_location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_location
    ADD CONSTRAINT channel_location_pkey PRIMARY KEY (id);


--
-- Name: channel_merge channel_merge_from_podcast_index_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_merge
    ADD CONSTRAINT channel_merge_from_podcast_index_id_key UNIQUE (from_podcast_index_id);


--
-- Name: channel_merge_journal channel_merge_journal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_merge_journal
    ADD CONSTRAINT channel_merge_journal_pkey PRIMARY KEY (id);


--
-- Name: channel_merge channel_merge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_merge
    ADD CONSTRAINT channel_merge_pkey PRIMARY KEY (id);


--
-- Name: channel_meta_boost channel_meta_boost_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_meta_boost
    ADD CONSTRAINT channel_meta_boost_channel_id_key UNIQUE (channel_id);


--
-- Name: channel_meta_boost channel_meta_boost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_meta_boost
    ADD CONSTRAINT channel_meta_boost_pkey PRIMARY KEY (id);


--
-- Name: channel_person channel_person_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_person
    ADD CONSTRAINT channel_person_pkey PRIMARY KEY (id);


--
-- Name: channel channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT channel_pkey PRIMARY KEY (id);


--
-- Name: channel channel_podcast_guid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT channel_podcast_guid_key UNIQUE (podcast_guid);


--
-- Name: channel_podroll channel_podroll_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_podroll
    ADD CONSTRAINT channel_podroll_channel_id_key UNIQUE (channel_id);


--
-- Name: channel_podroll channel_podroll_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_podroll
    ADD CONSTRAINT channel_podroll_pkey PRIMARY KEY (id);


--
-- Name: channel_podroll_remote_item channel_podroll_remote_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_podroll_remote_item
    ADD CONSTRAINT channel_podroll_remote_item_pkey PRIMARY KEY (id);


--
-- Name: channel_publisher channel_publisher_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_publisher
    ADD CONSTRAINT channel_publisher_channel_id_key UNIQUE (channel_id);


--
-- Name: channel_publisher channel_publisher_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_publisher
    ADD CONSTRAINT channel_publisher_pkey PRIMARY KEY (id);


--
-- Name: channel_publisher_remote_item channel_publisher_remote_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_publisher_remote_item
    ADD CONSTRAINT channel_publisher_remote_item_pkey PRIMARY KEY (id);


--
-- Name: channel_remote_item channel_remote_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_remote_item
    ADD CONSTRAINT channel_remote_item_pkey PRIMARY KEY (id);


--
-- Name: channel_season channel_season_channel_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_season
    ADD CONSTRAINT channel_season_channel_id_number_key UNIQUE (channel_id, number);


--
-- Name: channel_season channel_season_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_season
    ADD CONSTRAINT channel_season_pkey PRIMARY KEY (id);


--
-- Name: channel_social_interact channel_social_interact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_social_interact
    ADD CONSTRAINT channel_social_interact_pkey PRIMARY KEY (id);


--
-- Name: channel_trailer channel_trailer_channel_id_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_trailer
    ADD CONSTRAINT channel_trailer_channel_id_url_key UNIQUE (channel_id, url);


--
-- Name: channel_trailer channel_trailer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_trailer
    ADD CONSTRAINT channel_trailer_pkey PRIMARY KEY (id);


--
-- Name: channel_txt channel_txt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_txt
    ADD CONSTRAINT channel_txt_pkey PRIMARY KEY (id);


--
-- Name: channel_value channel_value_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_value
    ADD CONSTRAINT channel_value_pkey PRIMARY KEY (id);


--
-- Name: channel_value_recipient channel_value_recipient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_value_recipient
    ADD CONSTRAINT channel_value_recipient_pkey PRIMARY KEY (id);


--
-- Name: channel_verified_publisher channel_verified_publisher_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_verified_publisher
    ADD CONSTRAINT channel_verified_publisher_pkey PRIMARY KEY (id);


--
-- Name: clip clip_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clip
    ADD CONSTRAINT clip_id_text_key UNIQUE (id_text);


--
-- Name: clip clip_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clip
    ADD CONSTRAINT clip_pkey PRIMARY KEY (id);


--
-- Name: embed_demo_showcase embed_demo_showcase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embed_demo_showcase
    ADD CONSTRAINT embed_demo_showcase_pkey PRIMARY KEY (showcase_id);


--
-- Name: feed_condition feed_condition_feed_id_feed_condition_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_condition
    ADD CONSTRAINT feed_condition_feed_id_feed_condition_type_id_key UNIQUE (feed_id, feed_condition_type_id);


--
-- Name: feed_condition feed_condition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_condition
    ADD CONSTRAINT feed_condition_pkey PRIMARY KEY (id);


--
-- Name: feed_condition_type feed_condition_type_condition_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_condition_type
    ADD CONSTRAINT feed_condition_type_condition_key_key UNIQUE (condition_key);


--
-- Name: feed_condition_type feed_condition_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_condition_type
    ADD CONSTRAINT feed_condition_type_pkey PRIMARY KEY (id);


--
-- Name: feed_lifecycle_event feed_lifecycle_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_event
    ADD CONSTRAINT feed_lifecycle_event_pkey PRIMARY KEY (id);


--
-- Name: feed_lifecycle_state feed_lifecycle_state_feed_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_state
    ADD CONSTRAINT feed_lifecycle_state_feed_id_key UNIQUE (feed_id);


--
-- Name: feed_lifecycle_state feed_lifecycle_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_state
    ADD CONSTRAINT feed_lifecycle_state_pkey PRIMARY KEY (id);


--
-- Name: feed_lifecycle_state_type feed_lifecycle_state_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_state_type
    ADD CONSTRAINT feed_lifecycle_state_type_pkey PRIMARY KEY (id);


--
-- Name: feed_lifecycle_state_type feed_lifecycle_state_type_state_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_state_type
    ADD CONSTRAINT feed_lifecycle_state_type_state_key_key UNIQUE (state_key);


--
-- Name: feed_log feed_log_feed_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_log
    ADD CONSTRAINT feed_log_feed_id_key UNIQUE (feed_id);


--
-- Name: feed_log feed_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_log
    ADD CONSTRAINT feed_log_pkey PRIMARY KEY (id);


--
-- Name: feed feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_pkey PRIMARY KEY (id);


--
-- Name: feed feed_podcast_index_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_podcast_index_id_key UNIQUE (podcast_index_id);


--
-- Name: feed_policy feed_policy_feed_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_policy
    ADD CONSTRAINT feed_policy_feed_id_key UNIQUE (feed_id);


--
-- Name: feed_policy_override feed_policy_override_feed_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_policy_override
    ADD CONSTRAINT feed_policy_override_feed_id_key UNIQUE (feed_id);


--
-- Name: feed_policy_override feed_policy_override_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_policy_override
    ADD CONSTRAINT feed_policy_override_pkey PRIMARY KEY (id);


--
-- Name: feed_policy feed_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_policy
    ADD CONSTRAINT feed_policy_pkey PRIMARY KEY (id);


--
-- Name: feed_takedown_reason feed_takedown_reason_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_takedown_reason
    ADD CONSTRAINT feed_takedown_reason_pkey PRIMARY KEY (id);


--
-- Name: feed_takedown_reason feed_takedown_reason_reason_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_takedown_reason
    ADD CONSTRAINT feed_takedown_reason_reason_key UNIQUE (reason);


--
-- Name: feed feed_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_url_key UNIQUE (url);


--
-- Name: image_shrink_source image_shrink_source_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_shrink_source
    ADD CONSTRAINT image_shrink_source_pkey PRIMARY KEY (id);


--
-- Name: image_shrink_source image_shrink_source_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_shrink_source
    ADD CONSTRAINT image_shrink_source_url_key UNIQUE (url);


--
-- Name: item_about item_about_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_about
    ADD CONSTRAINT item_about_item_id_key UNIQUE (item_id);


--
-- Name: item_about item_about_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_about
    ADD CONSTRAINT item_about_pkey PRIMARY KEY (id);


--
-- Name: item_chapter item_chapter_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapter
    ADD CONSTRAINT item_chapter_id_text_key UNIQUE (id_text);


--
-- Name: item_chapter_location item_chapter_location_item_chapter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapter_location
    ADD CONSTRAINT item_chapter_location_item_chapter_id_key UNIQUE (item_chapter_id);


--
-- Name: item_chapter_location item_chapter_location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapter_location
    ADD CONSTRAINT item_chapter_location_pkey PRIMARY KEY (id);


--
-- Name: item_chapter item_chapter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapter
    ADD CONSTRAINT item_chapter_pkey PRIMARY KEY (id);


--
-- Name: item_chapters_feed item_chapters_feed_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_feed
    ADD CONSTRAINT item_chapters_feed_item_id_key UNIQUE (item_id);


--
-- Name: item_chapters_feed_log item_chapters_feed_log_item_chapters_feed_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_feed_log
    ADD CONSTRAINT item_chapters_feed_log_item_chapters_feed_id_key UNIQUE (item_chapters_feed_id);


--
-- Name: item_chapters_feed_log item_chapters_feed_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_feed_log
    ADD CONSTRAINT item_chapters_feed_log_pkey PRIMARY KEY (id);


--
-- Name: item_chapters_feed item_chapters_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_feed
    ADD CONSTRAINT item_chapters_feed_pkey PRIMARY KEY (id);


--
-- Name: item_chapters_object item_chapters_object_item_chapters_feed_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_object
    ADD CONSTRAINT item_chapters_object_item_chapters_feed_id_key UNIQUE (item_chapters_feed_id);


--
-- Name: item_chapters_object item_chapters_object_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_object
    ADD CONSTRAINT item_chapters_object_pkey PRIMARY KEY (id);


--
-- Name: item_chat item_chat_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chat
    ADD CONSTRAINT item_chat_item_id_key UNIQUE (item_id);


--
-- Name: item_chat item_chat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chat
    ADD CONSTRAINT item_chat_pkey PRIMARY KEY (id);


--
-- Name: item_content_link item_content_link_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_content_link
    ADD CONSTRAINT item_content_link_pkey PRIMARY KEY (id);


--
-- Name: item_description item_description_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_description
    ADD CONSTRAINT item_description_item_id_key UNIQUE (item_id);


--
-- Name: item_description item_description_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_description
    ADD CONSTRAINT item_description_pkey PRIMARY KEY (id);


--
-- Name: item_enclosure_integrity item_enclosure_integrity_item_enclosure_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_enclosure_integrity
    ADD CONSTRAINT item_enclosure_integrity_item_enclosure_id_key UNIQUE (item_enclosure_id);


--
-- Name: item_enclosure_integrity item_enclosure_integrity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_enclosure_integrity
    ADD CONSTRAINT item_enclosure_integrity_pkey PRIMARY KEY (id);


--
-- Name: item_enclosure item_enclosure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_enclosure
    ADD CONSTRAINT item_enclosure_pkey PRIMARY KEY (id);


--
-- Name: item_enclosure_source item_enclosure_source_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_enclosure_source
    ADD CONSTRAINT item_enclosure_source_pkey PRIMARY KEY (id);


--
-- Name: item_flag_status item_flag_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_flag_status
    ADD CONSTRAINT item_flag_status_pkey PRIMARY KEY (id);


--
-- Name: item_flag_status item_flag_status_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_flag_status
    ADD CONSTRAINT item_flag_status_status_key UNIQUE (status);


--
-- Name: item_funding item_funding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_funding
    ADD CONSTRAINT item_funding_pkey PRIMARY KEY (id);


--
-- Name: item item_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item
    ADD CONSTRAINT item_id_text_key UNIQUE (id_text);


--
-- Name: item_image item_image_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_image
    ADD CONSTRAINT item_image_pkey PRIMARY KEY (id);


--
-- Name: item_itunes_episode_type item_itunes_episode_type_itunes_episode_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_itunes_episode_type
    ADD CONSTRAINT item_itunes_episode_type_itunes_episode_type_key UNIQUE (itunes_episode_type);


--
-- Name: item_itunes_episode_type item_itunes_episode_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_itunes_episode_type
    ADD CONSTRAINT item_itunes_episode_type_pkey PRIMARY KEY (id);


--
-- Name: item_license item_license_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_license
    ADD CONSTRAINT item_license_item_id_key UNIQUE (item_id);


--
-- Name: item_license item_license_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_license
    ADD CONSTRAINT item_license_pkey PRIMARY KEY (id);


--
-- Name: item_location item_location_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_location
    ADD CONSTRAINT item_location_item_id_key UNIQUE (item_id);


--
-- Name: item_location item_location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_location
    ADD CONSTRAINT item_location_pkey PRIMARY KEY (id);


--
-- Name: item_merge_map item_merge_map_channel_merge_from_item_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_merge_map
    ADD CONSTRAINT item_merge_map_channel_merge_from_item_key UNIQUE (channel_merge_id, from_item_id);


--
-- Name: item_merge_map item_merge_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_merge_map
    ADD CONSTRAINT item_merge_map_pkey PRIMARY KEY (id);


--
-- Name: item_person item_person_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_person
    ADD CONSTRAINT item_person_pkey PRIMARY KEY (id);


--
-- Name: item item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item
    ADD CONSTRAINT item_pkey PRIMARY KEY (id);


--
-- Name: item_season_episode item_season_episode_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_season_episode
    ADD CONSTRAINT item_season_episode_item_id_key UNIQUE (item_id);


--
-- Name: item_season_episode item_season_episode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_season_episode
    ADD CONSTRAINT item_season_episode_pkey PRIMARY KEY (id);


--
-- Name: item_season item_season_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_season
    ADD CONSTRAINT item_season_pkey PRIMARY KEY (id);


--
-- Name: item_social_interact item_social_interact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_social_interact
    ADD CONSTRAINT item_social_interact_pkey PRIMARY KEY (id);


--
-- Name: item_soundbite item_soundbite_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_soundbite
    ADD CONSTRAINT item_soundbite_id_text_key UNIQUE (id_text);


--
-- Name: item_soundbite item_soundbite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_soundbite
    ADD CONSTRAINT item_soundbite_pkey PRIMARY KEY (id);


--
-- Name: item_transcript item_transcript_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_transcript
    ADD CONSTRAINT item_transcript_pkey PRIMARY KEY (id);


--
-- Name: item_txt item_txt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_txt
    ADD CONSTRAINT item_txt_pkey PRIMARY KEY (id);


--
-- Name: item_value item_value_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value
    ADD CONSTRAINT item_value_pkey PRIMARY KEY (id);


--
-- Name: item_value_recipient item_value_recipient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_recipient
    ADD CONSTRAINT item_value_recipient_pkey PRIMARY KEY (id);


--
-- Name: item_value_time_split item_value_time_split_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_time_split
    ADD CONSTRAINT item_value_time_split_pkey PRIMARY KEY (id);


--
-- Name: item_value_time_split_recipient item_value_time_split_recipient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_time_split_recipient
    ADD CONSTRAINT item_value_time_split_recipient_pkey PRIMARY KEY (id);


--
-- Name: item_value_time_split_remote_item item_value_time_split_remote_item_item_value_time_split_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_time_split_remote_item
    ADD CONSTRAINT item_value_time_split_remote_item_item_value_time_split_id_key UNIQUE (item_value_time_split_id);


--
-- Name: item_value_time_split_remote_item item_value_time_split_remote_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_time_split_remote_item
    ADD CONSTRAINT item_value_time_split_remote_item_pkey PRIMARY KEY (id);


--
-- Name: live_item live_item_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_item
    ADD CONSTRAINT live_item_item_id_key UNIQUE (item_id);


--
-- Name: live_item live_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_item
    ADD CONSTRAINT live_item_pkey PRIMARY KEY (id);


--
-- Name: live_item_status live_item_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_item_status
    ADD CONSTRAINT live_item_status_pkey PRIMARY KEY (id);


--
-- Name: live_item_status live_item_status_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_item_status
    ADD CONSTRAINT live_item_status_status_key UNIQUE (status);


--
-- Name: medium medium_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medium
    ADD CONSTRAINT medium_pkey PRIMARY KEY (id);


--
-- Name: medium medium_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medium
    ADD CONSTRAINT medium_value_key UNIQUE (value);


--
-- Name: membership_claim_token membership_claim_token_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_claim_token
    ADD CONSTRAINT membership_claim_token_pkey PRIMARY KEY (id);


--
-- Name: on_demand_parser_event on_demand_parser_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.on_demand_parser_event
    ADD CONSTRAINT on_demand_parser_event_pkey PRIMARY KEY (id);


--
-- Name: playlist playlist_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist
    ADD CONSTRAINT playlist_id_text_key UNIQUE (id_text);


--
-- Name: playlist playlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist
    ADD CONSTRAINT playlist_pkey PRIMARY KEY (id);


--
-- Name: playlist_resource playlist_resource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource
    ADD CONSTRAINT playlist_resource_pkey PRIMARY KEY (id);


--
-- Name: playlist_resource playlist_resource_playlist_id_add_by_rss_hash_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource
    ADD CONSTRAINT playlist_resource_playlist_id_add_by_rss_hash_id_key UNIQUE (playlist_id, add_by_rss_hash_id);


--
-- Name: playlist_resource playlist_resource_playlist_id_clip_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource
    ADD CONSTRAINT playlist_resource_playlist_id_clip_id_key UNIQUE (playlist_id, clip_id);


--
-- Name: playlist_resource playlist_resource_playlist_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource
    ADD CONSTRAINT playlist_resource_playlist_id_item_id_key UNIQUE (playlist_id, item_id);


--
-- Name: playlist_resource playlist_resource_playlist_id_item_soundbite_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource
    ADD CONSTRAINT playlist_resource_playlist_id_item_soundbite_id_key UNIQUE (playlist_id, item_soundbite_id);


--
-- Name: playlist_resource playlist_resource_playlist_id_list_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource
    ADD CONSTRAINT playlist_resource_playlist_id_list_position_key UNIQUE (playlist_id, list_position);


--
-- Name: podcast_index_dead_feed_sync podcast_index_dead_feed_sync_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.podcast_index_dead_feed_sync
    ADD CONSTRAINT podcast_index_dead_feed_sync_pkey PRIMARY KEY (id);


--
-- Name: product_membership_settings product_membership_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_membership_settings
    ADD CONSTRAINT product_membership_settings_pkey PRIMARY KEY (id);


--
-- Name: queue queue_account_id_medium_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue
    ADD CONSTRAINT queue_account_id_medium_id_key UNIQUE (account_id, medium_id);


--
-- Name: queue queue_id_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue
    ADD CONSTRAINT queue_id_text_key UNIQUE (id_text);


--
-- Name: queue queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue
    ADD CONSTRAINT queue_pkey PRIMARY KEY (id);


--
-- Name: queue_resource queue_resource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource
    ADD CONSTRAINT queue_resource_pkey PRIMARY KEY (id);


--
-- Name: queue_resource queue_resource_queue_id_add_by_rss_hash_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource
    ADD CONSTRAINT queue_resource_queue_id_add_by_rss_hash_id_key UNIQUE (queue_id, add_by_rss_hash_id);


--
-- Name: queue_resource queue_resource_queue_id_clip_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource
    ADD CONSTRAINT queue_resource_queue_id_clip_id_key UNIQUE (queue_id, clip_id);


--
-- Name: queue_resource queue_resource_queue_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource
    ADD CONSTRAINT queue_resource_queue_id_item_id_key UNIQUE (queue_id, item_id);


--
-- Name: queue_resource queue_resource_queue_id_item_soundbite_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource
    ADD CONSTRAINT queue_resource_queue_id_item_soundbite_id_key UNIQUE (queue_id, item_soundbite_id);


--
-- Name: queue_resource queue_resource_queue_id_list_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource
    ADD CONSTRAINT queue_resource_queue_id_list_position_key UNIQUE (queue_id, list_position);


--
-- Name: scheduled_job scheduled_job_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_job
    ADD CONSTRAINT scheduled_job_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: scheduled_job scheduled_job_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_job
    ADD CONSTRAINT scheduled_job_pkey PRIMARY KEY (id);


--
-- Name: sharable_status sharable_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sharable_status
    ADD CONSTRAINT sharable_status_pkey PRIMARY KEY (id);


--
-- Name: sharable_status sharable_status_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sharable_status
    ADD CONSTRAINT sharable_status_status_key UNIQUE (status);


--
-- Name: stats_daily_account stats_daily_account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily_account
    ADD CONSTRAINT stats_daily_account_pkey PRIMARY KEY (account_id, day);


--
-- Name: stats_daily_channel stats_daily_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily_channel
    ADD CONSTRAINT stats_daily_channel_pkey PRIMARY KEY (channel_id, day);


--
-- Name: stats_daily_clip stats_daily_clip_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily_clip
    ADD CONSTRAINT stats_daily_clip_pkey PRIMARY KEY (clip_id, day);


--
-- Name: stats_daily_item stats_daily_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily_item
    ADD CONSTRAINT stats_daily_item_pkey PRIMARY KEY (item_id, day);


--
-- Name: stats_daily_playlist stats_daily_playlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily_playlist
    ADD CONSTRAINT stats_daily_playlist_pkey PRIMARY KEY (playlist_id, day);


--
-- Name: stats_flag_signal stats_flag_signal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_flag_signal
    ADD CONSTRAINT stats_flag_signal_pkey PRIMARY KEY (listener_id);


--
-- Name: stats_flagged_listener stats_flagged_listener_listener_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_flagged_listener
    ADD CONSTRAINT stats_flagged_listener_listener_id_key UNIQUE (listener_id);


--
-- Name: stats_flagged_listener stats_flagged_listener_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_flagged_listener
    ADD CONSTRAINT stats_flagged_listener_pkey PRIMARY KEY (id);


--
-- Name: stats_listen_event stats_listen_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_listen_event
    ADD CONSTRAINT stats_listen_event_pkey PRIMARY KEY (created_at, id);


--
-- Name: stats_listen_event_default stats_listen_event_default_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_listen_event_default
    ADD CONSTRAINT stats_listen_event_default_pkey PRIMARY KEY (created_at, id);


--
-- Name: stats_open_event stats_open_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_open_event
    ADD CONSTRAINT stats_open_event_pkey PRIMARY KEY (created_at, id);


--
-- Name: stats_open_event_default stats_open_event_default_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_open_event_default
    ADD CONSTRAINT stats_open_event_default_pkey PRIMARY KEY (created_at, id);


--
-- Name: stats_popularity_account stats_popularity_account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_popularity_account
    ADD CONSTRAINT stats_popularity_account_pkey PRIMARY KEY (account_id);


--
-- Name: stats_popularity_channel stats_popularity_channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_popularity_channel
    ADD CONSTRAINT stats_popularity_channel_pkey PRIMARY KEY (channel_id);


--
-- Name: stats_popularity_clip stats_popularity_clip_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_popularity_clip
    ADD CONSTRAINT stats_popularity_clip_pkey PRIMARY KEY (clip_id);


--
-- Name: stats_popularity_item stats_popularity_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_popularity_item
    ADD CONSTRAINT stats_popularity_item_pkey PRIMARY KEY (item_id);


--
-- Name: stats_popularity_playlist stats_popularity_playlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_popularity_playlist
    ADD CONSTRAINT stats_popularity_playlist_pkey PRIMARY KEY (playlist_id);


--
-- Name: stats_taste_profile_hidden stats_taste_profile_hidden_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_taste_profile_hidden
    ADD CONSTRAINT stats_taste_profile_hidden_pkey PRIMARY KEY (listener_id, channel_id);


--
-- Name: stats_taste_profile stats_taste_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_taste_profile
    ADD CONSTRAINT stats_taste_profile_pkey PRIMARY KEY (listener_id, channel_id);


--
-- Name: account_api_key_account_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_api_key_account_created_idx ON public.account_api_key USING btree (account_id, created_at DESC);


--
-- Name: account_content_log_account_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_content_log_account_updated_idx ON public.account_content_log USING btree (account_id, updated_at DESC);


--
-- Name: account_content_log_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_content_log_updated_at_idx ON public.account_content_log USING btree (updated_at);


--
-- Name: account_session_account_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_session_account_active_idx ON public.account_session USING btree (account_id, last_seen_at DESC) WHERE (revoked_at IS NULL);


--
-- Name: account_session_idle_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_session_idle_expires_at_idx ON public.account_session USING btree (idle_expires_at);


--
-- Name: channel_podcast_guid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX channel_podcast_guid_unique ON public.channel USING btree (podcast_guid) WHERE (podcast_guid IS NOT NULL);


--
-- Name: channel_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX channel_slug ON public.channel USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: feed_description_truncated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_description_truncated_idx ON public.feed USING btree (description_longest_source_length DESC) WHERE (description_truncated_count > 0);


--
-- Name: idx_account_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_created_at ON public.account USING btree (created_at DESC);


--
-- Name: idx_account_credentials_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_credentials_account_id ON public.account_credentials USING btree (account_id);


--
-- Name: idx_account_device_auto_download_channel_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_device_auto_download_channel_channel ON public.account_device_auto_download_channel USING btree (channel_id);


--
-- Name: idx_account_device_auto_download_channel_install; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_device_auto_download_channel_install ON public.account_device_auto_download_channel USING btree (account_id, installation_id);


--
-- Name: idx_account_email_change_verification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_email_change_verification_id ON public.account_email_change_verification USING btree (account_id);


--
-- Name: idx_account_fcm_device_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_fcm_device_account_id ON public.account_fcm_device USING btree (account_id);


--
-- Name: idx_account_fcm_device_fcm_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_fcm_device_fcm_token ON public.account_fcm_device USING btree (fcm_token);


--
-- Name: idx_account_fcm_device_installation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_fcm_device_installation_id ON public.account_fcm_device USING btree (installation_id);


--
-- Name: idx_account_fcm_device_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_fcm_device_platform ON public.account_fcm_device USING btree (platform);


--
-- Name: idx_account_following_account_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_following_account_account_id ON public.account_following_account USING btree (account_id);


--
-- Name: idx_account_following_account_following_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_following_account_following_account_id ON public.account_following_account USING btree (following_account_id);


--
-- Name: idx_account_following_add_by_rss_channel_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_following_add_by_rss_channel_account_id ON public.account_following_add_by_rss_channel USING btree (account_id);


--
-- Name: idx_account_following_channel_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_following_channel_account_id ON public.account_following_channel USING btree (account_id);


--
-- Name: idx_account_following_channel_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_following_channel_channel_id ON public.account_following_channel USING btree (channel_id);


--
-- Name: idx_account_following_playlist_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_following_playlist_account_id ON public.account_following_playlist USING btree (account_id);


--
-- Name: idx_account_following_playlist_playlist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_following_playlist_playlist_id ON public.account_following_playlist USING btree (playlist_id);


--
-- Name: idx_account_membership_status_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_membership_status_account_id ON public.account_membership_status USING btree (account_id);


--
-- Name: idx_account_membership_status_account_membership_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_membership_status_account_membership_id ON public.account_membership_status USING btree (account_membership_id);


--
-- Name: idx_account_metaboost_sender_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_metaboost_sender_guid ON public.account_metaboost USING btree (sender_guid);


--
-- Name: idx_account_notification_account_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_notification_account_id_created_at ON public.account_notification USING btree (account_id, created_at DESC);


--
-- Name: idx_account_notification_channel_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_notification_channel_account_id ON public.account_notification_channel USING btree (account_id);


--
-- Name: idx_account_notification_channel_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_notification_channel_channel_id ON public.account_notification_channel USING btree (channel_id);


--
-- Name: idx_account_notification_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_notification_expires_at ON public.account_notification USING btree (expires_at);


--
-- Name: idx_account_notification_preference_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_notification_preference_account_id ON public.account_notification_preference USING btree (account_id);


--
-- Name: idx_account_pending_following_channel_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_pending_following_channel_account_id ON public.account_pending_following_channel USING btree (account_id);


--
-- Name: idx_account_pending_following_channel_podcast_index_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_pending_following_channel_podcast_index_id ON public.account_pending_following_channel USING btree (podcast_index_id);


--
-- Name: idx_account_profile_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_profile_account_id ON public.account_profile USING btree (account_id);


--
-- Name: idx_account_reset_password_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_reset_password_account_id ON public.account_reset_password USING btree (account_id);


--
-- Name: idx_account_set_password_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_set_password_account_id ON public.account_set_password USING btree (account_id);


--
-- Name: idx_account_sharable_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_sharable_status_id ON public.account USING btree (sharable_status_id);


--
-- Name: idx_account_terms_acceptance_terms_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_terms_acceptance_terms_version ON public.account_terms_acceptance USING btree (terms_version);


--
-- Name: idx_account_up_device_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_up_device_account_id ON public.account_up_device USING btree (account_id);


--
-- Name: idx_account_up_device_up_endpoint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_up_device_up_endpoint ON public.account_up_device USING btree (up_endpoint);


--
-- Name: idx_account_verification_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_verification_account_id ON public.account_verification USING btree (account_id);


--
-- Name: idx_account_webpush_device_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_webpush_device_account_id ON public.account_webpush_device USING btree (account_id);


--
-- Name: idx_account_webpush_device_endpoint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_webpush_device_endpoint ON public.account_webpush_device USING btree (endpoint);


--
-- Name: idx_admin_notification_campaign_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notification_campaign_category ON public.admin_notification_campaign USING btree (category);


--
-- Name: idx_admin_notification_campaign_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notification_campaign_created_at ON public.admin_notification_campaign USING btree (created_at DESC);


--
-- Name: idx_admin_notification_campaign_status_scheduled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notification_campaign_status_scheduled_at ON public.admin_notification_campaign USING btree (status, scheduled_at);


--
-- Name: idx_billing_checkout_session_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_checkout_session_account_id ON public.billing_checkout_session USING btree (account_id);


--
-- Name: idx_billing_checkout_session_unsettled_processor_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_checkout_session_unsettled_processor_created_at ON public.billing_checkout_session USING btree (processor_id, created_at) WHERE (settled_at IS NULL);


--
-- Name: idx_billing_membership_grant_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_membership_grant_account_id ON public.billing_membership_grant USING btree (account_id);


--
-- Name: idx_billing_price_effective_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_price_effective_lookup ON public.billing_price USING btree (billing_product_id, billing_cadence, currency_code, effective_from DESC);


--
-- Name: idx_billing_transaction_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_transaction_account_id ON public.billing_transaction USING btree (account_id);


--
-- Name: idx_billing_webhook_event_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_webhook_event_unprocessed ON public.billing_webhook_event USING btree (received_at) WHERE (status <> 'processed'::text);


--
-- Name: idx_category_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_parent_id ON public.category USING btree (parent_id);


--
-- Name: idx_channel_about_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_about_channel_id ON public.channel_about USING btree (channel_id);


--
-- Name: idx_channel_about_itunes_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_about_itunes_type_id ON public.channel_about USING btree (itunes_type_id);


--
-- Name: idx_channel_about_last_pub_date_desc_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_about_last_pub_date_desc_channel_id ON public.channel_about USING btree (last_pub_date DESC, channel_id);


--
-- Name: idx_channel_category_category_id_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_category_category_id_channel_id ON public.channel_category USING btree (category_id, channel_id);


--
-- Name: idx_channel_category_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_category_channel_id ON public.channel_category USING btree (channel_id);


--
-- Name: idx_channel_chat_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_chat_channel_id ON public.channel_chat USING btree (channel_id);


--
-- Name: idx_channel_description_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_description_channel_id ON public.channel_description USING btree (channel_id);


--
-- Name: idx_channel_feed_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_feed_id ON public.channel USING btree (feed_id);


--
-- Name: idx_channel_funding_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_funding_channel_id ON public.channel_funding USING btree (channel_id);


--
-- Name: idx_channel_image_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_image_channel_id ON public.channel_image USING btree (channel_id);


--
-- Name: idx_channel_internal_settings_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_internal_settings_channel_id ON public.channel_internal_settings USING btree (channel_id);


--
-- Name: idx_channel_license_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_license_channel_id ON public.channel_license USING btree (channel_id);


--
-- Name: idx_channel_location_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_location_channel_id ON public.channel_location USING btree (channel_id);


--
-- Name: idx_channel_medium_id_sortable_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_medium_id_sortable_title ON public.channel USING btree (medium_id, sortable_title);


--
-- Name: idx_channel_merge_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_merge_status ON public.channel_merge USING btree (status);


--
-- Name: idx_channel_merge_to_podcast_index_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_merge_to_podcast_index_id ON public.channel_merge USING btree (to_podcast_index_id);


--
-- Name: idx_channel_person_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_person_channel_id ON public.channel_person USING btree (channel_id);


--
-- Name: idx_channel_podroll_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_podroll_channel_id ON public.channel_podroll USING btree (channel_id);


--
-- Name: idx_channel_podroll_remote_item_channel_podroll_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_podroll_remote_item_channel_podroll_id ON public.channel_podroll_remote_item USING btree (channel_podroll_id);


--
-- Name: idx_channel_podroll_remote_item_feed_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_podroll_remote_item_feed_guid ON public.channel_podroll_remote_item USING btree (feed_guid);


--
-- Name: idx_channel_podroll_remote_item_feed_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_podroll_remote_item_feed_url ON public.channel_podroll_remote_item USING btree (feed_url);


--
-- Name: idx_channel_podroll_remote_item_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_podroll_remote_item_item_guid ON public.channel_podroll_remote_item USING btree (item_guid);


--
-- Name: idx_channel_podroll_remote_item_medium_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_podroll_remote_item_medium_id ON public.channel_podroll_remote_item USING btree (medium_id);


--
-- Name: idx_channel_publisher_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_publisher_channel_id ON public.channel_publisher USING btree (channel_id);


--
-- Name: idx_channel_publisher_remote_item_channel_publisher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_publisher_remote_item_channel_publisher_id ON public.channel_publisher_remote_item USING btree (channel_publisher_id);


--
-- Name: idx_channel_publisher_remote_item_feed_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_publisher_remote_item_feed_guid ON public.channel_publisher_remote_item USING btree (feed_guid);


--
-- Name: idx_channel_publisher_remote_item_feed_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_publisher_remote_item_feed_url ON public.channel_publisher_remote_item USING btree (feed_url);


--
-- Name: idx_channel_publisher_remote_item_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_publisher_remote_item_item_guid ON public.channel_publisher_remote_item USING btree (item_guid);


--
-- Name: idx_channel_publisher_remote_item_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_publisher_remote_item_item_id ON public.channel_publisher_remote_item USING btree (item_id) WHERE (item_id IS NOT NULL);


--
-- Name: idx_channel_publisher_remote_item_medium_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_publisher_remote_item_medium_id ON public.channel_publisher_remote_item USING btree (medium_id);


--
-- Name: idx_channel_remote_item_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_remote_item_channel_id ON public.channel_remote_item USING btree (channel_id);


--
-- Name: idx_channel_remote_item_feed_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_remote_item_feed_guid ON public.channel_remote_item USING btree (feed_guid);


--
-- Name: idx_channel_remote_item_feed_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_remote_item_feed_url ON public.channel_remote_item USING btree (feed_url);


--
-- Name: idx_channel_remote_item_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_remote_item_item_guid ON public.channel_remote_item USING btree (item_guid);


--
-- Name: idx_channel_remote_item_medium_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_remote_item_medium_id ON public.channel_remote_item USING btree (medium_id);


--
-- Name: idx_channel_season_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_season_channel_id ON public.channel_season USING btree (channel_id);


--
-- Name: idx_channel_social_interact_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_social_interact_channel_id ON public.channel_social_interact USING btree (channel_id);


--
-- Name: idx_channel_trailer_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_trailer_channel_id ON public.channel_trailer USING btree (channel_id);


--
-- Name: idx_channel_trailer_channel_season_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_trailer_channel_season_id ON public.channel_trailer USING btree (channel_season_id);


--
-- Name: idx_channel_txt_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_txt_channel_id ON public.channel_txt USING btree (channel_id);


--
-- Name: idx_channel_value_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_value_channel_id ON public.channel_value USING btree (channel_id);


--
-- Name: idx_channel_value_recipient_channel_value_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_value_recipient_channel_value_id ON public.channel_value_recipient USING btree (channel_value_id);


--
-- Name: idx_channel_verified_publisher_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_verified_publisher_item_id ON public.channel_verified_publisher USING btree (item_id) WHERE (item_id IS NOT NULL);


--
-- Name: idx_channel_verified_publisher_publisher_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_verified_publisher_publisher_channel_id ON public.channel_verified_publisher USING btree (publisher_channel_id);


--
-- Name: idx_clip_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clip_account_id ON public.clip USING btree (account_id);


--
-- Name: idx_clip_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clip_created_at ON public.clip USING btree (created_at);


--
-- Name: idx_clip_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clip_item_id ON public.clip USING btree (item_id);


--
-- Name: idx_clip_sharable_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clip_sharable_status_id ON public.clip USING btree (sharable_status_id);


--
-- Name: idx_feed_condition_feed_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_condition_feed_id ON public.feed_condition USING btree (feed_id);


--
-- Name: idx_feed_condition_feed_id_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_condition_feed_id_active ON public.feed_condition USING btree (feed_id) WHERE (is_active = true);


--
-- Name: idx_feed_condition_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_condition_is_active ON public.feed_condition USING btree (is_active);


--
-- Name: idx_feed_condition_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_condition_type_id ON public.feed_condition USING btree (feed_condition_type_id);


--
-- Name: idx_feed_lifecycle_event_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_lifecycle_event_created_at ON public.feed_lifecycle_event USING btree (created_at);


--
-- Name: idx_feed_lifecycle_event_feed_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_lifecycle_event_feed_id ON public.feed_lifecycle_event USING btree (feed_id);


--
-- Name: idx_feed_lifecycle_state_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_lifecycle_state_type_id ON public.feed_lifecycle_state USING btree (feed_lifecycle_state_type_id);


--
-- Name: idx_feed_log_feed_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_log_feed_id ON public.feed_log USING btree (feed_id);


--
-- Name: idx_feed_policy_primary_block_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feed_policy_primary_block_reason ON public.feed_policy USING btree (primary_block_reason) WHERE (primary_block_reason IS NOT NULL);


--
-- Name: idx_image_shrink_source_last_checked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_image_shrink_source_last_checked_at ON public.image_shrink_source USING btree (last_checked_at DESC);


--
-- Name: idx_image_shrink_source_last_deep_checked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_image_shrink_source_last_deep_checked_at ON public.image_shrink_source USING btree (last_deep_checked_at DESC);


--
-- Name: idx_item_about_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_about_item_id ON public.item_about USING btree (item_id);


--
-- Name: idx_item_about_item_itunes_episode_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_about_item_itunes_episode_type_id ON public.item_about USING btree (item_itunes_episode_type_id);


--
-- Name: idx_item_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_channel_id ON public.item USING btree (channel_id);


--
-- Name: idx_item_channel_id_pub_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_channel_id_pub_date ON public.item USING btree (channel_id, pub_date DESC);


--
-- Name: idx_item_chapter_item_chapters_object_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_chapter_item_chapters_object_id ON public.item_chapter USING btree (item_chapters_object_id);


--
-- Name: idx_item_chapter_location_item_chapter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_chapter_location_item_chapter_id ON public.item_chapter_location USING btree (item_chapter_id);


--
-- Name: idx_item_chapters_feed_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_chapters_feed_item_id ON public.item_chapters_feed USING btree (item_id);


--
-- Name: idx_item_chapters_feed_log_item_chapters_feed_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_chapters_feed_log_item_chapters_feed_id ON public.item_chapters_feed_log USING btree (item_chapters_feed_id);


--
-- Name: idx_item_chapters_object_item_chapters_feed_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_chapters_object_item_chapters_feed_id ON public.item_chapters_object USING btree (item_chapters_feed_id);


--
-- Name: idx_item_chat_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_chat_item_id ON public.item_chat USING btree (item_id);


--
-- Name: idx_item_content_link_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_content_link_item_id ON public.item_content_link USING btree (item_id);


--
-- Name: idx_item_description_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_description_item_id ON public.item_description USING btree (item_id);


--
-- Name: idx_item_enclosure_integrity_item_enclosure_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_enclosure_integrity_item_enclosure_id ON public.item_enclosure_integrity USING btree (item_enclosure_id);


--
-- Name: idx_item_enclosure_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_enclosure_item_id ON public.item_enclosure USING btree (item_id);


--
-- Name: idx_item_enclosure_source_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_enclosure_source_item_id ON public.item_enclosure_source USING btree (item_enclosure_id);


--
-- Name: idx_item_funding_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_funding_item_id ON public.item_funding USING btree (item_id);


--
-- Name: idx_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_guid ON public.item USING btree (guid);


--
-- Name: idx_item_guid_enclosure_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_guid_enclosure_url ON public.item USING btree (guid_enclosure_url);


--
-- Name: idx_item_image_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_image_item_id ON public.item_image USING btree (item_id);


--
-- Name: idx_item_item_flag_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_item_flag_status_id ON public.item USING btree (item_flag_status_id);


--
-- Name: idx_item_license_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_license_item_id ON public.item_license USING btree (item_id);


--
-- Name: idx_item_location_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_location_item_id ON public.item_location USING btree (item_id);


--
-- Name: idx_item_person_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_person_item_id ON public.item_person USING btree (item_id);


--
-- Name: idx_item_pub_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_pub_date ON public.item USING btree (pub_date);


--
-- Name: idx_item_season_channel_season_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_season_channel_season_id ON public.item_season USING btree (channel_season_id);


--
-- Name: idx_item_season_episode_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_season_episode_item_id ON public.item_season_episode USING btree (item_id);


--
-- Name: idx_item_season_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_season_item_id ON public.item_season USING btree (item_id);


--
-- Name: idx_item_social_interact_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_social_interact_item_id ON public.item_social_interact USING btree (item_id);


--
-- Name: idx_item_soundbite_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_soundbite_item_id ON public.item_soundbite USING btree (item_id);


--
-- Name: idx_item_transcript_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_transcript_item_id ON public.item_transcript USING btree (item_id);


--
-- Name: idx_item_txt_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_txt_item_id ON public.item_txt USING btree (item_id);


--
-- Name: idx_item_value_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_value_item_id ON public.item_value USING btree (item_id);


--
-- Name: idx_item_value_recipient_item_value_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_value_recipient_item_value_id ON public.item_value_recipient USING btree (item_value_id);


--
-- Name: idx_item_value_time_split_item_value_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_value_time_split_item_value_id ON public.item_value_time_split USING btree (item_value_id);


--
-- Name: idx_item_value_time_split_recipient_item_value_time_split_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_value_time_split_recipient_item_value_time_split_id ON public.item_value_time_split_recipient USING btree (item_value_time_split_id);


--
-- Name: idx_item_value_time_split_remote_item_feed_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_value_time_split_remote_item_feed_guid ON public.item_value_time_split_remote_item USING btree (feed_guid);


--
-- Name: idx_item_value_time_split_remote_item_feed_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_value_time_split_remote_item_feed_url ON public.item_value_time_split_remote_item USING btree (feed_url);


--
-- Name: idx_item_value_time_split_remote_item_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_value_time_split_remote_item_item_guid ON public.item_value_time_split_remote_item USING btree (item_guid);


--
-- Name: idx_item_value_time_split_remote_item_item_value_time_split_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_value_time_split_remote_item_item_value_time_split_id ON public.item_value_time_split_remote_item USING btree (item_value_time_split_id);


--
-- Name: idx_live_item_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_item_item_id ON public.live_item USING btree (item_id);


--
-- Name: idx_live_item_live_item_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_item_live_item_status_id ON public.live_item USING btree (live_item_status_id);


--
-- Name: idx_membership_claim_token_account_membership_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membership_claim_token_account_membership_id ON public.membership_claim_token USING btree (account_membership_id);


--
-- Name: idx_on_demand_parser_event_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_on_demand_parser_event_account_id ON public.on_demand_parser_event USING btree (account_id);


--
-- Name: idx_on_demand_parser_event_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_on_demand_parser_event_created_at ON public.on_demand_parser_event USING btree (created_at DESC);


--
-- Name: idx_on_demand_parser_event_podcast_index_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_on_demand_parser_event_podcast_index_id ON public.on_demand_parser_event USING btree (podcast_index_id);


--
-- Name: idx_on_demand_parser_event_remote_parent_podcast_index_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_on_demand_parser_event_remote_parent_podcast_index_id ON public.on_demand_parser_event USING btree (remote_parent_podcast_index_id);


--
-- Name: idx_on_demand_parser_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_on_demand_parser_event_type ON public.on_demand_parser_event USING btree (type);


--
-- Name: idx_playlist_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_account_id ON public.playlist USING btree (account_id);


--
-- Name: idx_playlist_account_medium_default_likes; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_playlist_account_medium_default_likes ON public.playlist USING btree (account_id, medium_id) WHERE (is_default_likes = true);


--
-- Name: idx_playlist_last_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_last_updated ON public.playlist USING btree (last_updated);


--
-- Name: idx_playlist_medium_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_medium_id ON public.playlist USING btree (medium_id);


--
-- Name: idx_playlist_resource_clip_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_resource_clip_id ON public.playlist_resource USING btree (clip_id);


--
-- Name: idx_playlist_resource_hash_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_resource_hash_id ON public.playlist_resource USING btree (add_by_rss_hash_id);


--
-- Name: idx_playlist_resource_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_resource_item_id ON public.playlist_resource USING btree (item_id);


--
-- Name: idx_playlist_resource_playlist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_resource_playlist_id ON public.playlist_resource USING btree (playlist_id);


--
-- Name: idx_playlist_resource_soundbite_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_resource_soundbite_id ON public.playlist_resource USING btree (item_soundbite_id);


--
-- Name: idx_playlist_sharable_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_sharable_status_id ON public.playlist USING btree (sharable_status_id);


--
-- Name: idx_queue_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_account_id ON public.queue USING btree (account_id);


--
-- Name: idx_queue_medium_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_medium_id ON public.queue USING btree (medium_id);


--
-- Name: idx_queue_resource_add_by_rss_hash_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_resource_add_by_rss_hash_id ON public.queue_resource USING btree (add_by_rss_hash_id);


--
-- Name: idx_queue_resource_clip_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_resource_clip_id ON public.queue_resource USING btree (clip_id);


--
-- Name: idx_queue_resource_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_resource_item_id ON public.queue_resource USING btree (item_id);


--
-- Name: idx_queue_resource_queue_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_resource_queue_id ON public.queue_resource USING btree (queue_id);


--
-- Name: idx_queue_resource_queue_id_last_played_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_resource_queue_id_last_played_at ON public.queue_resource USING btree (queue_id, last_played_at DESC);


--
-- Name: idx_queue_resource_soundbite_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_resource_soundbite_id ON public.queue_resource USING btree (item_soundbite_id);


--
-- Name: idx_scheduled_job_status_run_after; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_job_status_run_after ON public.scheduled_job USING btree (status, run_after) WHERE ((status)::text = 'pending'::text);


--
-- Name: item_archived_unslimmed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX item_archived_unslimmed_idx ON public.item USING btree (id) WHERE ((item_flag_status_id = 3) AND (archived_slimmed_at IS NULL));


--
-- Name: item_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX item_slug ON public.item USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: stats_daily_account_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_daily_account_day_idx ON public.stats_daily_account USING btree (day, account_id) INCLUDE (listener_count);


--
-- Name: stats_daily_channel_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_daily_channel_day_idx ON public.stats_daily_channel USING btree (day, channel_id) INCLUDE (listener_count);


--
-- Name: stats_daily_clip_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_daily_clip_day_idx ON public.stats_daily_clip USING btree (day, clip_id) INCLUDE (listener_count);


--
-- Name: stats_daily_item_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_daily_item_day_idx ON public.stats_daily_item USING btree (day, item_id) INCLUDE (listener_count);


--
-- Name: stats_daily_playlist_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_daily_playlist_day_idx ON public.stats_daily_playlist USING btree (day, playlist_id) INCLUDE (listener_count);


--
-- Name: stats_listen_event_channel_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_listen_event_channel_id_idx ON ONLY public.stats_listen_event USING btree (channel_id);


--
-- Name: stats_listen_event_clip_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_listen_event_clip_id_idx ON ONLY public.stats_listen_event USING btree (clip_id) WHERE (clip_id IS NOT NULL);


--
-- Name: stats_listen_event_default_channel_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_listen_event_default_channel_id_idx ON public.stats_listen_event_default USING btree (channel_id);


--
-- Name: stats_listen_event_default_clip_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_listen_event_default_clip_id_idx ON public.stats_listen_event_default USING btree (clip_id) WHERE (clip_id IS NOT NULL);


--
-- Name: stats_listen_event_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_listen_event_item_id_idx ON ONLY public.stats_listen_event USING btree (item_id);


--
-- Name: stats_listen_event_default_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_listen_event_default_item_id_idx ON public.stats_listen_event_default USING btree (item_id);


--
-- Name: stats_listen_event_listener_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_listen_event_listener_created_idx ON ONLY public.stats_listen_event USING btree (listener_id, created_at);


--
-- Name: stats_listen_event_default_listener_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_listen_event_default_listener_id_created_at_idx ON public.stats_listen_event_default USING btree (listener_id, created_at);


--
-- Name: stats_open_event_account_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_open_event_account_id_idx ON ONLY public.stats_open_event USING btree (account_id) WHERE (account_id IS NOT NULL);


--
-- Name: stats_open_event_default_account_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_open_event_default_account_id_idx ON public.stats_open_event_default USING btree (account_id) WHERE (account_id IS NOT NULL);


--
-- Name: stats_open_event_listener_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_open_event_listener_created_idx ON ONLY public.stats_open_event USING btree (listener_id, created_at);


--
-- Name: stats_open_event_default_listener_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_open_event_default_listener_id_created_at_idx ON public.stats_open_event_default USING btree (listener_id, created_at);


--
-- Name: stats_open_event_playlist_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_open_event_playlist_id_idx ON ONLY public.stats_open_event USING btree (playlist_id) WHERE (playlist_id IS NOT NULL);


--
-- Name: stats_open_event_default_playlist_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_open_event_default_playlist_id_idx ON public.stats_open_event_default USING btree (playlist_id) WHERE (playlist_id IS NOT NULL);


--
-- Name: stats_popularity_account_all_time_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_account_all_time_count_idx ON public.stats_popularity_account USING btree (all_time_count DESC, account_id);


--
-- Name: stats_popularity_account_day_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_account_day_count_idx ON public.stats_popularity_account USING btree (day_count DESC, account_id);


--
-- Name: stats_popularity_account_month_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_account_month_count_idx ON public.stats_popularity_account USING btree (month_count DESC, account_id);


--
-- Name: stats_popularity_account_week_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_account_week_count_idx ON public.stats_popularity_account USING btree (week_count DESC, account_id);


--
-- Name: stats_popularity_channel_all_time_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_channel_all_time_count_idx ON public.stats_popularity_channel USING btree (all_time_count DESC, channel_id);


--
-- Name: stats_popularity_channel_day_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_channel_day_count_idx ON public.stats_popularity_channel USING btree (day_count DESC, channel_id);


--
-- Name: stats_popularity_channel_month_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_channel_month_count_idx ON public.stats_popularity_channel USING btree (month_count DESC, channel_id);


--
-- Name: stats_popularity_channel_week_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_channel_week_count_idx ON public.stats_popularity_channel USING btree (week_count DESC, channel_id);


--
-- Name: stats_popularity_clip_all_time_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_clip_all_time_count_idx ON public.stats_popularity_clip USING btree (all_time_count DESC, clip_id);


--
-- Name: stats_popularity_clip_day_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_clip_day_count_idx ON public.stats_popularity_clip USING btree (day_count DESC, clip_id);


--
-- Name: stats_popularity_clip_month_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_clip_month_count_idx ON public.stats_popularity_clip USING btree (month_count DESC, clip_id);


--
-- Name: stats_popularity_clip_week_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_clip_week_count_idx ON public.stats_popularity_clip USING btree (week_count DESC, clip_id);


--
-- Name: stats_popularity_item_all_time_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_item_all_time_count_idx ON public.stats_popularity_item USING btree (all_time_count DESC, item_id);


--
-- Name: stats_popularity_item_day_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_item_day_count_idx ON public.stats_popularity_item USING btree (day_count DESC, item_id);


--
-- Name: stats_popularity_item_month_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_item_month_count_idx ON public.stats_popularity_item USING btree (month_count DESC, item_id);


--
-- Name: stats_popularity_item_week_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_item_week_count_idx ON public.stats_popularity_item USING btree (week_count DESC, item_id);


--
-- Name: stats_popularity_playlist_all_time_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_playlist_all_time_count_idx ON public.stats_popularity_playlist USING btree (all_time_count DESC, playlist_id);


--
-- Name: stats_popularity_playlist_day_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_playlist_day_count_idx ON public.stats_popularity_playlist USING btree (day_count DESC, playlist_id);


--
-- Name: stats_popularity_playlist_month_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_playlist_month_count_idx ON public.stats_popularity_playlist USING btree (month_count DESC, playlist_id);


--
-- Name: stats_popularity_playlist_week_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_popularity_playlist_week_count_idx ON public.stats_popularity_playlist USING btree (week_count DESC, playlist_id);


--
-- Name: stats_taste_profile_channel_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_taste_profile_channel_id_idx ON public.stats_taste_profile USING btree (channel_id);


--
-- Name: stats_taste_profile_hidden_channel_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stats_taste_profile_hidden_channel_id_idx ON public.stats_taste_profile_hidden USING btree (channel_id);


--
-- Name: uq_billing_price_open_window; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_billing_price_open_window ON public.billing_price USING btree (billing_product_id, currency_code, billing_cadence) WHERE (effective_to IS NULL);


--
-- Name: uq_channel_podroll_remote_item_feed_guid_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_channel_podroll_remote_item_feed_guid_item_guid ON public.channel_podroll_remote_item USING btree (channel_podroll_id, feed_guid, item_guid) WHERE (item_guid IS NOT NULL);


--
-- Name: uq_channel_podroll_remote_item_feed_guid_no_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_channel_podroll_remote_item_feed_guid_no_item_guid ON public.channel_podroll_remote_item USING btree (channel_podroll_id, feed_guid) WHERE (item_guid IS NULL);


--
-- Name: uq_channel_publisher_remote_item_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_channel_publisher_remote_item_claim ON public.channel_publisher_remote_item USING btree (channel_publisher_id, item_id, feed_guid, item_guid) NULLS NOT DISTINCT;


--
-- Name: uq_channel_remote_item_feed_guid_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_channel_remote_item_feed_guid_item_guid ON public.channel_remote_item USING btree (channel_id, feed_guid, item_guid) WHERE (item_guid IS NOT NULL);


--
-- Name: uq_channel_remote_item_feed_guid_no_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_channel_remote_item_feed_guid_no_item_guid ON public.channel_remote_item USING btree (channel_id, feed_guid) WHERE (item_guid IS NULL);


--
-- Name: uq_channel_verified_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_channel_verified_publisher ON public.channel_verified_publisher USING btree (channel_id, publisher_channel_id, item_id) NULLS NOT DISTINCT;


--
-- Name: uq_item_value_time_split_remote_item_feed_guid_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_item_value_time_split_remote_item_feed_guid_item_guid ON public.item_value_time_split_remote_item USING btree (item_value_time_split_id, feed_guid, item_guid) WHERE (item_guid IS NOT NULL);


--
-- Name: uq_item_value_time_split_remote_item_feed_guid_no_item_guid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_item_value_time_split_remote_item_feed_guid_no_item_guid ON public.item_value_time_split_remote_item USING btree (item_value_time_split_id, feed_guid) WHERE (item_guid IS NULL);


--
-- Name: stats_listen_event_default_channel_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.stats_listen_event_channel_id_idx ATTACH PARTITION public.stats_listen_event_default_channel_id_idx;


--
-- Name: stats_listen_event_default_clip_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.stats_listen_event_clip_id_idx ATTACH PARTITION public.stats_listen_event_default_clip_id_idx;


--
-- Name: stats_listen_event_default_item_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.stats_listen_event_item_id_idx ATTACH PARTITION public.stats_listen_event_default_item_id_idx;


--
-- Name: stats_listen_event_default_listener_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.stats_listen_event_listener_created_idx ATTACH PARTITION public.stats_listen_event_default_listener_id_created_at_idx;


--
-- Name: stats_listen_event_default_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.stats_listen_event_pkey ATTACH PARTITION public.stats_listen_event_default_pkey;


--
-- Name: stats_open_event_default_account_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.stats_open_event_account_id_idx ATTACH PARTITION public.stats_open_event_default_account_id_idx;


--
-- Name: stats_open_event_default_listener_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.stats_open_event_listener_created_idx ATTACH PARTITION public.stats_open_event_default_listener_id_created_at_idx;


--
-- Name: stats_open_event_default_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.stats_open_event_pkey ATTACH PARTITION public.stats_open_event_default_pkey;


--
-- Name: stats_open_event_default_playlist_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.stats_open_event_playlist_id_idx ATTACH PARTITION public.stats_open_event_default_playlist_id_idx;


--
-- Name: feed feed_after_insert_set_lifecycle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER feed_after_insert_set_lifecycle AFTER INSERT ON public.feed FOR EACH ROW EXECUTE FUNCTION public.feed_after_insert_lifecycle();


--
-- Name: playlist_resource playlist_resource_limit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER playlist_resource_limit_trigger BEFORE INSERT ON public.playlist_resource FOR EACH ROW EXECUTE FUNCTION public.enforce_playlist_resource_limit();


--
-- Name: queue_resource queue_resource_limit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER queue_resource_limit_trigger BEFORE INSERT ON public.queue_resource FOR EACH ROW EXECUTE FUNCTION public.enforce_queue_resource_limit();


--
-- Name: account_device_auto_download_channel set_updated_at_account_device_auto_download_channel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_account_device_auto_download_channel BEFORE UPDATE ON public.account_device_auto_download_channel FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: account_fcm_device set_updated_at_account_fcm_device; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_account_fcm_device BEFORE UPDATE ON public.account_fcm_device FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: account_up_device set_updated_at_account_up_device; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_account_up_device BEFORE UPDATE ON public.account_up_device FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: account_webpush_device set_updated_at_account_webpush_device; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_account_webpush_device BEFORE UPDATE ON public.account_webpush_device FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: billing_checkout_channel set_updated_at_billing_checkout_channel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_billing_checkout_channel BEFORE UPDATE ON public.billing_checkout_channel FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: billing_price set_updated_at_billing_price; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_billing_price BEFORE UPDATE ON public.billing_price FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: billing_processor set_updated_at_billing_processor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_billing_processor BEFORE UPDATE ON public.billing_processor FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: billing_processor_product set_updated_at_billing_processor_product; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_billing_processor_product BEFORE UPDATE ON public.billing_processor_product FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: billing_product set_updated_at_billing_product; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_billing_product BEFORE UPDATE ON public.billing_product FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: channel_merge set_updated_at_channel_merge; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_channel_merge BEFORE UPDATE ON public.channel_merge FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: feed set_updated_at_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_feed BEFORE UPDATE ON public.feed FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: feed_condition set_updated_at_feed_condition; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_feed_condition BEFORE UPDATE ON public.feed_condition FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: feed_condition_type set_updated_at_feed_condition_type; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_feed_condition_type BEFORE UPDATE ON public.feed_condition_type FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: feed_lifecycle_state set_updated_at_feed_lifecycle_state; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_feed_lifecycle_state BEFORE UPDATE ON public.feed_lifecycle_state FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: feed_lifecycle_state_type set_updated_at_feed_lifecycle_state_type; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_feed_lifecycle_state_type BEFORE UPDATE ON public.feed_lifecycle_state_type FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: feed_policy set_updated_at_feed_policy; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_feed_policy BEFORE UPDATE ON public.feed_policy FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: feed_policy_override set_updated_at_feed_policy_override; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_feed_policy_override BEFORE UPDATE ON public.feed_policy_override FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: feed_takedown_reason set_updated_at_feed_takedown_reason; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_feed_takedown_reason BEFORE UPDATE ON public.feed_takedown_reason FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: image_shrink_source set_updated_at_image_shrink_source; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_image_shrink_source BEFORE UPDATE ON public.image_shrink_source FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: item_flag_status set_updated_at_item_flag_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_item_flag_status BEFORE UPDATE ON public.item_flag_status FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_field();


--
-- Name: stats_listener stats_listener_account_id_fkey; Type: FK CONSTRAINT; Schema: listener_identity; Owner: -
--

ALTER TABLE ONLY listener_identity.stats_listener
    ADD CONSTRAINT stats_listener_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_api_key account_api_key_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_api_key
    ADD CONSTRAINT account_api_key_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_content_log account_content_log_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_content_log
    ADD CONSTRAINT account_content_log_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_credentials account_credentials_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_credentials
    ADD CONSTRAINT account_credentials_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_device_auto_download_channel account_device_auto_download_channel_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_device_auto_download_channel
    ADD CONSTRAINT account_device_auto_download_channel_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_device_auto_download_channel account_device_auto_download_channel_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_device_auto_download_channel
    ADD CONSTRAINT account_device_auto_download_channel_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: account_email_change_verification account_email_change_verification_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_email_change_verification
    ADD CONSTRAINT account_email_change_verification_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_fcm_device account_fcm_device_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_fcm_device
    ADD CONSTRAINT account_fcm_device_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_following_account account_following_account_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_account
    ADD CONSTRAINT account_following_account_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_following_account account_following_account_following_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_account
    ADD CONSTRAINT account_following_account_following_account_id_fkey FOREIGN KEY (following_account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_following_add_by_rss_channel account_following_add_by_rss_channel_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_add_by_rss_channel
    ADD CONSTRAINT account_following_add_by_rss_channel_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_following_channel account_following_channel_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_channel
    ADD CONSTRAINT account_following_channel_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_following_channel account_following_channel_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_channel
    ADD CONSTRAINT account_following_channel_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: account_following_playlist account_following_playlist_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_playlist
    ADD CONSTRAINT account_following_playlist_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_following_playlist account_following_playlist_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_following_playlist
    ADD CONSTRAINT account_following_playlist_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlist(id) ON DELETE CASCADE;


--
-- Name: account_membership_status account_membership_status_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_membership_status
    ADD CONSTRAINT account_membership_status_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_membership_status account_membership_status_account_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_membership_status
    ADD CONSTRAINT account_membership_status_account_membership_id_fkey FOREIGN KEY (account_membership_id) REFERENCES public.account_membership(id);


--
-- Name: account_metaboost account_metaboost_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_metaboost
    ADD CONSTRAINT account_metaboost_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_notification account_notification_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification
    ADD CONSTRAINT account_notification_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_notification_channel_type account_notification_channel__account_notification_channel_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_channel_type
    ADD CONSTRAINT account_notification_channel__account_notification_channel_fkey FOREIGN KEY (account_notification_channel_id) REFERENCES public.account_notification_channel(id) ON DELETE CASCADE;


--
-- Name: account_notification_channel account_notification_channel_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_channel
    ADD CONSTRAINT account_notification_channel_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_notification_channel account_notification_channel_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_channel
    ADD CONSTRAINT account_notification_channel_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: account_notification_preference account_notification_preference_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_notification_preference
    ADD CONSTRAINT account_notification_preference_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_pending_following_channel account_pending_following_channel_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_pending_following_channel
    ADD CONSTRAINT account_pending_following_channel_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_profile account_profile_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_profile
    ADD CONSTRAINT account_profile_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_reset_password account_reset_password_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_reset_password
    ADD CONSTRAINT account_reset_password_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_session account_session_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_session
    ADD CONSTRAINT account_session_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_set_password account_set_password_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_set_password
    ADD CONSTRAINT account_set_password_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_settings account_settings_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings
    ADD CONSTRAINT account_settings_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_settings_locale account_settings_locale_account_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_locale
    ADD CONSTRAINT account_settings_locale_account_settings_id_fkey FOREIGN KEY (account_settings_id) REFERENCES public.account_settings(id) ON DELETE CASCADE;


--
-- Name: account_settings_notification account_settings_notification_account_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_notification
    ADD CONSTRAINT account_settings_notification_account_settings_id_fkey FOREIGN KEY (account_settings_id) REFERENCES public.account_settings(id) ON DELETE CASCADE;


--
-- Name: account_settings_notification_type account_settings_notification_account_settings_notificatio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_notification_type
    ADD CONSTRAINT account_settings_notification_account_settings_notificatio_fkey FOREIGN KEY (account_settings_notification_id) REFERENCES public.account_settings_notification(id) ON DELETE CASCADE;


--
-- Name: account_settings_playback account_settings_playback_account_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_settings_playback
    ADD CONSTRAINT account_settings_playback_account_settings_id_fkey FOREIGN KEY (account_settings_id) REFERENCES public.account_settings(id) ON DELETE CASCADE;


--
-- Name: account account_sharable_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_sharable_status_id_fkey FOREIGN KEY (sharable_status_id) REFERENCES public.sharable_status(id);


--
-- Name: account_terms_acceptance account_terms_acceptance_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_terms_acceptance
    ADD CONSTRAINT account_terms_acceptance_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_up_device account_up_device_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_up_device
    ADD CONSTRAINT account_up_device_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_verification account_verification_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_verification
    ADD CONSTRAINT account_verification_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: account_webpush_device account_webpush_device_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_webpush_device
    ADD CONSTRAINT account_webpush_device_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: billing_checkout_channel billing_checkout_channel_processor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_checkout_channel
    ADD CONSTRAINT billing_checkout_channel_processor_id_fkey FOREIGN KEY (processor_id) REFERENCES public.billing_processor(id);


--
-- Name: billing_checkout_session billing_checkout_session_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_checkout_session
    ADD CONSTRAINT billing_checkout_session_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: billing_checkout_session billing_checkout_session_billing_processor_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_checkout_session
    ADD CONSTRAINT billing_checkout_session_billing_processor_product_id_fkey FOREIGN KEY (billing_processor_product_id) REFERENCES public.billing_processor_product(id);


--
-- Name: billing_checkout_session billing_checkout_session_processor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_checkout_session
    ADD CONSTRAINT billing_checkout_session_processor_id_fkey FOREIGN KEY (processor_id) REFERENCES public.billing_processor(id);


--
-- Name: billing_membership_grant billing_membership_grant_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_membership_grant
    ADD CONSTRAINT billing_membership_grant_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: billing_membership_grant billing_membership_grant_billing_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_membership_grant
    ADD CONSTRAINT billing_membership_grant_billing_transaction_id_fkey FOREIGN KEY (billing_transaction_id) REFERENCES public.billing_transaction(id);


--
-- Name: billing_membership_grant billing_membership_grant_membership_claim_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_membership_grant
    ADD CONSTRAINT billing_membership_grant_membership_claim_token_id_fkey FOREIGN KEY (membership_claim_token_id) REFERENCES public.membership_claim_token(id);


--
-- Name: billing_price billing_price_billing_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_price
    ADD CONSTRAINT billing_price_billing_product_id_fkey FOREIGN KEY (billing_product_id) REFERENCES public.billing_product(id) ON DELETE CASCADE;


--
-- Name: billing_price_change_audit billing_price_change_audit_billing_price_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_price_change_audit
    ADD CONSTRAINT billing_price_change_audit_billing_price_id_fkey FOREIGN KEY (billing_price_id) REFERENCES public.billing_price(id) ON DELETE SET NULL;


--
-- Name: billing_processor_product billing_processor_product_billing_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_processor_product
    ADD CONSTRAINT billing_processor_product_billing_product_id_fkey FOREIGN KEY (billing_product_id) REFERENCES public.billing_product(id);


--
-- Name: billing_processor_product billing_processor_product_processor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_processor_product
    ADD CONSTRAINT billing_processor_product_processor_id_fkey FOREIGN KEY (processor_id) REFERENCES public.billing_processor(id);


--
-- Name: billing_transaction billing_transaction_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_transaction
    ADD CONSTRAINT billing_transaction_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: billing_transaction billing_transaction_processor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_transaction
    ADD CONSTRAINT billing_transaction_processor_id_fkey FOREIGN KEY (processor_id) REFERENCES public.billing_processor(id);


--
-- Name: billing_webhook_event billing_webhook_event_processor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_webhook_event
    ADD CONSTRAINT billing_webhook_event_processor_id_fkey FOREIGN KEY (processor_id) REFERENCES public.billing_processor(id);


--
-- Name: category category_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.category(id) ON DELETE CASCADE;


--
-- Name: channel_about channel_about_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_about
    ADD CONSTRAINT channel_about_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_about channel_about_itunes_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_about
    ADD CONSTRAINT channel_about_itunes_type_id_fkey FOREIGN KEY (itunes_type_id) REFERENCES public.channel_itunes_type(id);


--
-- Name: channel_category channel_category_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_category
    ADD CONSTRAINT channel_category_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.category(id) ON DELETE CASCADE;


--
-- Name: channel_category channel_category_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_category
    ADD CONSTRAINT channel_category_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_chat channel_chat_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_chat
    ADD CONSTRAINT channel_chat_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_description channel_description_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_description
    ADD CONSTRAINT channel_description_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel channel_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT channel_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feed(id) ON DELETE CASCADE;


--
-- Name: channel_funding channel_funding_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_funding
    ADD CONSTRAINT channel_funding_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_image channel_image_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_image
    ADD CONSTRAINT channel_image_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_internal_settings channel_internal_settings_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_internal_settings
    ADD CONSTRAINT channel_internal_settings_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_license channel_license_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_license
    ADD CONSTRAINT channel_license_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_location channel_location_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_location
    ADD CONSTRAINT channel_location_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel channel_medium_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT channel_medium_id_fkey FOREIGN KEY (medium_id) REFERENCES public.medium(id);


--
-- Name: channel_merge channel_merge_from_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_merge
    ADD CONSTRAINT channel_merge_from_channel_id_fkey FOREIGN KEY (from_channel_id) REFERENCES public.channel(id);


--
-- Name: channel_merge_journal channel_merge_journal_channel_merge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_merge_journal
    ADD CONSTRAINT channel_merge_journal_channel_merge_id_fkey FOREIGN KEY (channel_merge_id) REFERENCES public.channel_merge(id) ON DELETE CASCADE;


--
-- Name: channel_merge channel_merge_to_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_merge
    ADD CONSTRAINT channel_merge_to_channel_id_fkey FOREIGN KEY (to_channel_id) REFERENCES public.channel(id);


--
-- Name: channel_meta_boost channel_meta_boost_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_meta_boost
    ADD CONSTRAINT channel_meta_boost_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_person channel_person_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_person
    ADD CONSTRAINT channel_person_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_podroll channel_podroll_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_podroll
    ADD CONSTRAINT channel_podroll_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_podroll_remote_item channel_podroll_remote_item_channel_podroll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_podroll_remote_item
    ADD CONSTRAINT channel_podroll_remote_item_channel_podroll_id_fkey FOREIGN KEY (channel_podroll_id) REFERENCES public.channel_podroll(id) ON DELETE CASCADE;


--
-- Name: channel_podroll_remote_item channel_podroll_remote_item_medium_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_podroll_remote_item
    ADD CONSTRAINT channel_podroll_remote_item_medium_id_fkey FOREIGN KEY (medium_id) REFERENCES public.medium(id);


--
-- Name: channel_publisher channel_publisher_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_publisher
    ADD CONSTRAINT channel_publisher_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_publisher_remote_item channel_publisher_remote_item_channel_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_publisher_remote_item
    ADD CONSTRAINT channel_publisher_remote_item_channel_publisher_id_fkey FOREIGN KEY (channel_publisher_id) REFERENCES public.channel_publisher(id) ON DELETE CASCADE;


--
-- Name: channel_publisher_remote_item channel_publisher_remote_item_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_publisher_remote_item
    ADD CONSTRAINT channel_publisher_remote_item_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: channel_publisher_remote_item channel_publisher_remote_item_medium_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_publisher_remote_item
    ADD CONSTRAINT channel_publisher_remote_item_medium_id_fkey FOREIGN KEY (medium_id) REFERENCES public.medium(id);


--
-- Name: channel_remote_item channel_remote_item_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_remote_item
    ADD CONSTRAINT channel_remote_item_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_remote_item channel_remote_item_medium_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_remote_item
    ADD CONSTRAINT channel_remote_item_medium_id_fkey FOREIGN KEY (medium_id) REFERENCES public.medium(id);


--
-- Name: channel_season channel_season_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_season
    ADD CONSTRAINT channel_season_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_social_interact channel_social_interact_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_social_interact
    ADD CONSTRAINT channel_social_interact_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_trailer channel_trailer_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_trailer
    ADD CONSTRAINT channel_trailer_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_trailer channel_trailer_channel_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_trailer
    ADD CONSTRAINT channel_trailer_channel_season_id_fkey FOREIGN KEY (channel_season_id) REFERENCES public.channel_season(id);


--
-- Name: channel_txt channel_txt_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_txt
    ADD CONSTRAINT channel_txt_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_value channel_value_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_value
    ADD CONSTRAINT channel_value_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_value_recipient channel_value_recipient_channel_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_value_recipient
    ADD CONSTRAINT channel_value_recipient_channel_value_id_fkey FOREIGN KEY (channel_value_id) REFERENCES public.channel_value(id) ON DELETE CASCADE;


--
-- Name: channel_verified_publisher channel_verified_publisher_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_verified_publisher
    ADD CONSTRAINT channel_verified_publisher_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: channel_verified_publisher channel_verified_publisher_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_verified_publisher
    ADD CONSTRAINT channel_verified_publisher_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: channel_verified_publisher channel_verified_publisher_publisher_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_verified_publisher
    ADD CONSTRAINT channel_verified_publisher_publisher_channel_id_fkey FOREIGN KEY (publisher_channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: clip clip_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clip
    ADD CONSTRAINT clip_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: clip clip_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clip
    ADD CONSTRAINT clip_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE SET NULL;


--
-- Name: clip clip_sharable_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clip
    ADD CONSTRAINT clip_sharable_status_id_fkey FOREIGN KEY (sharable_status_id) REFERENCES public.sharable_status(id);


--
-- Name: feed_condition feed_condition_feed_condition_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_condition
    ADD CONSTRAINT feed_condition_feed_condition_type_id_fkey FOREIGN KEY (feed_condition_type_id) REFERENCES public.feed_condition_type(id) ON DELETE CASCADE;


--
-- Name: feed_condition feed_condition_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_condition
    ADD CONSTRAINT feed_condition_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feed(id) ON DELETE CASCADE;


--
-- Name: feed_lifecycle_event feed_lifecycle_event_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_event
    ADD CONSTRAINT feed_lifecycle_event_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feed(id) ON DELETE CASCADE;


--
-- Name: feed_lifecycle_event feed_lifecycle_event_from_lifecycle_state_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_event
    ADD CONSTRAINT feed_lifecycle_event_from_lifecycle_state_type_id_fkey FOREIGN KEY (from_lifecycle_state_type_id) REFERENCES public.feed_lifecycle_state_type(id);


--
-- Name: feed_lifecycle_event feed_lifecycle_event_to_lifecycle_state_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_event
    ADD CONSTRAINT feed_lifecycle_event_to_lifecycle_state_type_id_fkey FOREIGN KEY (to_lifecycle_state_type_id) REFERENCES public.feed_lifecycle_state_type(id);


--
-- Name: feed_lifecycle_state feed_lifecycle_state_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_state
    ADD CONSTRAINT feed_lifecycle_state_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feed(id) ON DELETE CASCADE;


--
-- Name: feed_lifecycle_state feed_lifecycle_state_feed_lifecycle_state_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_lifecycle_state
    ADD CONSTRAINT feed_lifecycle_state_feed_lifecycle_state_type_id_fkey FOREIGN KEY (feed_lifecycle_state_type_id) REFERENCES public.feed_lifecycle_state_type(id);


--
-- Name: feed_log feed_log_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_log
    ADD CONSTRAINT feed_log_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feed(id) ON DELETE CASCADE;


--
-- Name: feed_policy feed_policy_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_policy
    ADD CONSTRAINT feed_policy_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feed(id) ON DELETE CASCADE;


--
-- Name: feed_policy_override feed_policy_override_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_policy_override
    ADD CONSTRAINT feed_policy_override_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.feed(id) ON DELETE CASCADE;


--
-- Name: item_about item_about_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_about
    ADD CONSTRAINT item_about_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_about item_about_item_itunes_episode_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_about
    ADD CONSTRAINT item_about_item_itunes_episode_type_id_fkey FOREIGN KEY (item_itunes_episode_type_id) REFERENCES public.item_itunes_episode_type(id);


--
-- Name: item item_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item
    ADD CONSTRAINT item_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: item_chapter item_chapter_item_chapters_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapter
    ADD CONSTRAINT item_chapter_item_chapters_object_id_fkey FOREIGN KEY (item_chapters_object_id) REFERENCES public.item_chapters_object(id) ON DELETE CASCADE;


--
-- Name: item_chapter_location item_chapter_location_item_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapter_location
    ADD CONSTRAINT item_chapter_location_item_chapter_id_fkey FOREIGN KEY (item_chapter_id) REFERENCES public.item_chapter(id) ON DELETE CASCADE;


--
-- Name: item_chapters_feed item_chapters_feed_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_feed
    ADD CONSTRAINT item_chapters_feed_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_chapters_feed_log item_chapters_feed_log_item_chapters_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_feed_log
    ADD CONSTRAINT item_chapters_feed_log_item_chapters_feed_id_fkey FOREIGN KEY (item_chapters_feed_id) REFERENCES public.item_chapters_feed(id) ON DELETE CASCADE;


--
-- Name: item_chapters_object item_chapters_object_item_chapters_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chapters_object
    ADD CONSTRAINT item_chapters_object_item_chapters_feed_id_fkey FOREIGN KEY (item_chapters_feed_id) REFERENCES public.item_chapters_feed(id) ON DELETE CASCADE;


--
-- Name: item_chat item_chat_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_chat
    ADD CONSTRAINT item_chat_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_content_link item_content_link_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_content_link
    ADD CONSTRAINT item_content_link_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_description item_description_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_description
    ADD CONSTRAINT item_description_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_enclosure_integrity item_enclosure_integrity_item_enclosure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_enclosure_integrity
    ADD CONSTRAINT item_enclosure_integrity_item_enclosure_id_fkey FOREIGN KEY (item_enclosure_id) REFERENCES public.item_enclosure(id) ON DELETE CASCADE;


--
-- Name: item_enclosure item_enclosure_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_enclosure
    ADD CONSTRAINT item_enclosure_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_enclosure_source item_enclosure_source_item_enclosure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_enclosure_source
    ADD CONSTRAINT item_enclosure_source_item_enclosure_id_fkey FOREIGN KEY (item_enclosure_id) REFERENCES public.item_enclosure(id) ON DELETE CASCADE;


--
-- Name: item_funding item_funding_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_funding
    ADD CONSTRAINT item_funding_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_image item_image_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_image
    ADD CONSTRAINT item_image_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item item_item_flag_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item
    ADD CONSTRAINT item_item_flag_status_id_fkey FOREIGN KEY (item_flag_status_id) REFERENCES public.item_flag_status(id);


--
-- Name: item_license item_license_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_license
    ADD CONSTRAINT item_license_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_location item_location_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_location
    ADD CONSTRAINT item_location_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_merge_map item_merge_map_channel_merge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_merge_map
    ADD CONSTRAINT item_merge_map_channel_merge_id_fkey FOREIGN KEY (channel_merge_id) REFERENCES public.channel_merge(id) ON DELETE CASCADE;


--
-- Name: item_merge_map item_merge_map_from_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_merge_map
    ADD CONSTRAINT item_merge_map_from_item_id_fkey FOREIGN KEY (from_item_id) REFERENCES public.item(id);


--
-- Name: item_merge_map item_merge_map_to_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_merge_map
    ADD CONSTRAINT item_merge_map_to_item_id_fkey FOREIGN KEY (to_item_id) REFERENCES public.item(id);


--
-- Name: item_person item_person_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_person
    ADD CONSTRAINT item_person_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_season item_season_channel_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_season
    ADD CONSTRAINT item_season_channel_season_id_fkey FOREIGN KEY (channel_season_id) REFERENCES public.channel_season(id) ON DELETE CASCADE;


--
-- Name: item_season_episode item_season_episode_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_season_episode
    ADD CONSTRAINT item_season_episode_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_season item_season_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_season
    ADD CONSTRAINT item_season_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_social_interact item_social_interact_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_social_interact
    ADD CONSTRAINT item_social_interact_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_soundbite item_soundbite_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_soundbite
    ADD CONSTRAINT item_soundbite_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_transcript item_transcript_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_transcript
    ADD CONSTRAINT item_transcript_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_txt item_txt_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_txt
    ADD CONSTRAINT item_txt_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_value item_value_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value
    ADD CONSTRAINT item_value_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: item_value_recipient item_value_recipient_item_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_recipient
    ADD CONSTRAINT item_value_recipient_item_value_id_fkey FOREIGN KEY (item_value_id) REFERENCES public.item_value(id) ON DELETE CASCADE;


--
-- Name: item_value_time_split item_value_time_split_item_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_time_split
    ADD CONSTRAINT item_value_time_split_item_value_id_fkey FOREIGN KEY (item_value_id) REFERENCES public.item_value(id) ON DELETE CASCADE;


--
-- Name: item_value_time_split_recipient item_value_time_split_recipient_item_value_time_split_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_time_split_recipient
    ADD CONSTRAINT item_value_time_split_recipient_item_value_time_split_id_fkey FOREIGN KEY (item_value_time_split_id) REFERENCES public.item_value_time_split(id) ON DELETE CASCADE;


--
-- Name: item_value_time_split_remote_item item_value_time_split_remote_item_item_value_time_split_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_value_time_split_remote_item
    ADD CONSTRAINT item_value_time_split_remote_item_item_value_time_split_id_fkey FOREIGN KEY (item_value_time_split_id) REFERENCES public.item_value_time_split(id) ON DELETE CASCADE;


--
-- Name: live_item live_item_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_item
    ADD CONSTRAINT live_item_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: live_item live_item_live_item_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_item
    ADD CONSTRAINT live_item_live_item_status_id_fkey FOREIGN KEY (live_item_status_id) REFERENCES public.live_item_status(id);


--
-- Name: membership_claim_token membership_claim_token_account_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_claim_token
    ADD CONSTRAINT membership_claim_token_account_membership_id_fkey FOREIGN KEY (account_membership_id) REFERENCES public.account_membership(id) ON DELETE CASCADE;


--
-- Name: on_demand_parser_event on_demand_parser_event_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.on_demand_parser_event
    ADD CONSTRAINT on_demand_parser_event_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: playlist playlist_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist
    ADD CONSTRAINT playlist_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: playlist playlist_medium_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist
    ADD CONSTRAINT playlist_medium_id_fkey FOREIGN KEY (medium_id) REFERENCES public.medium(id);


--
-- Name: playlist_resource playlist_resource_clip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource
    ADD CONSTRAINT playlist_resource_clip_id_fkey FOREIGN KEY (clip_id) REFERENCES public.clip(id) ON DELETE CASCADE;


--
-- Name: playlist_resource playlist_resource_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource
    ADD CONSTRAINT playlist_resource_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE SET NULL;


--
-- Name: playlist_resource playlist_resource_item_soundbite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource
    ADD CONSTRAINT playlist_resource_item_soundbite_id_fkey FOREIGN KEY (item_soundbite_id) REFERENCES public.item_soundbite(id) ON DELETE SET NULL;


--
-- Name: playlist_resource playlist_resource_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_resource
    ADD CONSTRAINT playlist_resource_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlist(id) ON DELETE CASCADE;


--
-- Name: playlist playlist_sharable_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist
    ADD CONSTRAINT playlist_sharable_status_id_fkey FOREIGN KEY (sharable_status_id) REFERENCES public.sharable_status(id);


--
-- Name: queue queue_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue
    ADD CONSTRAINT queue_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: queue queue_medium_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue
    ADD CONSTRAINT queue_medium_id_fkey FOREIGN KEY (medium_id) REFERENCES public.medium(id);


--
-- Name: queue_resource queue_resource_clip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource
    ADD CONSTRAINT queue_resource_clip_id_fkey FOREIGN KEY (clip_id) REFERENCES public.clip(id) ON DELETE CASCADE;


--
-- Name: queue_resource queue_resource_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource
    ADD CONSTRAINT queue_resource_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: queue_resource queue_resource_item_soundbite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource
    ADD CONSTRAINT queue_resource_item_soundbite_id_fkey FOREIGN KEY (item_soundbite_id) REFERENCES public.item_soundbite(id) ON DELETE CASCADE;


--
-- Name: queue_resource queue_resource_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_resource
    ADD CONSTRAINT queue_resource_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.queue(id) ON DELETE CASCADE;


--
-- Name: stats_daily_account stats_daily_account_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily_account
    ADD CONSTRAINT stats_daily_account_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: stats_daily_channel stats_daily_channel_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily_channel
    ADD CONSTRAINT stats_daily_channel_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: stats_daily_clip stats_daily_clip_clip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily_clip
    ADD CONSTRAINT stats_daily_clip_clip_id_fkey FOREIGN KEY (clip_id) REFERENCES public.clip(id) ON DELETE CASCADE;


--
-- Name: stats_daily_item stats_daily_item_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily_item
    ADD CONSTRAINT stats_daily_item_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: stats_daily_playlist stats_daily_playlist_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily_playlist
    ADD CONSTRAINT stats_daily_playlist_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlist(id) ON DELETE CASCADE;


--
-- Name: stats_flag_signal stats_flag_signal_listener_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_flag_signal
    ADD CONSTRAINT stats_flag_signal_listener_id_fkey FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE;


--
-- Name: stats_flagged_listener stats_flagged_listener_listener_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_flagged_listener
    ADD CONSTRAINT stats_flagged_listener_listener_id_fkey FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE;


--
-- Name: stats_listen_event stats_listen_event_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.stats_listen_event
    ADD CONSTRAINT stats_listen_event_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: stats_listen_event stats_listen_event_clip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.stats_listen_event
    ADD CONSTRAINT stats_listen_event_clip_id_fkey FOREIGN KEY (clip_id) REFERENCES public.clip(id) ON DELETE CASCADE;


--
-- Name: stats_listen_event stats_listen_event_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.stats_listen_event
    ADD CONSTRAINT stats_listen_event_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: stats_listen_event stats_listen_event_listener_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.stats_listen_event
    ADD CONSTRAINT stats_listen_event_listener_id_fkey FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE;


--
-- Name: stats_open_event stats_open_event_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.stats_open_event
    ADD CONSTRAINT stats_open_event_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: stats_open_event stats_open_event_listener_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.stats_open_event
    ADD CONSTRAINT stats_open_event_listener_id_fkey FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE;


--
-- Name: stats_open_event stats_open_event_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.stats_open_event
    ADD CONSTRAINT stats_open_event_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlist(id) ON DELETE CASCADE;


--
-- Name: stats_popularity_account stats_popularity_account_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_popularity_account
    ADD CONSTRAINT stats_popularity_account_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: stats_popularity_channel stats_popularity_channel_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_popularity_channel
    ADD CONSTRAINT stats_popularity_channel_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: stats_popularity_clip stats_popularity_clip_clip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_popularity_clip
    ADD CONSTRAINT stats_popularity_clip_clip_id_fkey FOREIGN KEY (clip_id) REFERENCES public.clip(id) ON DELETE CASCADE;


--
-- Name: stats_popularity_item stats_popularity_item_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_popularity_item
    ADD CONSTRAINT stats_popularity_item_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE CASCADE;


--
-- Name: stats_popularity_playlist stats_popularity_playlist_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_popularity_playlist
    ADD CONSTRAINT stats_popularity_playlist_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlist(id) ON DELETE CASCADE;


--
-- Name: stats_taste_profile stats_taste_profile_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_taste_profile
    ADD CONSTRAINT stats_taste_profile_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: stats_taste_profile_hidden stats_taste_profile_hidden_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_taste_profile_hidden
    ADD CONSTRAINT stats_taste_profile_hidden_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channel(id) ON DELETE CASCADE;


--
-- Name: stats_taste_profile_hidden stats_taste_profile_hidden_listener_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_taste_profile_hidden
    ADD CONSTRAINT stats_taste_profile_hidden_listener_id_fkey FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE;


--
-- Name: stats_taste_profile stats_taste_profile_listener_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_taste_profile
    ADD CONSTRAINT stats_taste_profile_listener_id_fkey FOREIGN KEY (listener_id) REFERENCES listener_identity.stats_listener(listener_id) ON DELETE CASCADE;


--
-- Name: SCHEMA listener_identity; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA listener_identity TO podverse_app_read_write;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT ALL ON SCHEMA public TO podverse_app_migrator;
GRANT USAGE ON SCHEMA public TO podverse_app_read_write;
GRANT USAGE ON SCHEMA public TO podverse_app_read;


--
-- Name: FUNCTION stats_event_drop_month_partitions_before(parent_table text, cutoff date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stats_event_drop_month_partitions_before(parent_table text, cutoff date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stats_event_drop_month_partitions_before(parent_table text, cutoff date) TO podverse_app_read_write;


--
-- Name: FUNCTION stats_event_ensure_month_partition(parent_table text, month_start date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stats_event_ensure_month_partition(parent_table text, month_start date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stats_event_ensure_month_partition(parent_table text, month_start date) TO podverse_app_read_write;


--
-- Name: TABLE stats_listener; Type: ACL; Schema: listener_identity; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE listener_identity.stats_listener TO podverse_app_read_write;


--
-- Name: TABLE account; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account TO podverse_app_read;


--
-- Name: TABLE account_api_key; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_api_key TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_api_key TO podverse_app_read;


--
-- Name: SEQUENCE account_api_key_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_api_key_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_api_key_id_seq TO podverse_app_read;


--
-- Name: TABLE account_content_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_content_log TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_content_log TO podverse_app_read;


--
-- Name: SEQUENCE account_content_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_content_log_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_content_log_id_seq TO podverse_app_read;


--
-- Name: TABLE account_credentials; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_credentials TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_credentials TO podverse_app_read;


--
-- Name: SEQUENCE account_credentials_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_credentials_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_credentials_id_seq TO podverse_app_read;


--
-- Name: TABLE account_device_auto_download_channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_device_auto_download_channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_device_auto_download_channel TO podverse_app_read;


--
-- Name: SEQUENCE account_device_auto_download_channel_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_device_auto_download_channel_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_device_auto_download_channel_id_seq TO podverse_app_read;


--
-- Name: TABLE account_email_change_verification; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_email_change_verification TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_email_change_verification TO podverse_app_read;


--
-- Name: SEQUENCE account_email_change_verification_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_email_change_verification_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_email_change_verification_id_seq TO podverse_app_read;


--
-- Name: TABLE account_fcm_device; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_fcm_device TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_fcm_device TO podverse_app_read;


--
-- Name: SEQUENCE account_fcm_device_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_fcm_device_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_fcm_device_id_seq TO podverse_app_read;


--
-- Name: TABLE account_following_account; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_following_account TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_following_account TO podverse_app_read;


--
-- Name: TABLE account_following_add_by_rss_channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_following_add_by_rss_channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_following_add_by_rss_channel TO podverse_app_read;


--
-- Name: TABLE account_following_channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_following_channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_following_channel TO podverse_app_read;


--
-- Name: TABLE account_following_playlist; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_following_playlist TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_following_playlist TO podverse_app_read;


--
-- Name: SEQUENCE account_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_id_seq TO podverse_app_read;


--
-- Name: TABLE account_membership; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_membership TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_membership TO podverse_app_read;


--
-- Name: SEQUENCE account_membership_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_membership_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_membership_id_seq TO podverse_app_read;


--
-- Name: TABLE account_membership_status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_membership_status TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_membership_status TO podverse_app_read;


--
-- Name: SEQUENCE account_membership_status_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_membership_status_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_membership_status_id_seq TO podverse_app_read;


--
-- Name: TABLE account_metaboost; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_metaboost TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_metaboost TO podverse_app_read;


--
-- Name: TABLE account_notification; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_notification TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_notification TO podverse_app_read;


--
-- Name: TABLE account_notification_channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_notification_channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_notification_channel TO podverse_app_read;


--
-- Name: SEQUENCE account_notification_channel_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_notification_channel_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_notification_channel_id_seq TO podverse_app_read;


--
-- Name: TABLE account_notification_channel_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_notification_channel_type TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_notification_channel_type TO podverse_app_read;


--
-- Name: SEQUENCE account_notification_channel_type_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_notification_channel_type_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_notification_channel_type_id_seq TO podverse_app_read;


--
-- Name: SEQUENCE account_notification_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_notification_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_notification_id_seq TO podverse_app_read;


--
-- Name: TABLE account_notification_preference; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_notification_preference TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_notification_preference TO podverse_app_read;


--
-- Name: SEQUENCE account_notification_preference_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_notification_preference_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_notification_preference_id_seq TO podverse_app_read;


--
-- Name: TABLE account_pending_following_channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_pending_following_channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_pending_following_channel TO podverse_app_read;


--
-- Name: SEQUENCE account_pending_following_channel_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_pending_following_channel_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_pending_following_channel_id_seq TO podverse_app_read;


--
-- Name: TABLE account_profile; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_profile TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_profile TO podverse_app_read;


--
-- Name: SEQUENCE account_profile_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_profile_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_profile_id_seq TO podverse_app_read;


--
-- Name: TABLE account_reset_password; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_reset_password TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_reset_password TO podverse_app_read;


--
-- Name: SEQUENCE account_reset_password_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_reset_password_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_reset_password_id_seq TO podverse_app_read;


--
-- Name: TABLE account_session; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_session TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_session TO podverse_app_read;


--
-- Name: SEQUENCE account_session_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_session_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_session_id_seq TO podverse_app_read;


--
-- Name: TABLE account_set_password; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_set_password TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_set_password TO podverse_app_read;


--
-- Name: SEQUENCE account_set_password_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_set_password_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_set_password_id_seq TO podverse_app_read;


--
-- Name: TABLE account_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_settings TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_settings TO podverse_app_read;


--
-- Name: SEQUENCE account_settings_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_settings_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_settings_id_seq TO podverse_app_read;


--
-- Name: TABLE account_settings_locale; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_settings_locale TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_settings_locale TO podverse_app_read;


--
-- Name: SEQUENCE account_settings_locale_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_settings_locale_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_settings_locale_id_seq TO podverse_app_read;


--
-- Name: TABLE account_settings_notification; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_settings_notification TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_settings_notification TO podverse_app_read;


--
-- Name: SEQUENCE account_settings_notification_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_settings_notification_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_settings_notification_id_seq TO podverse_app_read;


--
-- Name: TABLE account_settings_notification_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_settings_notification_type TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_settings_notification_type TO podverse_app_read;


--
-- Name: SEQUENCE account_settings_notification_type_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_settings_notification_type_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_settings_notification_type_id_seq TO podverse_app_read;


--
-- Name: TABLE account_settings_playback; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_settings_playback TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_settings_playback TO podverse_app_read;


--
-- Name: SEQUENCE account_settings_playback_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_settings_playback_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_settings_playback_id_seq TO podverse_app_read;


--
-- Name: TABLE account_terms_acceptance; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_terms_acceptance TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_terms_acceptance TO podverse_app_read;


--
-- Name: TABLE account_up_device; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_up_device TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_up_device TO podverse_app_read;


--
-- Name: SEQUENCE account_up_device_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_up_device_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_up_device_id_seq TO podverse_app_read;


--
-- Name: TABLE account_verification; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_verification TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_verification TO podverse_app_read;


--
-- Name: SEQUENCE account_verification_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_verification_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_verification_id_seq TO podverse_app_read;


--
-- Name: TABLE account_webpush_device; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.account_webpush_device TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_webpush_device TO podverse_app_read;


--
-- Name: SEQUENCE account_webpush_device_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.account_webpush_device_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.account_webpush_device_id_seq TO podverse_app_read;


--
-- Name: TABLE admin_notification_campaign; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admin_notification_campaign TO podverse_app_read_write;
GRANT SELECT ON TABLE public.admin_notification_campaign TO podverse_app_read;


--
-- Name: SEQUENCE admin_notification_campaign_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.admin_notification_campaign_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.admin_notification_campaign_id_seq TO podverse_app_read;


--
-- Name: TABLE billing_checkout_channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_checkout_channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.billing_checkout_channel TO podverse_app_read;


--
-- Name: SEQUENCE billing_checkout_channel_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.billing_checkout_channel_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.billing_checkout_channel_id_seq TO podverse_app_read;


--
-- Name: TABLE billing_checkout_session; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_checkout_session TO podverse_app_read_write;
GRANT SELECT ON TABLE public.billing_checkout_session TO podverse_app_read;


--
-- Name: SEQUENCE billing_checkout_session_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.billing_checkout_session_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.billing_checkout_session_id_seq TO podverse_app_read;


--
-- Name: TABLE billing_membership_grant; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_membership_grant TO podverse_app_read_write;
GRANT SELECT ON TABLE public.billing_membership_grant TO podverse_app_read;


--
-- Name: SEQUENCE billing_membership_grant_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.billing_membership_grant_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.billing_membership_grant_id_seq TO podverse_app_read;


--
-- Name: TABLE billing_price; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_price TO podverse_app_read_write;
GRANT SELECT ON TABLE public.billing_price TO podverse_app_read;


--
-- Name: TABLE billing_price_change_audit; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_price_change_audit TO podverse_app_read_write;
GRANT SELECT ON TABLE public.billing_price_change_audit TO podverse_app_read;


--
-- Name: SEQUENCE billing_price_change_audit_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.billing_price_change_audit_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.billing_price_change_audit_id_seq TO podverse_app_read;


--
-- Name: SEQUENCE billing_price_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.billing_price_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.billing_price_id_seq TO podverse_app_read;


--
-- Name: TABLE billing_processor; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_processor TO podverse_app_read_write;
GRANT SELECT ON TABLE public.billing_processor TO podverse_app_read;


--
-- Name: TABLE billing_processor_product; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_processor_product TO podverse_app_read_write;
GRANT SELECT ON TABLE public.billing_processor_product TO podverse_app_read;


--
-- Name: SEQUENCE billing_processor_product_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.billing_processor_product_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.billing_processor_product_id_seq TO podverse_app_read;


--
-- Name: TABLE billing_product; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_product TO podverse_app_read_write;
GRANT SELECT ON TABLE public.billing_product TO podverse_app_read;


--
-- Name: SEQUENCE billing_product_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.billing_product_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.billing_product_id_seq TO podverse_app_read;


--
-- Name: TABLE billing_transaction; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_transaction TO podverse_app_read_write;
GRANT SELECT ON TABLE public.billing_transaction TO podverse_app_read;


--
-- Name: SEQUENCE billing_transaction_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.billing_transaction_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.billing_transaction_id_seq TO podverse_app_read;


--
-- Name: TABLE billing_webhook_event; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.billing_webhook_event TO podverse_app_read_write;
GRANT SELECT ON TABLE public.billing_webhook_event TO podverse_app_read;


--
-- Name: SEQUENCE billing_webhook_event_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.billing_webhook_event_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.billing_webhook_event_id_seq TO podverse_app_read;


--
-- Name: TABLE category; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.category TO podverse_app_read_write;
GRANT SELECT ON TABLE public.category TO podverse_app_read;


--
-- Name: SEQUENCE category_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.category_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.category_id_seq TO podverse_app_read;


--
-- Name: TABLE channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel TO podverse_app_read;


--
-- Name: TABLE channel_about; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_about TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_about TO podverse_app_read;


--
-- Name: SEQUENCE channel_about_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_about_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_about_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_category; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_category TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_category TO podverse_app_read;


--
-- Name: SEQUENCE channel_category_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_category_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_category_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_chat; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_chat TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_chat TO podverse_app_read;


--
-- Name: SEQUENCE channel_chat_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_chat_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_chat_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_description; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_description TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_description TO podverse_app_read;


--
-- Name: SEQUENCE channel_description_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_description_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_description_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_funding; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_funding TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_funding TO podverse_app_read;


--
-- Name: SEQUENCE channel_funding_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_funding_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_funding_id_seq TO podverse_app_read;


--
-- Name: SEQUENCE channel_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_image; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_image TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_image TO podverse_app_read;


--
-- Name: SEQUENCE channel_image_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_image_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_image_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_internal_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_internal_settings TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_internal_settings TO podverse_app_read;


--
-- Name: SEQUENCE channel_internal_settings_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_internal_settings_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_internal_settings_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_itunes_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_itunes_type TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_itunes_type TO podverse_app_read;


--
-- Name: SEQUENCE channel_itunes_type_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_itunes_type_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_itunes_type_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_license; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_license TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_license TO podverse_app_read;


--
-- Name: SEQUENCE channel_license_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_license_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_license_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_location; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_location TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_location TO podverse_app_read;


--
-- Name: SEQUENCE channel_location_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_location_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_location_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_merge; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_merge TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_merge TO podverse_app_read;


--
-- Name: SEQUENCE channel_merge_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_merge_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_merge_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_merge_journal; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_merge_journal TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_merge_journal TO podverse_app_read;


--
-- Name: SEQUENCE channel_merge_journal_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_merge_journal_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_merge_journal_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_meta_boost; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_meta_boost TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_meta_boost TO podverse_app_read;


--
-- Name: SEQUENCE channel_meta_boost_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_meta_boost_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_meta_boost_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_person; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_person TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_person TO podverse_app_read;


--
-- Name: SEQUENCE channel_person_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_person_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_person_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_podroll; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_podroll TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_podroll TO podverse_app_read;


--
-- Name: SEQUENCE channel_podroll_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_podroll_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_podroll_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_podroll_remote_item; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_podroll_remote_item TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_podroll_remote_item TO podverse_app_read;


--
-- Name: SEQUENCE channel_podroll_remote_item_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_podroll_remote_item_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_podroll_remote_item_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_publisher; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_publisher TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_publisher TO podverse_app_read;


--
-- Name: SEQUENCE channel_publisher_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_publisher_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_publisher_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_publisher_remote_item; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_publisher_remote_item TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_publisher_remote_item TO podverse_app_read;


--
-- Name: SEQUENCE channel_publisher_remote_item_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_publisher_remote_item_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_publisher_remote_item_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_remote_item; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_remote_item TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_remote_item TO podverse_app_read;


--
-- Name: SEQUENCE channel_remote_item_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_remote_item_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_remote_item_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_season; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_season TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_season TO podverse_app_read;


--
-- Name: SEQUENCE channel_season_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_season_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_season_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_social_interact; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_social_interact TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_social_interact TO podverse_app_read;


--
-- Name: SEQUENCE channel_social_interact_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_social_interact_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_social_interact_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_trailer; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_trailer TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_trailer TO podverse_app_read;


--
-- Name: SEQUENCE channel_trailer_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_trailer_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_trailer_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_txt; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_txt TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_txt TO podverse_app_read;


--
-- Name: SEQUENCE channel_txt_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_txt_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_txt_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_value; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_value TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_value TO podverse_app_read;


--
-- Name: SEQUENCE channel_value_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_value_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_value_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_value_recipient; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_value_recipient TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_value_recipient TO podverse_app_read;


--
-- Name: SEQUENCE channel_value_recipient_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_value_recipient_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_value_recipient_id_seq TO podverse_app_read;


--
-- Name: TABLE channel_verified_publisher; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.channel_verified_publisher TO podverse_app_read_write;
GRANT SELECT ON TABLE public.channel_verified_publisher TO podverse_app_read;


--
-- Name: SEQUENCE channel_verified_publisher_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.channel_verified_publisher_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.channel_verified_publisher_id_seq TO podverse_app_read;


--
-- Name: TABLE clip; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.clip TO podverse_app_read_write;
GRANT SELECT ON TABLE public.clip TO podverse_app_read;


--
-- Name: SEQUENCE clip_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.clip_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.clip_id_seq TO podverse_app_read;


--
-- Name: TABLE embed_demo_showcase; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.embed_demo_showcase TO podverse_app_read_write;
GRANT SELECT ON TABLE public.embed_demo_showcase TO podverse_app_read;


--
-- Name: TABLE feed; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feed TO podverse_app_read_write;
GRANT SELECT ON TABLE public.feed TO podverse_app_read;


--
-- Name: TABLE feed_condition; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feed_condition TO podverse_app_read_write;
GRANT SELECT ON TABLE public.feed_condition TO podverse_app_read;


--
-- Name: SEQUENCE feed_condition_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.feed_condition_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.feed_condition_id_seq TO podverse_app_read;


--
-- Name: TABLE feed_condition_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feed_condition_type TO podverse_app_read_write;
GRANT SELECT ON TABLE public.feed_condition_type TO podverse_app_read;


--
-- Name: SEQUENCE feed_condition_type_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.feed_condition_type_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.feed_condition_type_id_seq TO podverse_app_read;


--
-- Name: SEQUENCE feed_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.feed_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.feed_id_seq TO podverse_app_read;


--
-- Name: TABLE feed_lifecycle_event; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feed_lifecycle_event TO podverse_app_read_write;
GRANT SELECT ON TABLE public.feed_lifecycle_event TO podverse_app_read;


--
-- Name: SEQUENCE feed_lifecycle_event_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.feed_lifecycle_event_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.feed_lifecycle_event_id_seq TO podverse_app_read;


--
-- Name: TABLE feed_lifecycle_state; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feed_lifecycle_state TO podverse_app_read_write;
GRANT SELECT ON TABLE public.feed_lifecycle_state TO podverse_app_read;


--
-- Name: SEQUENCE feed_lifecycle_state_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.feed_lifecycle_state_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.feed_lifecycle_state_id_seq TO podverse_app_read;


--
-- Name: TABLE feed_lifecycle_state_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feed_lifecycle_state_type TO podverse_app_read_write;
GRANT SELECT ON TABLE public.feed_lifecycle_state_type TO podverse_app_read;


--
-- Name: SEQUENCE feed_lifecycle_state_type_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.feed_lifecycle_state_type_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.feed_lifecycle_state_type_id_seq TO podverse_app_read;


--
-- Name: TABLE feed_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feed_log TO podverse_app_read_write;
GRANT SELECT ON TABLE public.feed_log TO podverse_app_read;


--
-- Name: SEQUENCE feed_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.feed_log_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.feed_log_id_seq TO podverse_app_read;


--
-- Name: TABLE feed_policy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feed_policy TO podverse_app_read_write;
GRANT SELECT ON TABLE public.feed_policy TO podverse_app_read;


--
-- Name: SEQUENCE feed_policy_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.feed_policy_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.feed_policy_id_seq TO podverse_app_read;


--
-- Name: TABLE feed_policy_override; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feed_policy_override TO podverse_app_read_write;
GRANT SELECT ON TABLE public.feed_policy_override TO podverse_app_read;


--
-- Name: SEQUENCE feed_policy_override_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.feed_policy_override_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.feed_policy_override_id_seq TO podverse_app_read;


--
-- Name: TABLE feed_takedown_reason; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feed_takedown_reason TO podverse_app_read_write;
GRANT SELECT ON TABLE public.feed_takedown_reason TO podverse_app_read;


--
-- Name: SEQUENCE feed_takedown_reason_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.feed_takedown_reason_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.feed_takedown_reason_id_seq TO podverse_app_read;


--
-- Name: TABLE image_shrink_source; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.image_shrink_source TO podverse_app_read_write;
GRANT SELECT ON TABLE public.image_shrink_source TO podverse_app_read;


--
-- Name: SEQUENCE image_shrink_source_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.image_shrink_source_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.image_shrink_source_id_seq TO podverse_app_read;


--
-- Name: TABLE item; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item TO podverse_app_read;


--
-- Name: TABLE item_about; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_about TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_about TO podverse_app_read;


--
-- Name: SEQUENCE item_about_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_about_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_about_id_seq TO podverse_app_read;


--
-- Name: TABLE item_chapter; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_chapter TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_chapter TO podverse_app_read;


--
-- Name: SEQUENCE item_chapter_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_chapter_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_chapter_id_seq TO podverse_app_read;


--
-- Name: TABLE item_chapter_location; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_chapter_location TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_chapter_location TO podverse_app_read;


--
-- Name: SEQUENCE item_chapter_location_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_chapter_location_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_chapter_location_id_seq TO podverse_app_read;


--
-- Name: TABLE item_chapters_feed; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_chapters_feed TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_chapters_feed TO podverse_app_read;


--
-- Name: SEQUENCE item_chapters_feed_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_chapters_feed_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_chapters_feed_id_seq TO podverse_app_read;


--
-- Name: TABLE item_chapters_feed_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_chapters_feed_log TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_chapters_feed_log TO podverse_app_read;


--
-- Name: SEQUENCE item_chapters_feed_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_chapters_feed_log_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_chapters_feed_log_id_seq TO podverse_app_read;


--
-- Name: TABLE item_chapters_object; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_chapters_object TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_chapters_object TO podverse_app_read;


--
-- Name: SEQUENCE item_chapters_object_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_chapters_object_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_chapters_object_id_seq TO podverse_app_read;


--
-- Name: TABLE item_chat; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_chat TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_chat TO podverse_app_read;


--
-- Name: SEQUENCE item_chat_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_chat_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_chat_id_seq TO podverse_app_read;


--
-- Name: TABLE item_content_link; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_content_link TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_content_link TO podverse_app_read;


--
-- Name: SEQUENCE item_content_link_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_content_link_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_content_link_id_seq TO podverse_app_read;


--
-- Name: TABLE item_description; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_description TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_description TO podverse_app_read;


--
-- Name: SEQUENCE item_description_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_description_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_description_id_seq TO podverse_app_read;


--
-- Name: TABLE item_enclosure; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_enclosure TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_enclosure TO podverse_app_read;


--
-- Name: SEQUENCE item_enclosure_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_enclosure_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_enclosure_id_seq TO podverse_app_read;


--
-- Name: TABLE item_enclosure_integrity; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_enclosure_integrity TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_enclosure_integrity TO podverse_app_read;


--
-- Name: SEQUENCE item_enclosure_integrity_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_enclosure_integrity_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_enclosure_integrity_id_seq TO podverse_app_read;


--
-- Name: TABLE item_enclosure_source; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_enclosure_source TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_enclosure_source TO podverse_app_read;


--
-- Name: SEQUENCE item_enclosure_source_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_enclosure_source_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_enclosure_source_id_seq TO podverse_app_read;


--
-- Name: TABLE item_flag_status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_flag_status TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_flag_status TO podverse_app_read;


--
-- Name: SEQUENCE item_flag_status_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_flag_status_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_flag_status_id_seq TO podverse_app_read;


--
-- Name: TABLE item_funding; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_funding TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_funding TO podverse_app_read;


--
-- Name: SEQUENCE item_funding_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_funding_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_funding_id_seq TO podverse_app_read;


--
-- Name: SEQUENCE item_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_id_seq TO podverse_app_read;


--
-- Name: TABLE item_image; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_image TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_image TO podverse_app_read;


--
-- Name: SEQUENCE item_image_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_image_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_image_id_seq TO podverse_app_read;


--
-- Name: TABLE item_itunes_episode_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_itunes_episode_type TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_itunes_episode_type TO podverse_app_read;


--
-- Name: SEQUENCE item_itunes_episode_type_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_itunes_episode_type_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_itunes_episode_type_id_seq TO podverse_app_read;


--
-- Name: TABLE item_license; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_license TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_license TO podverse_app_read;


--
-- Name: SEQUENCE item_license_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_license_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_license_id_seq TO podverse_app_read;


--
-- Name: TABLE item_location; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_location TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_location TO podverse_app_read;


--
-- Name: SEQUENCE item_location_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_location_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_location_id_seq TO podverse_app_read;


--
-- Name: TABLE item_merge_map; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_merge_map TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_merge_map TO podverse_app_read;


--
-- Name: SEQUENCE item_merge_map_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_merge_map_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_merge_map_id_seq TO podverse_app_read;


--
-- Name: TABLE item_person; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_person TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_person TO podverse_app_read;


--
-- Name: SEQUENCE item_person_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_person_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_person_id_seq TO podverse_app_read;


--
-- Name: TABLE item_season; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_season TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_season TO podverse_app_read;


--
-- Name: TABLE item_season_episode; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_season_episode TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_season_episode TO podverse_app_read;


--
-- Name: SEQUENCE item_season_episode_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_season_episode_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_season_episode_id_seq TO podverse_app_read;


--
-- Name: SEQUENCE item_season_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_season_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_season_id_seq TO podverse_app_read;


--
-- Name: TABLE item_social_interact; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_social_interact TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_social_interact TO podverse_app_read;


--
-- Name: SEQUENCE item_social_interact_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_social_interact_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_social_interact_id_seq TO podverse_app_read;


--
-- Name: TABLE item_soundbite; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_soundbite TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_soundbite TO podverse_app_read;


--
-- Name: SEQUENCE item_soundbite_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_soundbite_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_soundbite_id_seq TO podverse_app_read;


--
-- Name: TABLE item_transcript; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_transcript TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_transcript TO podverse_app_read;


--
-- Name: SEQUENCE item_transcript_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_transcript_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_transcript_id_seq TO podverse_app_read;


--
-- Name: TABLE item_txt; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_txt TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_txt TO podverse_app_read;


--
-- Name: SEQUENCE item_txt_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_txt_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_txt_id_seq TO podverse_app_read;


--
-- Name: TABLE item_value; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_value TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_value TO podverse_app_read;


--
-- Name: SEQUENCE item_value_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_value_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_value_id_seq TO podverse_app_read;


--
-- Name: TABLE item_value_recipient; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_value_recipient TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_value_recipient TO podverse_app_read;


--
-- Name: SEQUENCE item_value_recipient_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_value_recipient_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_value_recipient_id_seq TO podverse_app_read;


--
-- Name: TABLE item_value_time_split; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_value_time_split TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_value_time_split TO podverse_app_read;


--
-- Name: SEQUENCE item_value_time_split_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_value_time_split_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_value_time_split_id_seq TO podverse_app_read;


--
-- Name: TABLE item_value_time_split_recipient; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_value_time_split_recipient TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_value_time_split_recipient TO podverse_app_read;


--
-- Name: SEQUENCE item_value_time_split_recipient_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_value_time_split_recipient_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_value_time_split_recipient_id_seq TO podverse_app_read;


--
-- Name: TABLE item_value_time_split_remote_item; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.item_value_time_split_remote_item TO podverse_app_read_write;
GRANT SELECT ON TABLE public.item_value_time_split_remote_item TO podverse_app_read;


--
-- Name: SEQUENCE item_value_time_split_remote_item_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.item_value_time_split_remote_item_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.item_value_time_split_remote_item_id_seq TO podverse_app_read;


--
-- Name: SEQUENCE linear_migration_history_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.linear_migration_history_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.linear_migration_history_id_seq TO podverse_app_read;


--
-- Name: TABLE live_item; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.live_item TO podverse_app_read_write;
GRANT SELECT ON TABLE public.live_item TO podverse_app_read;


--
-- Name: SEQUENCE live_item_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.live_item_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.live_item_id_seq TO podverse_app_read;


--
-- Name: TABLE live_item_status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.live_item_status TO podverse_app_read_write;
GRANT SELECT ON TABLE public.live_item_status TO podverse_app_read;


--
-- Name: SEQUENCE live_item_status_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.live_item_status_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.live_item_status_id_seq TO podverse_app_read;


--
-- Name: TABLE medium; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.medium TO podverse_app_read_write;
GRANT SELECT ON TABLE public.medium TO podverse_app_read;


--
-- Name: SEQUENCE medium_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.medium_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.medium_id_seq TO podverse_app_read;


--
-- Name: TABLE membership_claim_token; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.membership_claim_token TO podverse_app_read_write;
GRANT SELECT ON TABLE public.membership_claim_token TO podverse_app_read;


--
-- Name: TABLE on_demand_parser_event; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.on_demand_parser_event TO podverse_app_read_write;
GRANT SELECT ON TABLE public.on_demand_parser_event TO podverse_app_read;


--
-- Name: SEQUENCE on_demand_parser_event_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.on_demand_parser_event_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.on_demand_parser_event_id_seq TO podverse_app_read;


--
-- Name: TABLE playlist; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.playlist TO podverse_app_read_write;
GRANT SELECT ON TABLE public.playlist TO podverse_app_read;


--
-- Name: SEQUENCE playlist_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.playlist_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.playlist_id_seq TO podverse_app_read;


--
-- Name: TABLE playlist_resource; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.playlist_resource TO podverse_app_read_write;
GRANT SELECT ON TABLE public.playlist_resource TO podverse_app_read;


--
-- Name: SEQUENCE playlist_resource_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.playlist_resource_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.playlist_resource_id_seq TO podverse_app_read;


--
-- Name: TABLE podcast_index_dead_feed_sync; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.podcast_index_dead_feed_sync TO podverse_app_read_write;
GRANT SELECT ON TABLE public.podcast_index_dead_feed_sync TO podverse_app_read;


--
-- Name: TABLE product_membership_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_membership_settings TO podverse_app_read_write;
GRANT SELECT ON TABLE public.product_membership_settings TO podverse_app_read;


--
-- Name: TABLE queue; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.queue TO podverse_app_read_write;
GRANT SELECT ON TABLE public.queue TO podverse_app_read;


--
-- Name: SEQUENCE queue_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.queue_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.queue_id_seq TO podverse_app_read;


--
-- Name: TABLE queue_resource; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.queue_resource TO podverse_app_read_write;
GRANT SELECT ON TABLE public.queue_resource TO podverse_app_read;


--
-- Name: SEQUENCE queue_resource_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.queue_resource_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.queue_resource_id_seq TO podverse_app_read;


--
-- Name: TABLE scheduled_job; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.scheduled_job TO podverse_app_read_write;
GRANT SELECT ON TABLE public.scheduled_job TO podverse_app_read;


--
-- Name: SEQUENCE scheduled_job_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.scheduled_job_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.scheduled_job_id_seq TO podverse_app_read;


--
-- Name: TABLE sharable_status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sharable_status TO podverse_app_read_write;
GRANT SELECT ON TABLE public.sharable_status TO podverse_app_read;


--
-- Name: SEQUENCE sharable_status_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.sharable_status_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.sharable_status_id_seq TO podverse_app_read;


--
-- Name: TABLE stats_daily_account; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_daily_account TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_daily_account TO podverse_app_read;


--
-- Name: TABLE stats_daily_channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_daily_channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_daily_channel TO podverse_app_read;


--
-- Name: TABLE stats_daily_clip; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_daily_clip TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_daily_clip TO podverse_app_read;


--
-- Name: TABLE stats_daily_item; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_daily_item TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_daily_item TO podverse_app_read;


--
-- Name: TABLE stats_daily_playlist; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_daily_playlist TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_daily_playlist TO podverse_app_read;


--
-- Name: TABLE stats_flag_signal; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_flag_signal TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_flag_signal TO podverse_app_read;


--
-- Name: TABLE stats_flagged_listener; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_flagged_listener TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_flagged_listener TO podverse_app_read;


--
-- Name: SEQUENCE stats_flagged_listener_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.stats_flagged_listener_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.stats_flagged_listener_id_seq TO podverse_app_read;


--
-- Name: TABLE stats_listen_event; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_listen_event TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_listen_event TO podverse_app_read;


--
-- Name: SEQUENCE stats_listen_event_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.stats_listen_event_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.stats_listen_event_id_seq TO podverse_app_read;


--
-- Name: TABLE stats_listen_event_default; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_listen_event_default TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_listen_event_default TO podverse_app_read;


--
-- Name: TABLE stats_open_event; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_open_event TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_open_event TO podverse_app_read;


--
-- Name: SEQUENCE stats_open_event_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.stats_open_event_id_seq TO podverse_app_read_write;
GRANT SELECT ON SEQUENCE public.stats_open_event_id_seq TO podverse_app_read;


--
-- Name: TABLE stats_open_event_default; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_open_event_default TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_open_event_default TO podverse_app_read;


--
-- Name: TABLE stats_popularity_account; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_popularity_account TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_popularity_account TO podverse_app_read;


--
-- Name: TABLE stats_popularity_channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_popularity_channel TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_popularity_channel TO podverse_app_read;


--
-- Name: TABLE stats_popularity_clip; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_popularity_clip TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_popularity_clip TO podverse_app_read;


--
-- Name: TABLE stats_popularity_item; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_popularity_item TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_popularity_item TO podverse_app_read;


--
-- Name: TABLE stats_popularity_playlist; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_popularity_playlist TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_popularity_playlist TO podverse_app_read;


--
-- Name: TABLE stats_taste_profile; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_taste_profile TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_taste_profile TO podverse_app_read;


--
-- Name: TABLE stats_taste_profile_hidden; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats_taste_profile_hidden TO podverse_app_read_write;
GRANT SELECT ON TABLE public.stats_taste_profile_hidden TO podverse_app_read;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE podverse_app_migrator IN SCHEMA public GRANT ALL ON SEQUENCES TO podverse_app_read_write;
ALTER DEFAULT PRIVILEGES FOR ROLE podverse_app_migrator IN SCHEMA public GRANT SELECT ON SEQUENCES TO podverse_app_read;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE podverse_app_migrator IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO podverse_app_read_write;
ALTER DEFAULT PRIVILEGES FOR ROLE podverse_app_migrator IN SCHEMA public GRANT SELECT ON TABLES TO podverse_app_read;


--
-- PostgreSQL database dump complete
--



