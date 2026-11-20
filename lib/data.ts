import { db, getSetting } from "@/lib/db";
import { schedule, scheduleQuestion } from "@/lib/srs";
import { TOPIC_KEYS, TOPICS, topicLabel } from "@/lib/topics";
import { anthropic, assertBudget, logUsage, MODELS } from "@/lib/claude";
import { searchLibrary, formatExcerpts } from "@/lib/search";

export type Card = { id: string; front: string; back: string; topic: string; source: string | null; reps: number; due_at: string };
export type Choice = { id: string; text: string };
export type Question = {
  id: string; stem: string; choices: Choice[]; answer: string; explanation: string;
  topic: string; difficulty: number; source: string | null; reps: number;
};

const cleanTopic = (t?: string | null) => (t && TOPIC_KEYS.includes(t) ? t : "general");

// ---------- Flashcards ----------
export async function dueCards(limit = 50, topic?: string) {
  return db()<Card[]>`
    select id, front, back, topic, source, reps, due_at from cardiacct.cards
    where not suspended and due_at <= now() ${topic ? db()`and topic = ${topic}` : db()``}
    order by due_at asc limit ${limit}`;
}

export async function reviewCard(cardId: string, grade: 0 | 1 | 2 | 3, at?: Date) {
  const rows = await db()`select ease, interval_days, reps, lapses from cardiacct.cards where id = ${cardId}`;
  if (!rows.length) return null;
  const s = rows[0] as { ease: number; interval_days: number; reps: number; lapses: number };
  const r = schedule(s, grade, at ?? new Date());
  await db()`update cardiacct.cards set ease = ${r.ease}, interval_days = ${r.interval_days}, reps = ${r.reps},
    lapses = ${r.lapses}, due_at = ${r.due_at}, updated_at = now() where id = ${cardId}`;
  await db()`insert into cardiacct.card_reviews (card_id, grade, reviewed_at) values (${cardId}, ${grade}, ${at ?? new Date()})`;
  return { id: cardId, next_due: r.due_at, interval_days: r.interval_days };
}

export async function addCards(cards: { front: string; back: string; topic?: string; source?: string }[]) {
  const rows = cards
    .filter((c) => c.front?.trim() && c.back?.trim())
    .slice(0, 100)
    .map((c) => ({ front: c.front.trim(), back: c.back.trim(), topic: cleanTopic(c.topic), source: c.source ?? null }));
  if (!rows.length) return [];
  const out = await db()<{ id: string }[]>`insert into cardiacct.cards ${db()(rows)} returning id`;
  return out;
}

// ---------- Questions ----------
export async function nextQuestions(limit = 1, topic?: string) {
  return db()<Question[]>`
    select id, stem, choices, answer, explanation, topic, difficulty, source, reps from cardiacct.questions
    where not suspended and due_at <= now() ${topic ? db()`and topic = ${topic}` : db()``}
    order by reps asc, due_at asc, random() limit ${limit}`;
}

export async function answerQuestion(questionId: string, chosen: string) {
  const rows = await db()`select answer, explanation, ease, interval_days, reps from cardiacct.questions where id = ${questionId}`;
  if (!rows.length) return null;
  const q = rows[0] as { answer: string; explanation: string; ease: number; interval_days: number; reps: number };
  const correct = chosen.trim().toUpperCase() === q.answer.trim().toUpperCase();
  const r = scheduleQuestion(q, correct);
  await db()`update cardiacct.questions set ease = ${r.ease}, interval_days = ${r.interval_days}, reps = ${r.reps},
    due_at = ${r.due_at} where id = ${questionId}`;
  await db()`insert into cardiacct.attempts (question_id, chosen, correct) values (${questionId}, ${chosen}, ${correct})`;
  return { correct, answer: q.answer, explanation: q.explanation, next_due: r.due_at };
}

