ALTER TABLE totes DROP CONSTRAINT totes_check;
ALTER TABLE totes ADD CONSTRAINT totes_check CHECK (
    (status='READY' AND store_code IS NULL AND store_name IS NULL)
    OR (status IN ('AT_STORE','RETURNED') AND (store_code IS NULL OR store_name IS NOT NULL))
);
