-- Link App Users to Employees
ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id);
