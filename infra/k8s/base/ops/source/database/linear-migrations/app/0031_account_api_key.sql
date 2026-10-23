-- One row per API key. The token is shown once at creation; the row keeps only its SHA-256 hash
-- and its last four characters. Revoking a key deletes its row. Deleting the account deletes its
-- keys.
CREATE TABLE public.account_api_key (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_text public.nano_id_v2 NOT NULL,
    account_id integer NOT NULL,
    name public.varchar_short NOT NULL,
    token_hash varchar(64) NOT NULL,
    token_hint varchar(4) NOT NULL,
    permissions jsonb NOT NULL,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_api_key_id_text_key UNIQUE (id_text),
    CONSTRAINT account_api_key_token_hash_key UNIQUE (token_hash),
    CONSTRAINT account_api_key_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE,
    CONSTRAINT account_api_key_name_check CHECK (btrim(name) <> ''),
    CONSTRAINT account_api_key_permissions_check CHECK (jsonb_typeof(permissions) = 'object')
);

CREATE INDEX account_api_key_account_created_idx
    ON public.account_api_key (account_id, created_at DESC);

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.account_api_key TO podverse_app_read_write;
GRANT SELECT ON TABLE public.account_api_key TO podverse_app_read;
