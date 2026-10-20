-- Add by RSS feed identity: an episode's add_by_rss_hash_id is the MD5 of the JSON
-- {"feed_url":…,"guid":…} (or "enclosure_url" when the guid is missing or device-local), so the
-- same episode has the same id on every device. These functions reproduce
-- extractAddByRSSHashInput and getMd5Hash in packages/helpers/src/lib/addByRSSHash.ts byte for
-- byte; a DB-backed API test checks parity.

-- String.prototype.trim: ECMAScript WhiteSpace and LineTerminator code points.
CREATE FUNCTION public.add_by_rss_js_trim(value text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT btrim(
    value,
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
  )
$$;

-- Keys in insertion order, values escaped as JSON.stringify escapes strings.
CREATE FUNCTION public.add_by_rss_hash_id_from_feed(feed_url text, guid text, enclosure_url text)
    RETURNS text
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

-- isDeviceLocalAddByRSSGuid: the device's channel id, a hyphen, then digits only.
CREATE FUNCTION public.add_by_rss_is_device_local_guid(guid text, channel_id_text text)
    RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
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
$$;

-- The feed-form hash for a stored payload, or NULL when it has no feed_url.
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

-- Rows that would share a feed-form hash in one queue: keep the one closest to now-playing, then
-- the furthest playback position, then the newest row.
DELETE FROM public.queue_resource AS qr
USING (
    SELECT
        rehashed.id,
        row_number() OVER (
            PARTITION BY rehashed.queue_id, rehashed.new_hash
            ORDER BY
                abs(rehashed.list_position) ASC,
                rehashed.playback_position DESC,
                rehashed.id DESC
        ) AS keep_rank
    FROM (
        SELECT
            id,
            queue_id,
            list_position,
            playback_position,
            public.add_by_rss_hash_id_from_resource_data(add_by_rss_resource_data) AS new_hash
        FROM public.queue_resource
        WHERE add_by_rss_resource_data IS NOT NULL
    ) AS rehashed
    WHERE rehashed.new_hash IS NOT NULL
) AS ranked
WHERE qr.id = ranked.id
  AND ranked.keep_rank > 1;

UPDATE public.queue_resource
SET add_by_rss_hash_id = public.add_by_rss_hash_id_from_resource_data(add_by_rss_resource_data)
WHERE add_by_rss_resource_data IS NOT NULL
  AND public.add_by_rss_hash_id_from_resource_data(add_by_rss_resource_data) IS NOT NULL
  AND add_by_rss_hash_id IS DISTINCT FROM
      public.add_by_rss_hash_id_from_resource_data(add_by_rss_resource_data);

-- Same for playlists: keep the entry nearest the top, and lower item_count by what was removed.
WITH removed AS (
    DELETE FROM public.playlist_resource AS pr
    USING (
        SELECT
            rehashed.id,
            row_number() OVER (
                PARTITION BY rehashed.playlist_id, rehashed.new_hash
                ORDER BY rehashed.list_position ASC, rehashed.id ASC
            ) AS keep_rank
        FROM (
            SELECT
                id,
                playlist_id,
                list_position,
                public.add_by_rss_hash_id_from_resource_data(add_by_rss_resource_data) AS new_hash
            FROM public.playlist_resource
            WHERE add_by_rss_resource_data IS NOT NULL
        ) AS rehashed
        WHERE rehashed.new_hash IS NOT NULL
    ) AS ranked
    WHERE pr.id = ranked.id
      AND ranked.keep_rank > 1
    RETURNING pr.playlist_id
)
UPDATE public.playlist AS p
SET item_count = GREATEST(COALESCE(p.item_count, 0) - removed_counts.removed_count, 0)
FROM (
    SELECT playlist_id, count(*)::integer AS removed_count
    FROM removed
    GROUP BY playlist_id
) AS removed_counts
WHERE p.id = removed_counts.playlist_id;

UPDATE public.playlist_resource
SET add_by_rss_hash_id = public.add_by_rss_hash_id_from_resource_data(add_by_rss_resource_data)
WHERE add_by_rss_resource_data IS NOT NULL
  AND public.add_by_rss_hash_id_from_resource_data(add_by_rss_resource_data) IS NOT NULL
  AND add_by_rss_hash_id IS DISTINCT FROM
      public.add_by_rss_hash_id_from_resource_data(add_by_rss_resource_data);