export async function addQuestions(qs: Partial<Question>[], source = "claude") {
  const rows = qs
    .filter((q) => q.stem && Array.isArray(q.choices) && q.choices.length >= 2 && q.answer && q.explanation)
    .slice(0, 50)
    .map((q) => ({
      stem: q.stem!.trim(),
      choices: db().json(q.choices!.map((c) => ({ id: String(c.id).toUpperCase(), text: String(c.text) })) as never),
      answer: String(q.answer).trim().toUpperCase(),
      explanation: q.explanation!.trim(),
      topic: cleanTopic(q.topic),
      difficulty: Math.min(3, Math.max(1, Number(q.difficulty) || 2)),
      source: q.source ?? source,
    }));
  if (!rows.length) return [];
  const out = await db()<{ id: string }[]>`insert into cardiacct.questions ${db()(rows)} returning id`;
  return out;
}

const QUESTION_TOOL = {
  name: "save_questions",
  description: "Save board-style multiple-choice questions to the question bank.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            stem: { type: "string", description: "Clinical vignette or direct question. Describe CT findings in words." },
            choices: {
              type: "array",
              items: { type: "object", properties: { id: { type: "string", enum: ["A", "B", "C", "D", "E"] }, text: { type: "string" } }, required: ["id", "text"] },
              minItems: 4, maxItems: 5,
            },
            answer: { type: "string", enum: ["A", "B", "C", "D", "E"] },
            explanation: { type: "string", description: "Why the answer is right AND why each distractor is wrong; cite guideline/version for thresholds; end with a one-line board pearl." },
            difficulty: { type: "integer", minimum: 1, maximum: 3 },
          },
          required: ["stem", "choices", "answer", "explanation", "difficulty"],
        },
      },
    },
    required: ["questions"],
  },
};

