import { setSetting } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body.exam_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.exam_date)) await setSetting("exam_date", body.exam_date);
    if (body.monthly_budget_usd !== undefined) {
      const n = Number(body.monthly_budget_usd);
      if (Number.isFinite(n) && n >= 0 && n <= 2000) await setSetting("monthly_budget_usd", n);
    }
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
