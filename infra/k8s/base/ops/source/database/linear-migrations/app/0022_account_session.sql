-- One row per login on one client. A token names its row by id_text; a revoked or idle-expired
-- row fails the request that carries it. Revoked rows stay until idle_expires_at plus the purge
-- retention, so a device that returns within its idle limit is told why it was signed out.
CREATE TABLE public.account_session (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_text public.nano_id_v2 NOT NULL,
    account_id integer NOT NULL,
    client_type varchar(16) NOT NULL,
    device_label public.varchar_normal,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    idle_expires_at timestamp with time zone NOT NULL,
    refresh_token_hash varchar(64),
    previous_refresh_token_hash varchar(64),
    revoked_at timestamp with time zone,
    revoked_reason varchar(32),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_session_id_text_key UNIQUE (id_text),
    CONSTRAINT account_session_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE,
    CONSTRAINT account_session_client_type_check
        CHECK (client_type IN ('web', 'mobile')),
    CONSTRAINT account_session_revoked_reason_check
        CHECK (
            revoked_reason IS NULL
            OR revoked_reason IN (
                'signed_out',
                'signed_out_elsewhere',
                'password_changed',
                'admin_password_set',
                'admin_force_logout',
                'refresh_reuse'
            )
        ),
    CONSTRAINT account_session_revoked_pair_check
        CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);

CREATE INDEX account_session_account_active_idx
    ON public.account_session (account_id, last_seen_at DESC)
    WHERE revoked_at IS NULL;

CREATE INDEX account_session_idle_expires_at_idx
    ON public.account_session (idle_expires_at);

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.account_session TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_session TO podverse_app_read;
