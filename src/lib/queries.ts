import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Exam, Profile, StudySession, Subject, Topic } from "./types";

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not signed in");
  return data.session.user.id;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const userId = await uid();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as Profile;
      const { data: created, error: insErr } = await supabase
        .from("profiles")
        .insert({ user_id: userId })
        .select()
        .single();
      if (insErr) throw insErr;
      return created as Profile;
    },
  });
}

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async (): Promise<Subject[]> => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });
}

export function useTopics() {
  return useQuery({
    queryKey: ["topics"],
    queryFn: async (): Promise<Topic[]> => {
      const { data, error } = await supabase
        .from("topics")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Topic[];
    },
  });
}

export function useExams() {
  return useQuery({
    queryKey: ["exams"],
    queryFn: async (): Promise<Exam[]> => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .order("exam_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Exam[];
    },
  });
}

export function useSessions(from?: string, to?: string) {
  return useQuery({
    queryKey: ["sessions", from ?? "all", to ?? ""],
    queryFn: async (): Promise<StudySession[]> => {
      let q = supabase
        .from("study_sessions")
        .select("*")
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as StudySession[];
    },
  });
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
