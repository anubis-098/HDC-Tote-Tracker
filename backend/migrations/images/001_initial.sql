-- Metadata and bytes share one transaction; all photo writes also lock the app DB tote row.
CREATE TABLE photos (
    id uuid PRIMARY KEY, tote_code text NOT NULL,
    slot smallint NOT NULL CHECK(slot BETWEEN 1 AND 6), content bytea NOT NULL,
    sha256 text NOT NULL, byte_size integer NOT NULL,
    worker_name text NOT NULL, uploaded_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tote_code, slot)
);
