CREATE TABLE workers (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE admins (id uuid PRIMARY KEY, username text UNIQUE NOT NULL, password_hash text NOT NULL);
CREATE TABLE sessions (
    token_hash text PRIMARY KEY, actor_id uuid NOT NULL,
    role text NOT NULL CHECK(role IN ('worker','admin')), expires_at timestamptz NOT NULL
);
CREATE TABLE stores (code text PRIMARY KEY, name text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE totes (
    code text PRIMARY KEY CHECK(code ~ '^HDC[0-9]{6}$'),
    status text NOT NULL DEFAULT 'READY' CHECK(status IN ('READY','AT_STORE','RETURNED')),
    store_code text REFERENCES stores(code), store_name text,
    version integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((status='READY' AND store_code IS NULL AND store_name IS NULL)
        OR (status IN ('AT_STORE','RETURNED') AND store_code IS NOT NULL AND store_name IS NOT NULL))
);
CREATE TABLE tote_events (
    id uuid PRIMARY KEY, tote_code text NOT NULL REFERENCES totes(code),
    action text NOT NULL CHECK(action IN ('REGISTER','DISPATCH','RETURN','RESET')),
    from_status text, to_status text NOT NULL,
    store_code text, store_name text, worker_name text NOT NULL,
    note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
    request_id uuid UNIQUE NOT NULL, request_payload jsonb NOT NULL
);
CREATE INDEX tote_events_timeline ON tote_events(tote_code, created_at DESC);
CREATE INDEX totes_status ON totes(status, updated_at DESC);
