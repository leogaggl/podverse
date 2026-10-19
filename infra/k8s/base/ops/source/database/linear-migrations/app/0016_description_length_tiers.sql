-- Per-feed description length tier and truncation telemetry. Tier keys and limits live in
-- @podverse/helpers descriptionLimits; null means the default tier.

ALTER TABLE public.feed ADD COLUMN description_length_tier_override varchar(16);

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_description_length_tier_override_check
    CHECK (
        description_length_tier_override IS NULL
        OR description_length_tier_override IN ('standard', 'extended', 'maximum')
    );

ALTER TABLE public.feed ADD COLUMN description_truncated_count integer DEFAULT 0 NOT NULL;
ALTER TABLE public.feed ADD COLUMN description_longest_source_length integer;
ALTER TABLE public.feed ADD COLUMN description_truncated_at timestamp without time zone;

CREATE INDEX feed_description_truncated_idx
    ON public.feed (description_longest_source_length DESC)
    WHERE description_truncated_count > 0;

ALTER TABLE public.item_description ALTER COLUMN value TYPE text;
ALTER TABLE ONLY public.item_description
    ADD CONSTRAINT item_description_value_length_check
    CHECK (char_length(value) <= 150000) NOT VALID;
ALTER TABLE public.item_description VALIDATE CONSTRAINT item_description_value_length_check;
ALTER TABLE public.item_description ADD COLUMN preview varchar(400);
ALTER TABLE public.item_description ADD COLUMN is_truncated boolean DEFAULT false NOT NULL;
ALTER TABLE public.item_description ADD COLUMN source_length integer;

ALTER TABLE public.channel_description ALTER COLUMN value TYPE text;
ALTER TABLE ONLY public.channel_description
    ADD CONSTRAINT channel_description_value_length_check
    CHECK (char_length(value) <= 150000) NOT VALID;
ALTER TABLE public.channel_description VALIDATE CONSTRAINT channel_description_value_length_check;
ALTER TABLE public.channel_description ADD COLUMN preview varchar(400);
ALTER TABLE public.channel_description ADD COLUMN is_truncated boolean DEFAULT false NOT NULL;
ALTER TABLE public.channel_description ADD COLUMN source_length integer;
