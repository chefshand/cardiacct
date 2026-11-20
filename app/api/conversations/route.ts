import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const messages = await db()`select role, content, created_at from cardiacct.messages
        where conversation_id = ${id} order by created_at`;
      return ok({ messages });
    }
    const conversations = await db()`select id, title, updated_at from cardiacct.conversations order by updated_at desc limit 100`;
    return ok({ conversations });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) await db()`delete from cardiacct.conversations where id = ${id}`;
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
