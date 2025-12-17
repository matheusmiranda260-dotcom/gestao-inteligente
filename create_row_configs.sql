CREATE TABLE IF NOT EXISTS row_configs (
    row_name TEXT PRIMARY KEY,
    base_size INTEGER NOT NULL DEFAULT 7,
    max_height INTEGER NOT NULL DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE row_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'row_configs' AND policyname = 'Allow all access to row_configs'
    ) THEN
        CREATE POLICY "Allow all access to row_configs" ON row_configs
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
