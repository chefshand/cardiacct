import { addCards, dueCards } from "@/lib/data";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const limit = Math.min(200, Number(u.searchParams.get("limit")) || 100);
    const topic = u.searchParams.get("topic") || undefined;
    return ok({ cards: await dueCards(limit, topic) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const { cards } = await req.json();
    const ids = await addCards(Array.isArray(cards) ? cards : []);
    return ok({ created: ids.length });
  } catch (e) {
    return fail(e);
  }
}
