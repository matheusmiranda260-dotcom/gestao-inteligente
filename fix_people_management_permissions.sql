-- Enable RLS and add policies for People Management tables to ensure data is accessible
-- These policies allow the application (using the anon key) to Read/Write data.
-- Access control is handled by the Application Logic (App.tsx and PeopleManagement.tsx).

-- 1. Employee Courses
ALTER TABLE employee_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON employee_courses;
CREATE POLICY "Enable all access" ON employee_courses FOR ALL USING (true) WITH CHECK (true);

-- 2. Evaluations
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON evaluations;
CREATE POLICY "Enable all access" ON evaluations FOR ALL USING (true) WITH CHECK (true);

-- 3. Employee Absences
ALTER TABLE employee_absences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON employee_absences;
CREATE POLICY "Enable all access" ON employee_absences FOR ALL USING (true) WITH CHECK (true);

-- 4. Employee Vacations
ALTER TABLE employee_vacations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON employee_vacations;
CREATE POLICY "Enable all access" ON employee_vacations FOR ALL USING (true) WITH CHECK (true);

-- 5. Employee Responsibilities
ALTER TABLE employee_responsibilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON employee_responsibilities;
CREATE POLICY "Enable all access" ON employee_responsibilities FOR ALL USING (true) WITH CHECK (true);

-- 6. Employee Documents
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON employee_documents;
CREATE POLICY "Enable all access" ON employee_documents FOR ALL USING (true) WITH CHECK (true);
