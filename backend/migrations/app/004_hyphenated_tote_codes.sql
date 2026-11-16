ALTER TABLE totes DROP CONSTRAINT totes_code_check;
ALTER TABLE totes ADD CONSTRAINT totes_code_check CHECK(code ~ '^HDC-?[0-9]+$' AND length(code) <= 100);
