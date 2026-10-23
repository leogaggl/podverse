-- Per-notification read state, alongside account.notifications_last_read_at.
--
-- A notification is unread when it was created after the account's Mark All as Read cutoff and its
-- read_at is null. Opening one notification sets read_at on that row only. Mark All as Read moves
-- the cutoff and leaves read_at alone, because every row at or before the cutoff already reads as
-- read.
--
-- The state lives on the row because each notification row already belongs to one account. The
-- purge job deletes a row together with its read state.

ALTER TABLE public.account_notification
    ADD COLUMN read_at timestamp with time zone;
