import { db } from "@/lib/db";
import { anthropic, assertBudget, logUsage, MODELS, TUTOR_SYSTEM } from "@/lib/claude";
import { searchLibrary, formatExcerpts } from "@/lib/search";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { conversationId, message, context } = (await req.json()) as { conversationId?: string; message: string; context?: string };
    if (!message?.trim()) return new Response("Empty message", { status: 400 });
    await assertBudget();
    const sql = db();

    let convId = conversationId;
    if (!convId) {
      const [c] = await sql`insert into cardiacct.conversations (title) values (${message.trim().slice(0, 80)}) returning id`;
      convId = c.id as string;
    }
    const history = (await sql`select role, content from cardiacct.messages where conversation_id = ${convId}
      order by created_at desc limit 20`).reverse() as unknown as { role: "user" | "assistant"; content: string }[];

    const userText = context ? `${context.trim()}\n\n${message.trim()}` : message.trim();
    await sql`insert into cardiacct.messages (conversation_id, role, content) values (${convId}, 'user', ${userText})`;

    const hits = await searchLibrary(message, 6);
    const excerpts = hits.length
      ? `\n\n<library_excerpts>\n${formatExcerpts(hits)}\n</library_excerpts>\nCite these as [n] where you use them.`
      : "";

    const client = anthropic();
    const stream = client.messages.stream({
      model: MODELS.tutor,
      max_tokens: 6000,
      system: TUTOR_SYSTEM,
      messages: [...history, { role: "user", content: userText + excerpts }],
    });

    const sources = hits.map((h, i) => ({ n: i + 1, title: h.title, page: h.page }));
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        let full = "";
        try {
          for await (const ev of stream) {
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              full += ev.delta.text;
              controller.enqueue(encoder.encode(ev.delta.text));
            }
          }
          const final = await stream.finalMessage();
          await logUsage("tutor", MODELS.tutor, final.usage);
          await sql`insert into cardiacct.messages (conversation_id, role, content) values (${convId}, 'assistant', ${full})`;
          await sql`update cardiacct.conversations set updated_at = now() where id = ${convId}`;
        } catch (e) {
          controller.enqueue(encoder.encode(`\n\n**Error:** ${e instanceof Error ? e.message : String(e)}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Conversation-Id": convId,
        "X-Sources": encodeURIComponent(JSON.stringify(sources)),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
