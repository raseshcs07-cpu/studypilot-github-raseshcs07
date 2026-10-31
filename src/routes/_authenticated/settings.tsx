import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/queries";
import { DAYS } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — StudyPilot" },
      { name: "description", content: "Set your daily study hours, preferred study time, and weekly off day." },
      { property: "og:title", content: "Settings — StudyPilot" },
      { property: "og:description", content: "Set your daily study hours, preferred study time, and weekly off day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile, isLoading } = useProfile();
  const [hours, setHours] = useState(2);
  const [preferred, setPreferred] = useState<"morning" | "evening" | "night">("evening");
  const [offDay, setOffDay] = useState<string>("sunday");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setHours(Number(profile.daily_study_hours) || 2);
      setPreferred(profile.preferred_time);
      setOffDay(profile.weekly_off_day);
    }
  }, [profile]);

  const save = async () => {
    if (hours < 0.5 || hours > 16) {
      toast.error("Daily hours must be between 0.5 and 16");
      return;
    }
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ daily_study_hours: hours, preferred_time: preferred, weekly_off_day: offDay })
        .eq("user_id", profile.user_id);
      if (error) throw error;
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
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
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <div className="card space-y-5 p-6">
        <div>
          <label className="label">Daily study hours</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={12}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-16 text-right text-sm font-semibold text-foreground">{hours}h/day</span>
          </div>
        </div>

        <div>
          <label className="label">Preferred study time</label>
          <div className="grid grid-cols-3 gap-2">
            {(["morning", "evening", "night"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setPreferred(t)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  preferred === t
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Weekly off day</label>
          <select className="input capitalize" value={offDay} onChange={(e) => setOffDay(e.target.value)}>
            {DAYS.map((d) => (
              <option key={d} value={d} className="capitalize">
                {d}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">The planner never schedules sessions on this day.</p>
        </div>

        <button onClick={save} className="btn-primary w-full" disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
