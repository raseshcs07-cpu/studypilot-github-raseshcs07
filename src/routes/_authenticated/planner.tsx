import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Send, Loader2, BookOpen, RefreshCw } from "lucide-react";
import { useSubjects, useTopics } from "@/lib/queries";
import { generatePlan, explainBasics, studyChat } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "AI Planner — StudyPilot" },
      { name: "description", content: "Generate your AI study plan, get basics explained, and chat with your study assistant." },
      { property: "og:title", content: "AI Planner — StudyPilot" },
      { property: "og:description", content: "Generate your AI study plan, get basics explained, and chat with your study assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlannerPage,
});

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Explanation {
  explanation: string;
  keyPoints: string[];
  questions: string[];
}

function PlannerPage() {
  const qc = useQueryClient();
  const { data: subjects = [] } = useSubjects();
  const { data: topics = [] } = useTopics();
  const runPlan = useServerFn(generatePlan);
  const runExplain = useServerFn(explainBasics);
  const runChat = useServerFn(studyChat);

  const [planning, setPlanning] = useState(false);
  const [explainTarget, setExplainTarget] = useState("");
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const generate = async () => {
    setPlanning(true);
    try {
      const result = await runPlan({ data: {} });
      toast.success(`Plan generated — ${result.created} sessions scheduled`);
      qc.invalidateQueries({ queryKey: ["sessions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Plan generation failed");
    } finally {
      setPlanning(false);
    }
  };

  const explain = async () => {
    if (!explainTarget) return toast.error("Pick a subject or topic first");
    setExplaining(true);
    setExplanation(null);
    try {
      const [subjectId, topicId] = explainTarget.split("|");
      const subject = subjects.find((s) => s.id === subjectId);
      const topic = topicId ? topics.find((t) => t.id === topicId) : undefined;
      if (!subject) throw new Error("Subject not found");
      const result = await runExplain({ data: { subjectName: subject.name, topicTitle: topic?.title } });
      setExplanation(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Explanation failed");
    } finally {
      setExplaining(false);
    }
  };

  const sendChat = async () => {
    const text = input.trim();
    if (!text || chatting) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setChatting(true);
    try {
      const result = await runChat({ data: { message: text, history: next.slice(-12, -1) } });
      setMessages([...next, { role: "assistant", content: result.reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chat failed");
      setMessages(next);
    } finally {
      setChatting(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">AI Planner</h1>

      {/* Generate plan */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">Study plan</h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              The AI reads your subjects, topics, exams, and available hours, then builds a 14-day
              schedule — basics first, revision before exams, harder subjects get more time.
              Regenerating replaces upcoming planned sessions.
            </p>
          </div>
          <button onClick={generate} className="btn-primary" disabled={planning || !subjects.length}>
            {planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {planning ? "Generating…" : "Generate my plan"}
          </button>
        </div>
        {!subjects.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            Add subjects first on the <Link to="/subjects" className="font-medium text-primary hover:underline">Subjects</Link> page.
          </p>
        )}
        {planning && (
          <div className="mt-4 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        )}
      </div>

      {/* Explain basics */}
      <div className="card p-5">
        <h2 className="font-semibold text-foreground">Explain basics</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className="input max-w-xs" value={explainTarget} onChange={(e) => setExplainTarget(e.target.value)}>
            <option value="">Choose a subject or topic…</option>
            {subjects.map((s) => (
              <optgroup key={s.id} label={s.name}>
                <option value={s.id}>{s.name} (whole subject)</option>
                {topics
                  .filter((t) => t.subject_id === s.id)
                  .map((t) => (
                    <option key={t.id} value={`${s.id}|${t.id}`}>
                      {t.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <button onClick={explain} className="btn-outline" disabled={explaining || !explainTarget}>
            {explaining ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            {explaining ? "Explaining…" : "Explain"}
          </button>
        </div>
        {explanation && (
          <div className="mt-4 space-y-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{explanation.explanation}</p>
            {explanation.keyPoints.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Key points</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {explanation.keyPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {explanation.questions.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Practice questions</h3>
                <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                  {explanation.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="card flex flex-col p-5">
        <h2 className="font-semibold text-foreground">
          <Sparkles className="mr-1 inline h-4 w-4 text-primary" /> Ask StudyPilot
        </h2>
        <div className="mt-3 h-80 space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
          {messages.length === 0 && (
            <p className="pt-8 text-center text-sm text-muted-foreground">
              Ask anything about your studies — "How should I revise algebra in 3 days?"
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground border border-border"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {chatting && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border bg-card px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="input"
            placeholder="Ask a study question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            maxLength={2000}
          />
          <button onClick={sendChat} className="btn-primary px-3" disabled={chatting || !input.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
