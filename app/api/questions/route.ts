import { generateQuestions, nextQuestions } from "@/lib/data";
import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const topic = u.searchParams.get("topic") || undefined;
    const [q] = await nextQuestions(1, topic);
    const counts = await db()`select topic, count(*)::int as total,
        count(*) filter (where due_at <= now() and not suspended)::int as due
      from cardiacct.questions group by topic`;
    // Answer is withheld until the user commits to a choice.
    const question = q ? { id: q.id, stem: q.stem, choices: q.choices, topic: q.topic, difficulty: q.difficulty, reps: q.reps } : null;
    return ok({ question, counts });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const { topic, count, focus } = await req.json();
    return ok(await generateQuestions(String(topic || "general"), Number(count) || 5, focus ? String(focus) : undefined));
  } catch (e) {
    return fail(e);
  }
}
