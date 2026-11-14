-- Transactional outbox: remove business records first, then retry image cleanup safely.
CREATE TABLE photo_cleanup_jobs (
    tote_code text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);
