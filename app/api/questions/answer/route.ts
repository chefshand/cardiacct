import { answerQuestion } from "@/lib/data";
import { fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const { id, chosen } = await req.json();
    const r = await answerQuestion(String(id), String(chosen));
    return r ? ok(r) : ok({ error: "Question not found" }, 404);
  } catch (e) {
    return fail(e);
  }
}
