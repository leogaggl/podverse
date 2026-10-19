-- Clips survive episode deletion and keep a minimal removed-source snapshot.
ALTER TABLE public.clip
    ALTER COLUMN item_id DROP NOT NULL;

ALTER TABLE public.clip
    DROP CONSTRAINT clip_item_id_fkey;

ALTER TABLE public.clip
    ADD CONSTRAINT clip_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE SET NULL;

ALTER TABLE public.clip
    ADD COLUMN removed_source jsonb;

ALTER TABLE public.clip
    ADD COLUMN source_removed_at timestamp without time zone;

-- Playlist rows survive episode or soundbite deletion and can carry a removed-source snapshot.
ALTER TABLE public.playlist_resource
    DROP CONSTRAINT playlist_resource_item_id_fkey;

ALTER TABLE public.playlist_resource
    ADD CONSTRAINT playlist_resource_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES public.item(id) ON DELETE SET NULL;

ALTER TABLE public.playlist_resource
    DROP CONSTRAINT playlist_resource_item_soundbite_id_fkey;

ALTER TABLE public.playlist_resource
    ADD CONSTRAINT playlist_resource_item_soundbite_id_fkey
    FOREIGN KEY (item_soundbite_id) REFERENCES public.item_soundbite(id) ON DELETE SET NULL;

ALTER TABLE public.playlist_resource
    ADD COLUMN removed_source jsonb;

ALTER TABLE public.playlist_resource
    ADD COLUMN source_removed_at timestamp without time zone;

ALTER TABLE public.playlist_resource
    DROP CONSTRAINT playlist_resource_check;

ALTER TABLE public.playlist_resource
    ADD CONSTRAINT playlist_resource_check CHECK (
        num_nonnulls(item_id, add_by_rss_hash_id, clip_id, item_soundbite_id) = 1
        OR (
            num_nonnulls(item_id, add_by_rss_hash_id, clip_id, item_soundbite_id) = 0
            AND source_removed_at IS NOT NULL
        )
    );

ALTER TABLE public.channel
    ADD COLUMN follow_conversion_status varchar(16);

-- Metadata-only on current Postgres: constant default plus NOT NULL.
ALTER TABLE public.channel
    ADD COLUMN follow_conversion_attempts smallint DEFAULT 0 NOT NULL;

ALTER TABLE public.channel
    ADD COLUMN follow_conversion_last_attempt_at timestamp without time zone;

ALTER TABLE public.channel
    ADD CONSTRAINT channel_follow_conversion_status_check CHECK (
        follow_conversion_status IS NULL
        OR follow_conversion_status IN ('converted', 'no_followers', 'unreachable', 'skipped')
    );
