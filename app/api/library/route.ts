import { db } from "@/lib/db";
import { addNote } from "@/lib/data";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const docs = await db()`select d.id, d.title, d.kind, d.pages, d.created_at, count(c.id)::int as chunks
      from cardiacct.docs d left join cardiacct.chunks c on c.doc_id = d.id
      group by d.id order by d.kind, d.title`;
    return ok({ docs });
  } catch (e) {
    return fail(e);
  }
}

type ChunkIn = { page?: number | null; heading?: string | null; content: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sql = db();
    if (body.action === "create") {
      const kind = ["guide", "book", "note", "other"].includes(body.kind) ? body.kind : "other";
      const existing = await sql`select id from cardiacct.docs where title = ${String(body.title)} and kind = ${kind}`;
      if (existing.length && body.replace) await sql`delete from cardiacct.docs where id = ${existing[0].id}`;
      else if (existing.length) return ok({ error: "A document with this title already exists", id: existing[0].id }, 409);
      const [d] = await sql`insert into cardiacct.docs (title, kind, pages) values (${String(body.title).slice(0, 300)}, ${kind}, ${body.pages ?? null}) returning id`;
      return ok({ id: d.id });
    }
    if (body.action === "chunks") {
      const start = Number(body.start) || 0;
      const rows = ((body.chunks ?? []) as ChunkIn[])
        .filter((c) => c.content && c.content.trim().length > 20)
        .slice(0, 400)
        .map((c, i) => ({
          doc_id: String(body.doc_id),
          ord: start + i,
          page: c.page ?? null,
          heading: c.heading ? String(c.heading).slice(0, 300) : null,
          content: String(c.content).replace(/\u0000/g, "").slice(0, 6000),
        }));
      if (rows.length) await sql`insert into cardiacct.chunks ${sql(rows)}`;
      return ok({ inserted: rows.length });
    }
    if (body.action === "note") {
      return ok(await addNote(String(body.title || "Note"), String(body.body || "")));
    }
    return ok({ error: "Unknown action" }, 400);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) await db()`delete from cardiacct.docs where id = ${id}`;
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
