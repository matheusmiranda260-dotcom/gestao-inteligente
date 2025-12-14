-- Link App Users to Employees (Corrected Type)
ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS employee_id TEXT REFERENCES employees(id);
