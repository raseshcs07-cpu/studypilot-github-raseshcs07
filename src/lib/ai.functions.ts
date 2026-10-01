import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callAI(messages: ChatMessage[], effort: "low" | "medium" = "low"): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured on the server");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: messages.map((m) => ({ role: m.role, content: m.content })),
      reasoning: { effort },
      store: false,
      stream: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("AI is busy right now. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits are exhausted. Please add credits to continue.");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") {
            output += ev.delta;
          }
        } catch {
          // ignore partial frames
        }
      }
    }
  }
  if (!output) throw new Error("AI returned an empty response. Please try again.");
  return output;
}

function extractJson<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  const start = cleaned.search(/[{[]/);
  if (start === -1) throw new Error("AI response was not valid JSON");
  const sub = cleaned.slice(start);
  // try progressively shorter substrings to tolerate trailing prose
  let end = Math.max(sub.lastIndexOf("}"), sub.lastIndexOf("]"));
  while (end > 0) {
    try {
      return JSON.parse(sub.slice(0, end + 1)) as T;
    } catch {
      end = sub.slice(0, end).search(/[}\]](?=[^}\]]*$)/);
      if (end <= 0) break;
    }
  }
  return JSON.parse(sub) as T;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadContext(supabase: any, userId: string) {
  const [profile, subjects, topics, exams] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("subjects").select("*").eq("user_id", userId),
    supabase.from("topics").select("*").eq("user_id", userId),
    supabase.from("exams").select("*").eq("user_id", userId),
  ]);
  return {
    profile: profile.data,
    subjects: subjects.data ?? [],
    topics: topics.data ?? [],
    exams: exams.data ?? [],
  };
}

export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { profile, subjects, topics, exams } = await loadContext(supabase, userId);

    if (!subjects.length) throw new Error("Add at least one subject before generating a plan.");

    const today = todayStr();
    const prompt = `You are a study planning engine. Build a day-wise study schedule for the next 14 days starting ${today}.

Student profile:
- Daily study hours available: ${profile?.daily_study_hours ?? 2}
- Preferred study time: ${profile?.preferred_time ?? "evening"} (morning starts 07:00, evening 17:00, night 20:00)
- Weekly off day: ${profile?.weekly_off_day ?? "sunday"} (schedule NOTHING on this weekday)

Subjects (id, name, difficulty 1-5, priority 1-5, basics level):
${subjects.map((s: any) => `- ${s.id} | ${s.name} | diff ${s.difficulty} | prio ${s.priority} | basics ${s.basics_level}`).join("\n")}

Topics (id, subject_id, title, is_basic, status, estimated_hours):
${topics.map((t: any) => `- ${t.id} | subj ${t.subject_id} | ${t.title} | basic=${t.is_basic} | ${t.status} | ${t.estimated_hours}h`).join("\n") || "(none)"}

Upcoming exams (subject_id, type, date, syllabus, target marks):
${exams.map((e: any) => `- subj ${e.subject_id} | ${e.type} | ${e.exam_date} | syllabus: ${e.syllabus_topics} | target: ${e.target_marks ?? "n/a"}`).join("\n") || "(none)"}

Rules:
1. Cover topics with is_basic=true and status != done FIRST, before advanced topics.
2. Give higher difficulty and higher priority subjects more total time.
3. In the 3 days before each exam, schedule revision sessions for that subject (notes starting with "Revision:").
4. Never schedule on the weekly off day. Never exceed daily study hours per day.
5. Session length 1-2 hours. Times in 24h HH:MM, aligned to the preferred time block.
6. Only use subject_id and topic_id values from the lists above. topic_id may be null for revision sessions.

Return ONLY a JSON array, no prose:
[{"date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","subject_id":"...","topic_id":"...or null","notes":"short goal"}]`;

    const raw = await callAI(
      [
        { role: "system", content: "You output only valid JSON. No markdown, no commentary." },
        { role: "user", content: prompt },
      ],
      "medium",
    );

    const parsed = extractJson<any[]>(raw);
    if (!Array.isArray(parsed)) throw new Error("AI returned an invalid plan. Please try again.");

    const subjectIds = new Set(subjects.map((s: any) => s.id));
    const topicIds = new Set(topics.map((t: any) => t.id));
    const rows = parsed
      .filter(
        (r) =>
          r &&
          typeof r.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
          r.date >= today &&
          typeof r.start_time === "string" &&
          typeof r.end_time === "string" &&
          subjectIds.has(r.subject_id),
      )
      .map((r) => ({
        user_id: userId,
        subject_id: r.subject_id,
        topic_id: topicIds.has(r.topic_id) ? r.topic_id : null,
        date: r.date,
        start_time: r.start_time,
        end_time: r.end_time,
        status: "planned",
        notes: typeof r.notes === "string" ? r.notes.slice(0, 300) : "",
      }));

    if (!rows.length) throw new Error("AI could not build a plan from your data. Add topics and try again.");

    // Replace future planned sessions with the new plan
    await supabase
      .from("study_sessions")
      .delete()
      .eq("user_id", userId)
      .eq("status", "planned")
      .gte("date", today);

    const { error } = await supabase.from("study_sessions").insert(rows);
    if (error) throw error;

    return { created: rows.length };
  });

