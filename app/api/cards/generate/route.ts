import { generateCards } from "@/lib/data";
import { fail, ok } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { text, max } = await req.json();
    if (!text || typeof text !== "string") return ok({ error: "No text" }, 400);
    return ok(await generateCards(text, Math.min(20, Number(max) || 8)));
  } catch (e) {
    return fail(e);
  }
}
