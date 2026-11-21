export type PlannedSession = {
  date: string;
  start_time: string;
  end_time: string;
  subject_id: string;
  topic_id: string | null;
  notes: string;
};

type Subject = { id: string; name: string };
type Topic = { id: string; subject_id: string; title: string; is_basic: boolean; status: string };
type Exam = { subject_id: string; type: string; exam_date: string };

type CoverageInput = {
  proposed: PlannedSession[];
  subjects: Subject[];
  topics: Topic[];
  exams: Exam[];
  today: string;
  weeklyOffDay: string;
  dailyStudyHours: number;
  preferredTime: string;
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MINUTES_PER_DAY = 24 * 60;

function minutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  return hours < 24 && mins < 60 ? hours * 60 + mins : null;
}

function dayAt(start: string, offset: number): string {
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function timeAt(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function isOffDay(date: string, weeklyOffDay: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return DAY_NAMES[day] === weeklyOffDay.toLowerCase();
}

function preferredStart(preferredTime: string): number {
  if (preferredTime === "morning") return 7 * 60;
  if (preferredTime === "night") return 20 * 60;
  return 17 * 60;
}

function examRevisionDate(date: string, examDate: string): boolean {
  return date >= dayAt(examDate, -3) && date < examDate;
}

export function fillPlanCoverage(input: CoverageInput): PlannedSession[] {
  const subjectById = new Map(input.subjects.map((subject) => [subject.id, subject]));
  const topicById = new Map(input.topics.map((topic) => [topic.id, topic]));
  const offDay = input.weeklyOffDay.toLowerCase();
  const maxMinutes = Math.max(0, Math.floor(input.dailyStudyHours * 60));
  const fallbackDuration = Math.min(60, maxMinutes);
  const horizonEnd = dayAt(input.today, 13);
  const capacityByDay = new Map<string, number>();
  const scheduled: PlannedSession[] = [];
  const usedProposals = new Set<number>();

  const candidates = input.proposed.flatMap((row, index) => {
    const start = minutes(row.start_time);
    const end = minutes(row.end_time);
    if (
      !row ||
      !subjectById.has(row.subject_id) ||
      row.date < input.today ||
      row.date > horizonEnd ||
      isOffDay(row.date, offDay) ||
      start === null ||
      end === null ||
      end <= start ||
      end - start > 120 ||
      end - start < 30
    ) return [];

    return [{ index, row: { ...row, topic_id: row.topic_id && topicById.has(row.topic_id) ? row.topic_id : null } }];
  });

  const availableDates = Array.from({ length: 14 }, (_, index) => dayAt(input.today, index))
    .filter((date) => !isOffDay(date, offDay));

  function fits(date: string, start: number, end: number): boolean {
    if (isOffDay(date, offDay) || end - start + (capacityByDay.get(date) ?? 0) > maxMinutes) return false;
    return scheduled.every((row) => {
      if (row.date !== date) return true;
      const rowStart = minutes(row.start_time);
      const rowEnd = minutes(row.end_time);
      return rowStart === null || rowEnd === null || end <= rowStart || start >= rowEnd;
    });
  }

  function add(row: PlannedSession, date: string, start: number, end: number): boolean {
    if (!fits(date, start, end)) return false;
    scheduled.push({ ...row, date, start_time: timeAt(start), end_time: timeAt(end) });
    capacityByDay.set(date, (capacityByDay.get(date) ?? 0) + end - start);
    return true;
  }

  function place(row: PlannedSession, targetDates: string[], duration: number): boolean {
    const originalStart = minutes(row.start_time);
    const originalEnd = minutes(row.end_time);
    for (const date of targetDates) {
      if (date < input.today || date > horizonEnd || isOffDay(date, offDay)) continue;
      if (originalStart !== null && originalEnd !== null && originalEnd - originalStart === duration) {
        if (add(row, date, originalStart, originalEnd)) return true;
      }
    }

    const base = preferredStart(input.preferredTime);
    for (const date of targetDates) {
      if (date < input.today || date > horizonEnd || isOffDay(date, offDay)) continue;
      for (let start = base; start + duration <= MINUTES_PER_DAY; start += 30) {
        if (add(row, date, start, start + duration)) return true;
      }
    }
    return false;
  }

  const validExams = input.exams.filter((exam) =>
    subjectById.has(exam.subject_id) && exam.exam_date > input.today && exam.exam_date <= horizonEnd,
  );

  for (const exam of validExams) {
    const matching = candidates.find(({ row }) =>
      row.subject_id === exam.subject_id && row.notes.toLowerCase().startsWith("revision:") && examRevisionDate(row.date, exam.exam_date),
    );
    if (matching) {
      if (!usedProposals.has(matching.index)) {
        const revisionDates = [matching.row.date, dayAt(exam.exam_date, -1), dayAt(exam.exam_date, -2), dayAt(exam.exam_date, -3)];
        if (!place(matching.row, [...new Set(revisionDates)], minutes(matching.row.end_time)! - minutes(matching.row.start_time)!)) {
          throw new Error("There is not enough free time before an exam. Adjust your study hours or weekly day off and try again.");
        }
        usedProposals.add(matching.index);
      }
      continue;
    }

    const subject = subjectById.get(exam.subject_id);
    const revision = {
      date: dayAt(exam.exam_date, -1),
      start_time: timeAt(preferredStart(input.preferredTime)),
      end_time: timeAt(preferredStart(input.preferredTime) + fallbackDuration),
      subject_id: exam.subject_id,
      topic_id: null,
      notes: `Revision: ${exam.type} exam on ${exam.exam_date}${subject ? ` — ${subject.name}` : ""}`,
    };
    const dates = [dayAt(exam.exam_date, -1), dayAt(exam.exam_date, -2), dayAt(exam.exam_date, -3)];
    if (!place(revision, dates, fallbackDuration)) {
      throw new Error("There is not enough free time before an exam. Adjust your study hours or weekly day off and try again.");
    }
  }

  for (const subject of input.subjects) {
    const matching = candidates.find(({ row }) => row.subject_id === subject.id);
    if (matching) {
      if (!usedProposals.has(matching.index)) {
        const subjectDates = [matching.row.date, ...availableDates.filter((date) => date !== matching.row.date)];
        const start = minutes(matching.row.start_time);
        const end = minutes(matching.row.end_time);
        if (start === null || end === null || !place(matching.row, subjectDates, end - start)) {
          throw new Error("There is not enough available study time to cover every subject. Adjust your study hours and try again.");
        }
        usedProposals.add(matching.index);
      }
      continue;
    }

    const topic = input.topics
      .filter((candidate) => candidate.subject_id === subject.id && candidate.status !== "done")
      .sort((left, right) => Number(right.is_basic) - Number(left.is_basic))[0];
    const nextDay = [...availableDates].sort((left, right) =>
      (capacityByDay.get(left) ?? 0) - (capacityByDay.get(right) ?? 0),
    )[0];
    const fallback = {
      date: nextDay ?? input.today,
      start_time: timeAt(preferredStart(input.preferredTime)),
      end_time: timeAt(preferredStart(input.preferredTime) + fallbackDuration),
      subject_id: subject.id,
      topic_id: topic?.id ?? null,
      notes: topic ? `Study: ${topic.title}` : `Review: ${subject.name}`,
    };
    if (!fallbackDuration || !place(fallback, [...availableDates].sort((left, right) =>
      (capacityByDay.get(left) ?? 0) - (capacityByDay.get(right) ?? 0),
    ), fallbackDuration)) {
      throw new Error("There is not enough available study time to cover every subject. Adjust your study hours and try again.");
    }
  }

  for (const candidate of candidates) {
    if (usedProposals.has(candidate.index)) continue;
    const dates = [candidate.row.date, ...availableDates.filter((date) => date !== candidate.row.date)];
    const start = minutes(candidate.row.start_time);
    const end = minutes(candidate.row.end_time);
    if (start !== null && end !== null) place(candidate.row, dates, end - start);
  }

  return scheduled.sort((left, right) =>
    left.date.localeCompare(right.date) || left.start_time.localeCompare(right.start_time),
  );
}