export const explainBasics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ subjectName: z.string().min(1), topicTitle: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const target = data.topicTitle
      ? `the topic "${data.topicTitle}" in the subject "${data.subjectName}"`
      : `the subject "${data.subjectName}"`;
    const raw = await callAI([
      {
        role: "system",
        content: "You are a friendly tutor. Output only valid JSON, no markdown.",
      },
      {
        role: "user",
        content: `Explain the basics of ${target} to a complete beginner. Return ONLY JSON:
{"explanation":"2-3 short paragraphs, beginner friendly","key_points":["point",...],"practice_questions":["q1","q2","q3","q4","q5"]}
Include exactly 5 practice questions with no answers.`,
      },
    ]);
    const parsed = extractJson<{ explanation: string; key_points: string[]; practice_questions: string[] }>(raw);
    return {
      explanation: String(parsed.explanation ?? ""),
      keyPoints: Array.isArray(parsed.key_points) ? parsed.key_points.map(String) : [],
      questions: Array.isArray(parsed.practice_questions) ? parsed.practice_questions.map(String) : [],
    };
  });

export const examCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ examId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: exam, error } = await supabase
      .from("exams")
      .select("*, subjects(name)")
      .eq("id", data.examId)
      .eq("user_id", userId)
      .single();
    if (error || !exam) throw new Error("Exam not found");

    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(exam.exam_date + "T00:00:00").getTime() - Date.now()) / 86400000),
    );

    const raw = await callAI([
      { role: "system", content: "You are a motivational exam coach. Output only valid JSON." },
      {
        role: "user",
        content: `A student has a ${exam.type === "mid" ? "midterm" : "final"} exam in "${exam.subjects?.name ?? "a subject"}" in ${daysLeft} day(s). Syllabus: ${exam.syllabus_topics || "not specified"}. Target marks: ${exam.target_marks ?? "not set"}.
Return ONLY JSON: {"tip":"one short daily motivational tip (1-2 sentences)","strategy":"a concrete revision strategy for the remaining days (3-5 sentences)"}`,
      },
    ]);
    const parsed = extractJson<{ tip: string; strategy: string }>(raw);
    return { tip: String(parsed.tip ?? ""), strategy: String(parsed.strategy ?? ""), daysLeft };
  });

export const studyChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        message: z.string().min(1).max(2000),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
          .max(20)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { profile, subjects, exams } = await loadContext(supabase, userId);
    const system = `You are StudyPilot, a helpful study assistant. The student studies: ${subjects.map((s: any) => s.name).join(", ") || "nothing yet"}. Daily hours: ${profile?.daily_study_hours ?? 2}. Upcoming exams: ${exams.map((e: any) => `${e.type} on ${e.exam_date}`).join(", ") || "none"}. Answer study questions concisely and encouragingly. Plain text, no markdown headers.`;
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...(data.history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: data.message },
    ];
    const reply = await callAI(messages);
    return { reply };
  });
