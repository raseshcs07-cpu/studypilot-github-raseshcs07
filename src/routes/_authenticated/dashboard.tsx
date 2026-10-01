import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Flame, Sparkles, Plus, ArrowRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useSubjects, useExams, useSessions, todayStr } from "@/lib/queries";
import { examCoach } from "@/lib/ai.functions";
import { SUBJECT_COLORS } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — StudyPilot" },
      { name: "description", content: "Today's tasks, exam countdowns, weekly progress, and your study streak." },
      { property: "og:title", content: "Dashboard — StudyPilot" },
      { property: "og:description", content: "Today's tasks, exam countdowns, weekly progress, and your study streak." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - new Date(todayStr() + "T00:00:00").getTime()) / 86400000);
}

function Dashboard() {
  const qc = useQueryClient();
  const { data: subjects = [], isLoading: loadingSubjects } = useSubjects();
  const { data: exams = [] } = useExams();
  const today = todayStr();
  const weekAgo = new Date(Date.now() - 6 * 86400000);
  const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, "0")}-${String(weekAgo.getDate()).padStart(2, "0")}`;
  const { data: sessions = [], isLoading: loadingSessions } = useSessions(weekAgoStr);
  const callCoach = useServerFn(examCoach);
  const [coach, setCoach] = useState<{ tip: string; strategy: string; daysLeft: number } | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const todaysSessions = sessions.filter((s) => s.date === today);
  const upcoming = exams.filter((e) => daysUntil(e.exam_date) >= 0);
  const nextMid = upcoming.find((e) => e.type === "mid");
  const nextEnd = upcoming.find((e) => e.type === "end");

  const streak = useMemo(() => {
    const doneDates = new Set(sessions.filter((s) => s.status === "done").map((s) => s.date));
    let count = 0;
    const d = new Date();
    // today counts only if something done; otherwise start from yesterday
    if (!doneDates.has(todayStr())) d.setDate(d.getDate() - 1);
    for (;;) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (doneDates.has(key)) {
        count++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return count;
  }, [sessions]);

  const chartData = useMemo(() => {
    const days: { day: string; done: number; planned: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const daySessions = sessions.filter((s) => s.date === key);
      days.push({
        day: d.toLocaleDateString(undefined, { weekday: "short" }),
        done: daySessions.filter((s) => s.status === "done").length,
        planned: daySessions.length,
      });
    }
    return days;
  }, [sessions]);

  const setStatus = async (id: string, status: "done" | "missed") => {
    const { error } = await supabase.from("study_sessions").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "done" ? "Session marked done" : "Session marked missed");
      qc.invalidateQueries({ queryKey: ["sessions"] });
    }
  };

  const getCoachTip = async () => {
    const target = nextMid ?? nextEnd;
    if (!target) {
      toast.error("Add an exam first to get coaching");
      return;
    }
    setCoachLoading(true);
    try {
      const result = await callCoach({ data: { examId: target.id } });
      setCoach(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Coach failed");
    } finally {
      setCoachLoading(false);
    }
  };

  const addStarterSubjects = async () => {
    setSeeding(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");
      const starters = [
        { name: "Mathematics", color: SUBJECT_COLORS[0], difficulty: 4, priority: 5, basics_level: "beginner", topics: ["Algebra basics", "Linear equations", "Quadratic equations"] },
        { name: "Physics", color: SUBJECT_COLORS[3], difficulty: 4, priority: 4, basics_level: "beginner", topics: ["Units & measurement", "Motion in a straight line", "Newton's laws"] },
        { name: "English", color: SUBJECT_COLORS[1], difficulty: 2, priority: 3, basics_level: "intermediate", topics: ["Grammar fundamentals", "Reading comprehension"] },
      ];
      for (const st of starters) {
        const { data: subj, error } = await supabase
          .from("subjects")
          .insert({ user_id: userId, name: st.name, color: st.color, difficulty: st.difficulty, priority: st.priority, basics_level: st.basics_level })
          .select()
          .single();
        if (error) throw error;
        const topicRows = st.topics.map((title, i) => ({
          user_id: userId,
          subject_id: subj.id,
          title,
          is_basic: i === 0,
          estimated_hours: 2,
        }));
        const { error: tErr } = await supabase.from("topics").insert(topicRows);
        if (tErr) throw tErr;
      }
      toast.success("Starter subjects added — edit or delete them anytime");
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["topics"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add starters");
    } finally {
      setSeeding(false);
    }
  };

  if (loadingSubjects || loadingSessions) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="badge bg-accent text-accent-foreground">
          <Flame className="mr-1 h-3.5 w-3.5" /> {streak} day streak
        </div>
      </div>

      {subjects.length === 0 && (
        <div className="card border-dashed p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">Welcome to StudyPilot</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Start by adding your subjects — or grab a ready-made starter set you can edit.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button onClick={addStarterSubjects} className="btn-primary" disabled={seeding}>
              <Plus className="h-4 w-4" /> {seeding ? "Adding…" : "Add starter subjects"}
            </button>
            <Link to="/subjects" className="btn-outline">
              Add my own <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Exam countdowns */}
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          { label: "Mid Exam", exam: nextMid },
          { label: "End Exam", exam: nextEnd },
        ] as const).map(({ label, exam }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
              {exam && (
                <span
                  className="badge"
                  style={{
                    backgroundColor: `${subjectMap.get(exam.subject_id)?.color ?? "#64748b"}22`,
                    color: subjectMap.get(exam.subject_id)?.color ?? "#64748b",
                  }}
                >
                  {subjectMap.get(exam.subject_id)?.name ?? "Subject"}
                </span>
              )}
            </div>
            {exam ? (
              <>
                <div className="mt-2 text-3xl font-bold text-foreground">
                  {daysUntil(exam.exam_date)}
                  <span className="ml-1 text-base font-medium text-muted-foreground">days left</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(exam.exam_date + "T00:00:00").toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {exam.target_marks != null && ` · Target: ${exam.target_marks}`}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No {label.toLowerCase()} scheduled.{" "}
                <Link to="/exams" className="font-medium text-primary hover:underline">
                  Add one
                </Link>
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Coach */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">Exam countdown coach</h2>
          <button onClick={getCoachTip} className="btn-primary" disabled={coachLoading}>
            <Sparkles className="h-4 w-4" /> {coachLoading ? "Thinking…" : "Get today's tip"}
          </button>
        </div>
        {coach ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">{coach.tip}</p>
            <p className="text-sm text-muted-foreground">{coach.strategy}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            A daily motivational tip and revision strategy based on your nearest exam.
          </p>
        )}
      </div>

      {/* Today's tasks */}
      <div className="card p-5">
        <h2 className="font-semibold text-foreground">Today's tasks</h2>
        {todaysSessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing planned for today.{" "}
            <Link to="/planner" className="font-medium text-primary hover:underline">
              Generate a plan
            </Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {todaysSessions.map((s) => {
              const subj = s.subject_id ? subjectMap.get(s.subject_id) : undefined;
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: subj?.color ?? "#94a3b8" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {subj?.name ?? "Study session"}
                      {s.notes && <span className="text-muted-foreground"> — {s.notes}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.start_time} – {s.end_time}
                    </p>
                  </div>
                  {s.status === "planned" ? (
                    <div className="flex gap-1">
                      <button onClick={() => setStatus(s.id, "done")} className="btn-ghost px-2 text-success" aria-label="Mark done">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setStatus(s.id, "missed")} className="btn-ghost px-2 text-destructive" aria-label="Mark missed">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className={`badge ${s.status === "done" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {s.status}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Weekly chart */}
      <div className="card p-5">
        <h2 className="font-semibold text-foreground">Weekly progress</h2>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  color: "var(--color-foreground)",
                  fontSize: 13,
                }}
              />
              <Bar dataKey="planned" name="Planned" fill="var(--color-muted)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="done" name="Done" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
