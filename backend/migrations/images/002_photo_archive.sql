CREATE TABLE archived_photos (
 archive_id uuid PRIMARY KEY, photo_id uuid NOT NULL, tote_code text NOT NULL, slot smallint NOT NULL,
 content bytea NOT NULL, sha256 text NOT NULL, truck_registration text, store_code text,
 uploaded_at timestamptz NOT NULL, archived_at timestamptz NOT NULL DEFAULT now(), actor_name text NOT NULL
);
CREATE INDEX archived_photos_search ON archived_photos(tote_code,archived_at DESC);
