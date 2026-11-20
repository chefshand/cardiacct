import { db } from "@/lib/db";

export type Hit = { id: string; doc_id: string; title: string; page: number | null; heading: string | null; content: string; rank: number };

/** Full-text search over the library (study guides, uploaded books, notes). */
export async function searchLibrary(query: string, limit = 6): Promise<Hit[]> {
  const q = query.trim().slice(0, 500);
  if (!q) return [];
  // Prefer an AND-style web search query; fall back to OR of significant words if nothing matches.
  let rows = await db()<Hit[]>`
    select c.id, c.doc_id, d.title, c.page, c.heading, c.content,
           ts_rank_cd(c.tsv, websearch_to_tsquery('english', ${q})) as rank
    from cardiacct.chunks c join cardiacct.docs d on d.id = c.doc_id
    where c.tsv @@ websearch_to_tsquery('english', ${q})
    order by rank desc limit ${limit}`;
  if (rows.length === 0) {
    const words = q
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 12);
    if (!words.length) return [];
    const orq = words.join(" or ");
    rows = await db()<Hit[]>`
      select c.id, c.doc_id, d.title, c.page, c.heading, c.content,
             ts_rank_cd(c.tsv, websearch_to_tsquery('english', ${orq})) as rank
      from cardiacct.chunks c join cardiacct.docs d on d.id = c.doc_id
      where c.tsv @@ websearch_to_tsquery('english', ${orq})
      order by rank desc limit ${limit}`;
  }
  return rows;
}

export function formatExcerpts(hits: Hit[]) {
  return hits
    .map((h, i) => `[${i + 1}] ${h.title}${h.page ? `, p.${h.page}` : ""}${h.heading ? ` — ${h.heading}` : ""}\n${h.content}`)
    .join("\n\n---\n\n");
}