export async function generateQuestions(topic: string, count = 5, focus?: string) {
  await assertBudget();
  const t = TOPICS.find((x) => x.key === topic);
  const label = t?.label ?? "General cardiovascular CT";
  const hits = await searchLibrary(focus || t?.search || label, 8);
  const recent = await db()<{ stem: string }[]>`select stem from cardiacct.questions where topic = ${topic} order by created_at desc limit 40`;
  const n = Math.min(10, Math.max(1, count));
  const prompt = `Write ${n} original, board-style single-best-answer questions for the CBCCT cardiovascular CT exam.
Topic: ${label}${focus ? `\nSpecific focus: ${focus}` : ""}

Requirements:
- Mix difficulty (mostly 2–3). Prefer clinical vignettes that test interpretation, protocol choices, measurement technique, guideline thresholds and pitfalls — not trivia.
- 4–5 plausible choices; exactly one best answer. Vary which letter is correct.
- Explanations teach: why correct, why each distractor is wrong, guideline name/year for any cutoff.
- Write everything in your own words. Do not copy questions from any review book.
${hits.length ? `\nGround the questions in these excerpts from Kia's study library where relevant:\n\n${formatExcerpts(hits)}` : ""}
${recent.length ? `\nAvoid duplicating these existing stems:\n${recent.map((r) => "- " + r.stem.slice(0, 140)).join("\n")}` : ""}`;

  const client = anthropic();
  const msg = await client.messages.create({
    model: MODELS.writer,
    max_tokens: 12000,
    system: "You are an expert cardiovascular CT educator and board item-writer (SCCT/CBCCT level). Accuracy is paramount; if unsure of a number, do not use it.",
    tools: [QUESTION_TOOL],
    tool_choice: { type: "tool", name: "save_questions" },
    messages: [{ role: "user", content: prompt }],
  });
  await logUsage("questions", MODELS.writer, msg.usage);
  const block = msg.content.find((b) => b.type === "tool_use");
  const qs = ((block as { input?: { questions?: Partial<Question>[] } } | undefined)?.input?.questions ?? []).map((q) => ({ ...q, topic }));
  const ids = await addQuestions(qs, "claude-generated");
  return { created: ids.length };
}

const CARD_TOOL = {
  name: "save_cards",
  description: "Save atomic flashcards.",
  input_schema: {
    type: "object" as const,
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            front: { type: "string" },
            back: { type: "string" },
            topic: { type: "string", enum: [...TOPIC_KEYS, "general"] },
          },
          required: ["front", "back", "topic"],
        },
      },
    },
    required: ["cards"],
  },
};

export async function generateCards(text: string, max = 8) {
  await assertBudget();
  const client = anthropic();
  const msg = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 4000,
    tools: [CARD_TOOL],
    tool_choice: { type: "tool", name: "save_cards" },
    messages: [{
      role: "user",
      content: `Turn the high-yield, testable facts below into at most ${max} atomic flashcards for cardiovascular CT board prep. One fact or threshold per card; question on the front, concise answer on the back (include the guideline/version for cutoffs if stated). Skip anything trivial.\n\n${text.slice(0, 30000)}`,
    }],
  });
  await logUsage("cards", MODELS.fast, msg.usage);
  const block = msg.content.find((b) => b.type === "tool_use");
  const cards = (block as { input?: { cards?: { front: string; back: string; topic: string }[] } } | undefined)?.input?.cards ?? [];
  const ids = await addCards(cards.map((c) => ({ ...c, source: "tutor" })));
  return { created: ids.length };
}

// ---------- Notes ----------
export async function addNote(title: string, body: string) {
  const [doc] = await db()<{ id: string }[]>`insert into cardiacct.docs (title, kind) values (${title.slice(0, 200)}, 'note') returning id`;
  const chunks = chunkText(body).map((content, ord) => ({ doc_id: doc.id, ord, page: null, heading: title.slice(0, 200), content }));
  if (chunks.length) await db()`insert into cardiacct.chunks ${db()(chunks)}`;
  return { id: doc.id };
}

export function chunkText(text: string, size = 1400) {
  const paras = text.replace(/\r/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > size && cur) {
      out.push(cur);
      cur = p;
    } else cur = cur ? cur + "\n\n" + p : p;
    while (cur.length > size * 1.5) {
      out.push(cur.slice(0, size));
      cur = cur.slice(size);
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- Status ----------
export async function studyStatus() {
  const sql = db();
  const [[c], [q], topics, daily, examDate] = await Promise.all([
    sql`select count(*) filter (where due_at <= now() and not suspended)::int as due,
               count(*)::int as total,
               count(*) filter (where reps >= 3)::int as mature
        from cardiacct.cards`,
    sql`select count(*) filter (where due_at <= now() and not suspended)::int as due,
               count(*)::int as total from cardiacct.questions`,
    sql`select q.topic, count(*)::int as attempts, avg(case when a.correct then 1 else 0 end)::float as accuracy
        from cardiacct.attempts a join cardiacct.questions q on q.id = a.question_id
        where a.created_at > now() - interval '60 days'
        group by q.topic order by accuracy asc`,
    sql`select to_char(d, 'YYYY-MM-DD') as day,
               (select count(*) from cardiacct.card_reviews r where (r.reviewed_at at time zone 'America/Denver')::date = d)::int as cards,
               (select count(*) from cardiacct.attempts a where (a.created_at at time zone 'America/Denver')::date = d)::int as questions
        from generate_series((now() at time zone 'America/Denver')::date - 13, (now() at time zone 'America/Denver')::date, '1 day') d
        order by d`,
    getSetting<string>("exam_date", "2027-10-01"),
  ]);
  const days = Math.ceil((new Date(examDate + "T08:00:00-06:00").getTime() - Date.now()) / 86400000);
  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    const d = daily[i] as { cards: number; questions: number };
    if (d.cards + d.questions > 0) streak++;
    else if (i < daily.length - 1) break;
  }
  return {
    cards: c as { due: number; total: number; mature: number },
    questions: q as { due: number; total: number },
    topics: (topics as unknown as { topic: string; attempts: number; accuracy: number }[]).map((t) => ({ ...t, label: topicLabel(t.topic) })),
    daily: daily as unknown as { day: string; cards: number; questions: number }[],
    exam_date: examDate,
    days_to_exam: days,
    streak,
  };
}
