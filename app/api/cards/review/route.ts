import { reviewCard } from "@/lib/data";
import { fail, ok } from "@/lib/http";

// Accepts a batch so reviews done offline can be synced in one request.
export async function POST(req: Request) {
  try {
    const { reviews } = (await req.json()) as { reviews: { id: string; grade: number; at?: string }[] };
    let synced = 0;
    for (const r of (reviews ?? []).slice(0, 500)) {
      const g = Math.round(r.grade);
      if (g < 0 || g > 3) continue;
      const res = await reviewCard(r.id, g as 0 | 1 | 2 | 3, r.at ? new Date(r.at) : undefined);
      if (res) synced++;
    }
    return ok({ synced });
  } catch (e) {
    return fail(e);
  }
}
