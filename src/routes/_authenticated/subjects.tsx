import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubjects, useTopics } from "@/lib/queries";
import { SUBJECT_COLORS, type Subject } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/subjects")({
  head: () => ({
    meta: [
      { title: "Subjects — StudyPilot" },
      { name: "description", content: "Manage your subjects, difficulty, priority, and topic checklists." },
      { property: "og:title", content: "Subjects — StudyPilot" },
      { property: "og:description", content: "Manage your subjects, difficulty, priority, and topic checklists." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubjectsPage,
});

const emptyForm: { name: string; color: string; difficulty: number; priority: number; basics_level: Subject["basics_level"] } = { name: "", color: SUBJECT_COLORS[0], difficulty: 3, priority: 3, basics_level: "beginner" };

function SubjectsPage() {
  const qc = useQueryClient();
  const { data: subjects = [], isLoading } = useSubjects();
  const { data: topics = [] } = useTopics();
  const [editing, setEditing] = useState<Subject | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newTopic, setNewTopic] = useState<Record<string, string>>({});

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["subjects"] });
    qc.invalidateQueries({ queryKey: ["topics"] });
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({ name: s.name, color: s.color, difficulty: s.difficulty, priority: s.priority, basics_level: s.basics_level });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Subject name is required");
      return;
    }
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");
      if (editing) {
        const { error } = await supabase.from("subjects").update({
          name: form.name.trim(),
          color: form.color,
          difficulty: form.difficulty,
          priority: form.priority,
          basics_level: form.basics_level,
        }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Subject updated");
      } else {
        const { error } = await supabase.from("subjects").insert({
          user_id: userId,
          name: form.name.trim(),
          color: form.color,
          difficulty: form.difficulty,
          priority: form.priority,
          basics_level: form.basics_level,
        });
        if (error) throw error;
        toast.success("Subject added");
      }
      setFormOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Subject) => {
    if (!confirm(`Delete "${s.name}" and all its topics, exams, and sessions?`)) return;
    const { error } = await supabase.from("subjects").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Subject deleted");
      refresh();
    }
  };

  const addTopic = async (subjectId: string) => {
    const title = (newTopic[subjectId] ?? "").trim();
    if (!title) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return;
    const { error } = await supabase.from("topics").insert({
      user_id: userId,
      subject_id: subjectId,
      title,
      is_basic: true,
      estimated_hours: 1,
    });
    if (error) toast.error(error.message);
    else {
      setNewTopic((p) => ({ ...p, [subjectId]: "" }));
      refresh();
    }
  };

  const cycleTopicStatus = async (topicId: string, current: string) => {
    const next = current === "not_started" ? "in_progress" : current === "in_progress" ? "done" : "not_started";
    const { error } = await supabase.from("topics").update({ status: next }).eq("id", topicId);
    if (error) toast.error(error.message);
    else refresh();
  };

  const deleteTopic = async (topicId: string) => {
    const { error } = await supabase.from("topics").delete().eq("id", topicId);
    if (error) toast.error(error.message);
    else refresh();
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
        <h1 className="text-2xl font-bold text-foreground">Subjects</h1>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="h-4 w-4" /> Add subject
        </button>
      </div>

      {subjects.length === 0 ? (
        <div className="card border-dashed p-10 text-center">
          <p className="text-muted-foreground">No subjects yet. Add your first subject to start planning.</p>
          <button onClick={openAdd} className="btn-primary mt-4">
            <Plus className="h-4 w-4" /> Add subject
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {subjects.map((s) => {
            const subjectTopics = topics.filter((t) => t.subject_id === s.id);
            const doneCount = subjectTopics.filter((t) => t.status === "done").length;
            return (
              <div key={s.id} className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-xl" style={{ backgroundColor: s.color }} />
                    <div>
                      <h2 className="font-semibold text-foreground">{s.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        Difficulty {s.difficulty}/5 · Priority {s.priority}/5 · {s.basics_level}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="btn-ghost px-2" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(s)} className="btn-ghost px-2 text-destructive" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Basics & topics</span>
                    <span className="text-xs text-muted-foreground">
                      {doneCount}/{subjectTopics.length} done
                    </span>
                  </div>
                  {subjectTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No topics yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {subjectTopics.map((t) => (
                        <li key={t.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted">
                          <button onClick={() => cycleTopicStatus(t.id, t.status)} aria-label="Toggle status">
                            {t.status === "done" ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <Circle className={`h-4 w-4 ${t.status === "in_progress" ? "text-warning" : "text-muted-foreground"}`} />
                            )}
                          </button>
                          <span className={`flex-1 text-sm ${t.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {t.title}
                            {t.is_basic && <span className="badge ml-2 bg-accent text-accent-foreground">basic</span>}
                          </span>
                          <button
                            onClick={() => deleteTopic(t.id)}
                            className="hidden text-muted-foreground hover:text-destructive group-hover:block"
                            aria-label="Delete topic"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex gap-2">
                    <input
                      className="input py-1.5 text-sm"
                      placeholder="Add a topic…"
                      value={newTopic[s.id] ?? ""}
                      onChange={(e) => setNewTopic((p) => ({ ...p, [s.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addTopic(s.id)}
                    />
                    <button onClick={() => addTopic(s.id)} className="btn-outline px-3 py-1.5" aria-label="Add topic">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setFormOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{editing ? "Edit subject" : "Add subject"}</h2>
              <button onClick={() => setFormOpen(false)} className="btn-ghost px-2" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" maxLength={80} />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`h-8 w-8 rounded-full transition-transform ${form.color === c ? "scale-110 ring-2 ring-ring ring-offset-2 ring-offset-card" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Difficulty (1-5)</label>
                  <input type="range" min={1} max={5} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })} className="w-full accent-primary" />
                  <span className="text-sm text-muted-foreground">{form.difficulty}/5</span>
                </div>
                <div>
                  <label className="label">Priority (1-5)</label>
                  <input type="range" min={1} max={5} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="w-full accent-primary" />
                  <span className="text-sm text-muted-foreground">{form.priority}/5</span>
                </div>
              </div>
              <div>
                <label className="label">Basics level</label>
                <select className="input" value={form.basics_level} onChange={(e) => setForm({ ...form, basics_level: e.target.value as Subject["basics_level"] })}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="strong">Strong</option>
                </select>
              </div>
              <button onClick={save} className="btn-primary w-full" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add subject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
