export interface Profile {
  id: string;
  user_id: string;
  daily_study_hours: number;
  preferred_time: "morning" | "evening" | "night";
  weekly_off_day: string;
  created_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string;
  difficulty: number;
  priority: number;
  basics_level: "beginner" | "intermediate" | "strong";
  created_at: string;
}

export interface Topic {
  id: string;
  subject_id: string;
  user_id: string;
  title: string;
  is_basic: boolean;
  status: "not_started" | "in_progress" | "done";
  estimated_hours: number;
  created_at: string;
}

export interface Exam {
  id: string;
  user_id: string;
  subject_id: string;
  type: "mid" | "end";
  exam_date: string;
  syllabus_topics: string;
  target_marks: number | null;
  created_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  status: "planned" | "done" | "missed";
  notes: string;
  created_at: string;
}

export const SUBJECT_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
] as const;

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
