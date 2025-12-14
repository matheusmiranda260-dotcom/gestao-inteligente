-- Add attachment columns to employee_absences table
ALTER TABLE employee_absences 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- (Optional) If we wanted to track original filename too, but URL is enough for now.
-- ADD COLUMN IF NOT EXISTS attachment_name TEXT;
