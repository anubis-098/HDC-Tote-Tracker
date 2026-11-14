ALTER TABLE totes DROP CONSTRAINT totes_code_check;
ALTER TABLE totes ADD CONSTRAINT totes_code_check CHECK(code ~ '^HDC[0-9]+$' AND length(code) <= 100);
ALTER TABLE stores ADD COLUMN deleted_at timestamptz;

-- Reuse existing names across sessions, including any duplicate names from the first version.
WITH duplicates AS (
    SELECT id, first_value(id) OVER (PARTITION BY lower(btrim(name)) ORDER BY id) AS canonical_id
    FROM workers
)
UPDATE sessions s SET actor_id=d.canonical_id FROM duplicates d
WHERE s.role='worker' AND s.actor_id=d.id AND d.id<>d.canonical_id;
WITH duplicates AS (
    SELECT id, row_number() OVER (PARTITION BY lower(btrim(name)) ORDER BY id) AS position
    FROM workers
)
DELETE FROM workers WHERE id IN (SELECT id FROM duplicates WHERE position>1);
CREATE UNIQUE INDEX workers_name_unique ON workers(lower(btrim(name)));
