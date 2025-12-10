-- Create table for Spare Parts
CREATE TABLE IF NOT EXISTS spare_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    model TEXT NOT NULL,
    machine TEXT NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    location TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for Part Usage History
CREATE TABLE IF NOT EXISTS part_usage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID REFERENCES spare_parts(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quantity INTEGER NOT NULL,
    machine TEXT,
    reason TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies (simple permissive)
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_usage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for users" ON spare_parts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for users" ON part_usage_history FOR ALL USING (true) WITH CHECK (true);
