-- Alterar Constraints para DELETE CASCADE nas tabelas dependentes

-- Evaluations
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_employee_id_fkey;
ALTER TABLE public.evaluations ADD CONSTRAINT evaluations_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Achievements (se houver link)
-- Verificar se achievements tem employee_id, se tiver:
-- ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_employee_id_fkey;
-- ALTER TABLE public.achievements ADD CONSTRAINT achievements_employee_id_fkey 
--    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Employee Responsibilities
ALTER TABLE public.employee_responsibilities DROP CONSTRAINT IF EXISTS employee_responsibilities_employee_id_fkey;
ALTER TABLE public.employee_responsibilities ADD CONSTRAINT employee_responsibilities_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Employee Courses
ALTER TABLE public.employee_courses DROP CONSTRAINT IF EXISTS employee_courses_employee_id_fkey;
ALTER TABLE public.employee_courses ADD CONSTRAINT employee_courses_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Employee Absences
ALTER TABLE public.employee_absences DROP CONSTRAINT IF EXISTS employee_absences_employee_id_fkey;
ALTER TABLE public.employee_absences ADD CONSTRAINT employee_absences_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Employee Vacations
ALTER TABLE public.employee_vacations DROP CONSTRAINT IF EXISTS employee_vacations_employee_id_fkey;
ALTER TABLE public.employee_vacations ADD CONSTRAINT employee_vacations_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Manager Reference (Self Reference) - Definir para NULL se o gerente for deletado
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_manager_id_fkey;
ALTER TABLE public.employees ADD CONSTRAINT employees_manager_id_fkey 
    FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;
