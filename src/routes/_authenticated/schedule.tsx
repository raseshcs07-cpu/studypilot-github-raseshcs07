import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check, X, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubjects, useSessions, todayStr } from "@/lib/queries";
import type { StudySession } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — StudyPilot" },
      { name: "description", content: "Weekly and monthly calendar of your study sessions. Drag to reschedule, mark done or missed." },
      { property: "og:title", content: "Schedule — StudyPilot" },
      { property: "og:description", content: "Weekly and monthly calendar of your study sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulePage,
});

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function SchedulePage() {
  const qc = useQueryClient();
  const { data: subjects = [] } = useSubjects();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [addOpen, setAddOpen] = useState<string | null>(null); // date key
  const [addForm, setAddForm] = useState({ subject_id: "", start_time: "17:00", end_time: "18:00", notes: "" });

  const range = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: dateKey(start), to: dateKey(end) };
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: dateKey(start), to: dateKey(end) };
  }, [view, anchor]);

  const { data: sessions = [], isLoading } = useSessions(range.from, range.to);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const byDate = useMemo(() => {
    const m = new Map<string, StudySession[]>();
    for (const s of sessions) {
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    }
    return m;
  }, [sessions]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["sessions"] });

  const moveSession = async (id: string, newDate: string) => {
    const { error } = await supabase.from("study_sessions").update({ date: newDate }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Session moved");
      refresh();
    }
  };

  const setStatus = async (id: string, status: "done" | "missed" | "planned") => {
    const { error } = await supabase.from("study_sessions").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from("study_sessions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const addSession = async () => {
    if (!addOpen || !addForm.subject_id) return toast.error("Choose a subject");
    if (addForm.end_time <= addForm.start_time) return toast.error("End time must be after start time");
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return;
    const { error } = await supabase.from("study_sessions").insert({
      user_id: userId,
      subject_id: addForm.subject_id,
      date: addOpen,
      start_time: addForm.start_time,
      end_time: addForm.end_time,
      notes: addForm.notes.trim(),
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Session added");
      setAddOpen(null);
      setAddForm({ subject_id: "", start_time: "17:00", end_time: "18:00", notes: "" });
      refresh();
    }
  };

  const shift = (dir: number) => {
    const d = new Date(anchor);
    if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [anchor]);

  const monthCells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: startOffset }, () => null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), i));
    return cells;
  }, [anchor]);

  const today = todayStr();

  const SessionCard = ({ s, compact = false }: { s: StudySession; compact?: boolean }) => {
    const subj = s.subject_id ? subjectMap.get(s.subject_id) : undefined;
    return (
      <div
        draggable={s.status === "planned"}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
        className={`group rounded-lg border border-border p-2 text-left ${s.status === "planned" ? "cursor-grab bg-card" : "bg-muted/50"} ${compact ? "text-xs" : ""}`}
      >
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: subj?.color ?? "#94a3b8" }} />
          <span className={`min-w-0 flex-1 truncate font-medium ${s.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {subj?.name ?? "Session"}
          </span>
          <span className={`badge ${s.status === "done" ? "bg-success/15 text-success" : s.status === "missed" ? "bg-destructive/15 text-destructive" : "bg-accent text-accent-foreground"}`}>
            {s.status}
          </span>
        </div>
        {!compact && (
          <>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {s.start_time}–{s.end_time}
              {s.notes && ` · ${s.notes}`}
            </p>
            <div className="mt-1 hidden gap-1 group-hover:flex">
              {s.status !== "done" && (
                <button onClick={() => setStatus(s.id, "done")} className="rounded p-1 text-success hover:bg-success/15" aria-label="Done">
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
              {s.status === "planned" && (
                <button onClick={() => setStatus(s.id, "missed")} className="rounded p-1 text-destructive hover:bg-destructive/15" aria-label="Missed">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {s.status !== "planned" && (
                <button onClick={() => setStatus(s.id, "planned")} className="rounded px-1 text-xs text-muted-foreground hover:bg-muted">
                  reset
                </button>
              )}
              <button onClick={() => deleteSession(s.id)} className="rounded px-1 text-xs text-muted-foreground hover:text-destructive">
                delete
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => shift(-1)} className="btn-outline px-2" aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setAnchor(new Date())} className="btn-outline">Today</button>
          <button onClick={() => shift(1)} className="btn-outline px-2" aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : view === "week" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {weekDays.map((d) => {
            const key = dateKey(d);
            const daySessions = byDate.get(key) ?? [];
            return (
              <div
                key={key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moveSession(id, key);
                }}
                className={`min-h-40 rounded-xl border p-2 ${key === today ? "border-primary bg-accent/40" : "border-border bg-card"}`}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </p>
                    <p className={`text-sm font-bold ${key === today ? "text-primary" : "text-foreground"}`}>{d.getDate()}</p>
                  </div>
                  <button
                    onClick={() => {
                      setAddForm((f) => ({ ...f, subject_id: f.subject_id || subjects[0]?.id || "" }));
                      setAddOpen(key);
                    }}
                    className="btn-ghost px-1.5"
                    aria-label="Add session"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {daySessions.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">No sessions</p>
                  ) : (
                    daySessions.map((s) => <SessionCard key={s.id} s={s} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <h2 className="border-b border-border p-4 text-center font-semibold text-foreground">
            {anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <div className="grid grid-cols-7 text-center text-xs font-medium uppercase text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="border-b border-border py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="min-h-24 border-b border-r border-border bg-muted/30" />;
              const key = dateKey(d);
              const daySessions = byDate.get(key) ?? [];
              return (
                <div key={key} className={`min-h-24 border-b border-r border-border p-1.5 ${key === today ? "bg-accent/40" : ""}`}>
                  <p className={`mb-1 text-xs font-semibold ${key === today ? "text-primary" : "text-muted-foreground"}`}>{d.getDate()}</p>
                  <div className="space-y-1">
                    {daySessions.slice(0, 3).map((s) => <SessionCard key={s.id} s={s} compact />)}
                    {daySessions.length > 3 && (
                      <p className="text-xs text-muted-foreground">+{daySessions.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Tip: drag a planned session to another day to reschedule it. Hover a session to mark it done or missed.</p>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAddOpen(null)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Add session — {addOpen}</h2>
              <button onClick={() => setAddOpen(null)} className="btn-ghost px-2" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Subject</label>
                <select className="input" value={addForm.subject_id} onChange={(e) => setAddForm({ ...addForm, subject_id: e.target.value })}>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start</label>
                  <input type="time" className="input" value={addForm.start_time} onChange={(e) => setAddForm({ ...addForm, start_time: e.target.value })} />
                </div>
                <div>
                  <label className="label">End</label>
                  <input type="time" className="input" value={addForm.end_time} onChange={(e) => setAddForm({ ...addForm, end_time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" placeholder="Optional goal…" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} maxLength={200} />
              </div>
              <button onClick={addSession} className="btn-primary w-full">Add session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
