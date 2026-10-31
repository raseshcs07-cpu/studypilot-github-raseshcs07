import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, X, Loader2, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubjects, useExams, todayStr } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "Exams — StudyPilot" },
      { name: "description", content: "Add mid and end exams with dates and syllabus, and track days remaining." },
      { property: "og:title", content: "Exams — StudyPilot" },
      { property: "og:description", content: "Add mid and end exams with dates and syllabus, and track days remaining." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamsPage,
});

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - new Date(todayStr() + "T00:00:00").getTime()) / 86400000);
}

function ExamsPage() {
  const qc = useQueryClient();
  const { data: subjects = [], isLoading } = useSubjects();
  const { data: exams = [] } = useExams();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subject_id: "", type: "mid" as "mid" | "end", exam_date: "", syllabus_topics: "", target_marks: "" });

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const save = async () => {
    if (!form.subject_id) {
      toast.error("Choose a subject");
      return;
    }
    if (!form.exam_date) {
      toast.error("Pick an exam date");
      return;
    }
    if (form.exam_date < todayStr()) {
      toast.error("Exam date must be in the future");
      return;
    }
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("exams").insert({
        user_id: userId,
        subject_id: form.subject_id,
        type: form.type,
        exam_date: form.exam_date,
        syllabus_topics: form.syllabus_topics.trim(),
        target_marks: form.target_marks ? Number(form.target_marks) : null,
      });
      if (error) throw error;
      toast.success("Exam added");
      setOpen(false);
      setForm({ subject_id: "", type: "mid", exam_date: "", syllabus_topics: "", target_marks: "" });
      qc.invalidateQueries({ queryKey: ["exams"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Exam deleted");
      qc.invalidateQueries({ queryKey: ["exams"] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Exams</h1>
        <button
          onClick={() => {
            if (!subjects.length) {
              toast.error("Add a subject first");
              return;
            }
            setForm((f) => ({ ...f, subject_id: f.subject_id || subjects[0]?.id || "" }));
            setOpen(true);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" /> Add exam
        </button>
      </div>

      {exams.length === 0 ? (
        <div className="card border-dashed p-10 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No exams yet. Add your mid and end exams so the planner can schedule revision.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((e) => {
            const subj = subjectMap.get(e.subject_id);
            const left = daysUntil(e.exam_date);
            return (
              <div key={e.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <span className={`badge ${e.type === "mid" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>
                    {e.type === "mid" ? "Mid exam" : "End exam"}
                  </span>
                  <button onClick={() => remove(e.id)} className="btn-ghost px-2 text-destructive" aria-label="Delete exam">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subj?.color ?? "#94a3b8" }} />
                  <h2 className="font-semibold text-foreground">{subj?.name ?? "Subject"}</h2>
                </div>
                <div className="mt-2 text-3xl font-bold text-foreground">
                  {left < 0 ? "Passed" : left === 0 ? "Today!" : `${left} days`}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(e.exam_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  {e.target_marks != null && ` · Target ${e.target_marks}`}
                </p>
                {e.syllabus_topics && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">Syllabus: {e.syllabus_topics}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Add exam</h2>
              <button onClick={() => setOpen(false)} className="btn-ghost px-2" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Subject</label>
                <select className="input" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["mid", "end"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${form.type === t ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      {t === "mid" ? "Mid exam" : "End exam"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Exam date</label>
                <input type="date" className="input" value={form.exam_date} min={todayStr()} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Syllabus topics</label>
                <textarea className="input min-h-20" placeholder="e.g. Chapters 1-5: algebra, geometry…" value={form.syllabus_topics} onChange={(e) => setForm({ ...form, syllabus_topics: e.target.value })} maxLength={500} />
              </div>
              <div>
                <label className="label">Target marks (optional)</label>
                <input type="number" className="input" min={0} max={1000} placeholder="e.g. 85" value={form.target_marks} onChange={(e) => setForm({ ...form, target_marks: e.target.value })} />
              </div>
              <button onClick={save} className="btn-primary w-full" disabled={saving}>
                {saving ? "Saving…" : "Add exam"}
              </button>
            </div>
          </div>
        </div>
      )}

      {subjects.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You need at least one subject first — <Link to="/subjects" className="font-medium text-primary hover:underline">add subjects</Link>.
        </p>
      )}
    </div>
  );
}
