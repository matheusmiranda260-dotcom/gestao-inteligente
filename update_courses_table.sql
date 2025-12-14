-- Adds new columns to employee_courses table to support better qualification tracking
ALTER TABLE employee_courses
ADD COLUMN IF NOT EXISTS education_type TEXT DEFAULT 'Curso Livre',
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS workload_hours NUMERIC;
