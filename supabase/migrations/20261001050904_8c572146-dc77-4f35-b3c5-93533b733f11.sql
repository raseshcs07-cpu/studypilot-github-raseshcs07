
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  daily_study_hours numeric NOT NULL DEFAULT 2,
  preferred_time text NOT NULL DEFAULT 'evening' CHECK (preferred_time IN ('morning','evening','night')),
  weekly_off_day text NOT NULL DEFAULT 'sunday' CHECK (weekly_off_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  difficulty int NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  priority int NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  basics_level text NOT NULL DEFAULT 'beginner' CHECK (basics_level IN ('beginner','intermediate','strong')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subjects" ON public.subjects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  is_basic boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','done')),
  estimated_hours numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own topics" ON public.topics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('mid','end')),
  exam_date date NOT NULL,
  syllabus_topics text NOT NULL DEFAULT '',
  target_marks numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own exams" ON public.exams FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  date date NOT NULL,
  start_time text NOT NULL DEFAULT '18:00',
  end_time text NOT NULL DEFAULT '19:00',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','missed')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO authenticated;
GRANT ALL ON public.study_sessions TO service_role;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON public.study_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
