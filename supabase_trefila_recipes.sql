
-- Create table for Trefila Recipes
CREATE TABLE IF NOT EXISTS trefila_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT,
    entry_diameter NUMERIC,
    final_diameter NUMERIC,
    passes INTEGER,
    pass_diameters JSONB, -- Array of numbers
    pass_rings JSONB,     -- Array of {entry, output} objects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE trefila_recipes ENABLE ROW LEVEL SECURITY;

-- Create policy for full access (public for now, or authenticated if user prefers)
CREATE POLICY "Public access to recipes" ON trefila_recipes
    FOR ALL USING (true) WITH CHECK (true);
