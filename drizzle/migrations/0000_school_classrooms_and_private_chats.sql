CREATE TYPE public.app_role AS ENUM ('owner', 'school_admin', 'teacher', 'student');
ALTER TABLE public.profiles ADD COLUMN display_name text;
ALTER TABLE public.profiles ADD COLUMN account_email text;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.teacher_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id),
  CHECK (teacher_id <> student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_students TO authenticated;
GRANT ALL ON public.teacher_students TO service_role;
ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL CHECK (status IN ('present','absent','late','excused')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  due_date date,
  subject text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_assignments TO authenticated;
GRANT ALL ON public.class_assignments TO service_role;
ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.class_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  grade numeric,
  feedback text NOT NULL DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  UNIQUE (assignment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;
GRANT ALL ON public.assignment_submissions TO service_role;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.class_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('note','syllabus','topic','question','answer')),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_resources TO authenticated;
GRANT ALL ON public.class_resources TO service_role;
ALTER TABLE public.class_resources ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX teacher_students_student_idx ON public.teacher_students(student_id);
CREATE INDEX attendance_teacher_date_idx ON public.attendance_records(teacher_id, attendance_date);
CREATE INDEX assignments_teacher_due_idx ON public.class_assignments(teacher_id, due_date);
CREATE INDEX submissions_student_idx ON public.assignment_submissions(student_id);
CREATE INDEX resources_teacher_created_idx ON public.class_resources(teacher_id, created_at DESC);
CREATE INDEX chat_threads_user_updated_idx ON public.chat_threads(user_id, updated_at DESC);
CREATE INDEX chat_messages_thread_created_idx ON public.chat_messages(thread_id, created_at);

CREATE OR REPLACE FUNCTION public.is_school_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'agarwalrasesh96@gmail.com' $$;
CREATE OR REPLACE FUNCTION public.is_school_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT public.is_school_owner() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner','school_admin')) $$;
CREATE OR REPLACE FUNCTION public.is_class_teacher(_teacher_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT public.is_school_admin() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _teacher_id AND role = 'teacher') $$;
CREATE OR REPLACE FUNCTION public.is_assigned_teacher(_student_id uuid, _teacher_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT EXISTS (SELECT 1 FROM public.teacher_students WHERE student_id = _student_id AND teacher_id = _teacher_id) $$;
CREATE OR REPLACE FUNCTION public.is_assignment_teacher(_assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT EXISTS (SELECT 1 FROM public.class_assignments a WHERE a.id = _assignment_id AND (a.teacher_id = auth.uid() OR public.is_school_admin())) $$;
CREATE OR REPLACE FUNCTION public.is_student_assigned_to_assignment(_assignment_id uuid, _student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT EXISTS (SELECT 1 FROM public.class_assignments a JOIN public.teacher_students ts ON ts.teacher_id = a.teacher_id WHERE a.id = _assignment_id AND ts.student_id = _student_id AND a.published) $$;
CREATE OR REPLACE FUNCTION public.is_resource_visible(_resource_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT EXISTS (SELECT 1 FROM public.class_resources r JOIN public.teacher_students ts ON ts.teacher_id = r.teacher_id WHERE r.id = _resource_id AND ts.student_id = auth.uid() AND r.published) $$;

CREATE POLICY "Users see their role; school admins manage classroom roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_school_admin());
CREATE POLICY "Only school owner appoints admins; school admins assign teachers and students" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (role <> 'owner' AND ((role = 'school_admin' AND public.is_school_owner()) OR (role IN ('teacher','student') AND public.is_school_admin())));
CREATE POLICY "School admins update teacher and student roles; owner manages school admins" ON public.user_roles FOR UPDATE TO authenticated USING (role <> 'owner' AND (public.is_school_owner() OR (public.is_school_admin() AND role <> 'school_admin'))) WITH CHECK (role <> 'owner' AND (public.is_school_owner() OR (public.is_school_admin() AND role <> 'school_admin')));
CREATE POLICY "Only school owner may remove administrator roles" ON public.user_roles FOR DELETE TO authenticated USING (role <> 'owner' AND (public.is_school_owner() OR (public.is_school_admin() AND role <> 'school_admin')));

CREATE POLICY "School users see assigned teacher links" ON public.teacher_students FOR SELECT TO authenticated USING (public.is_school_admin() OR teacher_id = auth.uid() OR student_id = auth.uid());
CREATE POLICY "School admins assign teachers and students" ON public.teacher_students FOR INSERT TO authenticated WITH CHECK (public.is_school_admin() AND assigned_by = auth.uid() AND public.is_class_teacher(teacher_id) AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = student_id AND r.role = 'student'));
CREATE POLICY "School admins update teacher and student links" ON public.teacher_students FOR UPDATE TO authenticated USING (public.is_school_admin()) WITH CHECK (public.is_school_admin() AND assigned_by = auth.uid() AND public.is_class_teacher(teacher_id));
CREATE POLICY "School admins remove teacher and student links" ON public.teacher_students FOR DELETE TO authenticated USING (public.is_school_admin());

CREATE POLICY "Students see own attendance; assigned teachers record attendance" ON public.attendance_records FOR SELECT TO authenticated USING (student_id = auth.uid() OR teacher_id = auth.uid() OR public.is_school_admin());
CREATE POLICY "Assigned teachers record attendance" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid() AND public.is_class_teacher(auth.uid()) AND public.is_assigned_teacher(student_id, auth.uid()));
CREATE POLICY "Assigned teachers update attendance" ON public.attendance_records FOR UPDATE TO authenticated USING (teacher_id = auth.uid() AND public.is_assigned_teacher(student_id, auth.uid())) WITH CHECK (teacher_id = auth.uid() AND public.is_assigned_teacher(student_id, auth.uid()));
CREATE POLICY "Assigned teachers delete attendance" ON public.attendance_records FOR DELETE TO authenticated USING (teacher_id = auth.uid() AND public.is_assigned_teacher(student_id, auth.uid()));
CREATE POLICY "School admins manage attendance" ON public.attendance_records FOR ALL TO authenticated USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

CREATE POLICY "Assigned students see published class assignments" ON public.class_assignments FOR SELECT TO authenticated USING ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin() OR (published AND EXISTS (SELECT 1 FROM public.teacher_students ts WHERE ts.teacher_id = class_assignments.teacher_id AND ts.student_id = auth.uid())));
CREATE POLICY "Teachers create own class assignments" ON public.class_assignments FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid() AND public.is_class_teacher(auth.uid()));
CREATE POLICY "Teachers update their assignments" ON public.class_assignments FOR UPDATE TO authenticated USING ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin()) WITH CHECK ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin());
CREATE POLICY "Teachers delete their assignments" ON public.class_assignments FOR DELETE TO authenticated USING ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin());

