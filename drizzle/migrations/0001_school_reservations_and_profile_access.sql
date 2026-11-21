DROP POLICY "School admins can view account directory" ON public.profiles;
CREATE OR REPLACE FUNCTION public.is_related_school_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT _user_id = auth.uid() OR public.is_school_admin() OR EXISTS (SELECT 1 FROM public.teacher_students ts WHERE (ts.teacher_id = auth.uid() AND ts.student_id = _user_id) OR (ts.student_id = auth.uid() AND ts.teacher_id = _user_id)) $$;
CREATE POLICY "Users and connected school members view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_related_school_user(user_id));
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT INSERT (user_id, daily_study_hours, preferred_time, weekly_off_day) ON public.profiles TO authenticated;
GRANT UPDATE (daily_study_hours, preferred_time, weekly_off_day) ON public.profiles TO authenticated;

CREATE TABLE public.reservable_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('room','equipment','library_book','study_slot')),
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservable_resources TO authenticated;
GRANT ALL ON public.reservable_resources TO service_role;
ALTER TABLE public.reservable_resources ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.resource_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.reservable_resources(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','declined','cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_reservations TO authenticated;
GRANT ALL ON public.resource_reservations TO service_role;
ALTER TABLE public.resource_reservations ENABLE ROW LEVEL SECURITY;
CREATE INDEX reservable_resources_teacher_idx ON public.reservable_resources(teacher_id, category, created_at DESC);
CREATE INDEX resource_reservations_resource_time_idx ON public.resource_reservations(resource_id, starts_at, ends_at);
CREATE INDEX resource_reservations_student_idx ON public.resource_reservations(student_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_student_reserve_resource(_resource_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT EXISTS (SELECT 1 FROM public.reservable_resources r JOIN public.teacher_students ts ON ts.teacher_id = r.teacher_id WHERE r.id = _resource_id AND r.is_available AND ts.student_id = auth.uid()) $$;
CREATE OR REPLACE FUNCTION public.can_review_reservation(_reservation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT public.is_school_admin() OR EXISTS (SELECT 1 FROM public.resource_reservations rr JOIN public.reservable_resources r ON r.id = rr.resource_id WHERE rr.id = _reservation_id AND r.teacher_id = auth.uid()) $$;
CREATE POLICY "Teachers manage and assigned students view reservable resources" ON public.reservable_resources FOR SELECT TO authenticated USING (teacher_id = auth.uid() OR public.is_school_admin() OR EXISTS (SELECT 1 FROM public.teacher_students ts WHERE ts.teacher_id = reservable_resources.teacher_id AND ts.student_id = auth.uid()));
CREATE POLICY "Teachers add their reservable resources" ON public.reservable_resources FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid() AND public.is_class_teacher(auth.uid()));
CREATE POLICY "Teachers update their reservable resources" ON public.reservable_resources FOR UPDATE TO authenticated USING ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin()) WITH CHECK ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin());
CREATE POLICY "Teachers remove their reservable resources" ON public.reservable_resources FOR DELETE TO authenticated USING ((teacher_id = auth.uid() AND public.is_class_teacher(auth.uid())) OR public.is_school_admin());
CREATE POLICY "Students view their requests; assigned teachers review" ON public.resource_reservations FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.can_review_reservation(id));
CREATE POLICY "Students request assigned classroom resources" ON public.resource_reservations FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid() AND status = 'requested' AND reviewed_by IS NULL AND reviewed_at IS NULL AND public.can_student_reserve_resource(resource_id));
CREATE POLICY "Students cancel pending requests or teachers review" ON public.resource_reservations FOR UPDATE TO authenticated USING ((student_id = auth.uid() AND status = 'requested') OR public.can_review_reservation(id)) WITH CHECK ((student_id = auth.uid() AND status = 'cancelled' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (public.can_review_reservation(id) AND reviewed_by = auth.uid() AND reviewed_at IS NOT NULL AND status IN ('approved','declined')));
CREATE POLICY "Students cancel their requests or admins manage them" ON public.resource_reservations FOR DELETE TO authenticated USING ((student_id = auth.uid() AND status = 'requested') OR public.is_school_admin());