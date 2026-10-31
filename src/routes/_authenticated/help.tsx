import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  GraduationCap,
  CalendarDays,
  Sparkles,
  Settings as SettingsIcon,
  LayoutDashboard,
  MousePointer2,
  MessageCircleQuestion,
  Lightbulb,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "How to use — StudyPilot" },
      { name: "description", content: "Step-by-step guide to using StudyPilot: subjects, exams, AI plan generation, schedule, and settings." },
      { property: "og:title", content: "How to use — StudyPilot" },
      { property: "og:description", content: "Step-by-step guide to using StudyPilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const STEPS = [
  {
    icon: SettingsIcon,
    title: "1. Set up your profile",
    body: "Go to Settings and choose your daily study hours, your preferred study time (morning, evening, or night), and your weekly off day. The AI planner uses all three to build your schedule, so set these first.",
  },
  {
    icon: BookOpen,
    title: "2. Add your subjects",
    body: "On the Subjects page, add each subject with a color, difficulty (1–5), priority (1–5), and your current basics level. Inside each subject, add topics as a checklist — mark foundational ones as basics. Click a topic's circle to cycle it through not started → in progress → done. New here? The dashboard offers a starter set you can edit.",
  },
  {
    icon: GraduationCap,
    title: "3. Add your exams",
    body: "On the Exams page, add your Mid and End exams with the date, syllabus topics, and optional target marks. Each exam card shows the days remaining, and the planner automatically schedules revision in the days before each exam.",
  },
  {
    icon: Sparkles,
    title: "4. Generate your AI plan",
    body: "Open AI Planner and press “Generate my plan”. The AI reads your subjects, topics, exams, and available hours, then builds a 14-day schedule: basics first, harder and higher-priority subjects get more time, revision lands before exams, and your off day stays free. Regenerating replaces upcoming planned sessions — done and missed sessions are kept.",
  },
  {
    icon: CalendarDays,
    title: "5. Work the schedule",
    body: "The Schedule page shows your week and month. Drag a planned session to another day to reschedule it. Hover a session to mark it done or missed, reset it, or delete it. Use the + button on any day to add a manual session.",
  },
  {
    icon: LayoutDashboard,
    title: "6. Track progress daily",
    body: "The Dashboard shows today's tasks, countdown cards for your next Mid and End exams, a weekly progress chart, and your study streak — the number of consecutive days with at least one completed session.",
  },
  {
    icon: MessageCircleQuestion,
    title: "7. Ask for help anytime",
    body: "On AI Planner, “Explain basics” gives a beginner-friendly explanation of any subject or topic, with key points and 5 practice questions. The chat box answers any study question with your subjects and exams in mind.",
  },
  {
    icon: Lightbulb,
    title: "8. Get daily coaching",
    body: "The Dashboard's “Exam countdown coach” gives a fresh motivational tip and a revision strategy based on how many days are left before your nearest exam.",
  },
];

function HelpPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">How to use StudyPilot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A quick tour of everything the app can do, in the order you'll usually do it.
        </p>
      </div>

      <div className="space-y-4">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="card flex gap-4 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card border-dashed p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <MousePointer2 className="h-4 w-4 text-primary" /> Good to know
        </h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Your data is private — every account only ever sees its own subjects, exams, and sessions.</li>
          <li>Switch between light and dark mode from the sidebar (bottom on desktop, top bar on mobile).</li>
          <li>Missed a session? Mark it missed, then regenerate your plan — the AI will work the pending topics back in.</li>
          <li>Everything works on mobile: use the menu button in the top bar to navigate.</li>
        </ul>
      </div>
    </div>
  );
}