CREATE POLICY "Students and assigned teachers read submissions" ON public.assignment_submissions FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.is_assignment_teacher(assignment_id) AND public.is_assigned_teacher(student_id, (SELECT teacher_id FROM public.class_assignments WHERE id = assignment_id)));
CREATE POLICY "Students submit their own work" ON public.assignment_submissions FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid() AND public.is_student_assigned_to_assignment(assignment_id, auth.uid()) AND reviewed_at IS NULL AND reviewed_by IS NULL);
CREATE POLICY "Students can revise unreviewed work; assigned teachers can review" ON public.assignment_submissions FOR UPDATE TO authenticated USING ((student_id = auth.uid() AND reviewed_at IS NULL) OR (public.is_assignment_teacher(assignment_id) AND public.is_assigned_teacher(student_id, (SELECT teacher_id FROM public.class_assignments WHERE id = assignment_id)))) WITH CHECK ((student_id = auth.uid() AND reviewed_at IS NULL AND reviewed_by IS NULL) OR (public.is_assignment_teacher(assignment_id) AND reviewed_by = auth.uid() AND reviewed_at IS NOT NULL AND public.is_assigned_teacher(student_id, (SELECT teacher_id FROM public.class_assignments WHERE id = assignment_id))));
CREATE POLICY "School admins manage assignment submissions" ON public.assignment_submissions FOR ALL TO authenticated USING (public.is_school_admin()) WITH CHECK (public.is_school_admin());

CREATE POLICY "Teachers and assigned students read classroom resources" ON public.class_resources FOR SELECT TO authenticated USING ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin() OR public.is_resource_visible(id));
CREATE POLICY "Teachers create their classroom resources" ON public.class_resources FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid() AND public.is_class_teacher(auth.uid()));
CREATE POLICY "Teachers update their classroom resources" ON public.class_resources FOR UPDATE TO authenticated USING ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin()) WITH CHECK ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin());
CREATE POLICY "Teachers remove their classroom resources" ON public.class_resources FOR DELETE TO authenticated USING ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin());

CREATE POLICY "Users manage their own private chat threads" ON public.chat_threads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage messages in their own private chat threads" ON public.chat_messages FOR ALL TO authenticated USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "School admins can view account directory" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_school_admin());

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, CASE WHEN lower(u.email) = 'agarwalrasesh96@gmail.com' THEN 'owner'::public.app_role ELSE 'student'::public.app_role END
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;
UPDATE public.profiles p SET account_email = u.email, display_name = COALESCE(NULLIF(p.display_name, ''), NULLIF(split_part(u.email, '@', 1), 'Student')) FROM auth.users u WHERE u.id = p.user_id AND p.account_email IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, account_email, display_name) VALUES (NEW.id, NEW.email, split_part(COALESCE(NEW.email, 'Student'), '@', 1)) ON CONFLICT (user_id) DO UPDATE SET account_email = EXCLUDED.account_email;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, CASE WHEN lower(NEW.email) = 'agarwalrasesh96@gmail.com' THEN 'owner'::public.app_role ELSE 'student'::public.app_role END) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;