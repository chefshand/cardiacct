import { searchLibrary } from "@/lib/search";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return ok({ hits: await searchLibrary(q, 15) });
  } catch (e) {
    return fail(e);
  }
}
