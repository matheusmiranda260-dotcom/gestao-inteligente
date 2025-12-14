-- Create Employee Documents Table
CREATE TABLE IF NOT EXISTS employee_documents (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES employees(id),
    title TEXT,
    type TEXT,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

-- Permit Access
DROP POLICY IF EXISTS "Enable all access" ON employee_documents;
CREATE POLICY "Enable all access" ON employee_documents FOR ALL USING (true) WITH CHECK (true);
