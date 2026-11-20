// Remote MCP server (Streamable HTTP, JSON responses) so Claude Desktop / claude.ai can
// quiz Kia from his own card and question bank and save new material back to the site.
// Auth: secret token in the URL path (MCP_TOKEN). Add as a custom connector:
//   https://cardiacct.kiaafshar.org/api/mcp/<MCP_TOKEN>
import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import {
  addCards, addNote, addQuestions, answerQuestion, dueCards, nextQuestions, reviewCard, studyStatus,
} from "@/lib/data";
import { searchLibrary } from "@/lib/search";
import { TOPICS, TOPIC_KEYS } from "@/lib/topics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SERVER_INFO = { name: "cardiacct", title: "Cardiac CT Study (cardiacct.kiaafshar.org)", version: "1.0.0" };
const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

const topicEnum = { type: "string", enum: [...TOPIC_KEYS, "general"], description: TOPICS.map((t) => `${t.key} = ${t.label}`).join("; ") };

const TOOLS = [
  {
    name: "get_study_status",
    description: "Kia's cardiac CT study dashboard: due flashcards and questions, totals, 14-day activity, accuracy by topic (weakest first), days until the board exam. Call this first when asked to quiz him or plan a session.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_due_flashcards",
    description: "Fetch flashcards that are due for spaced-repetition review. Show the FRONT only, let Kia answer, then reveal the back and ask how well he knew it (again / hard / good / easy), then call review_flashcard.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50, default: 10 }, topic: topicEnum } },
  },
  {
    name: "review_flashcard",
    description: "Record Kia's self-grade for a flashcard and reschedule it. grade: 0 = again (didn't know), 1 = hard, 2 = good, 3 = easy.",
    inputSchema: { type: "object", properties: { card_id: { type: "string" }, grade: { type: "integer", minimum: 0, maximum: 3 } }, required: ["card_id", "grade"] },
  },
  {
    name: "add_flashcards",
    description: "Save new atomic flashcards to Kia's deck (one fact or threshold per card). Use after explaining a concept, or when he asks to remember something.",
    inputSchema: {
      type: "object",
      properties: {
        cards: {
          type: "array",
          items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" }, topic: topicEnum }, required: ["front", "back"] },
        },
      },
      required: ["cards"],
    },
  },
  {
    name: "get_due_questions",
    description: "Fetch board-style MCQs that are due. Includes the answer and explanation — DO NOT reveal them until Kia commits to a choice. Then call record_question_answer.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 20, default: 5 }, topic: topicEnum } },
  },
  {
    name: "record_question_answer",
    description: "Record Kia's chosen letter for a question; returns whether it was correct plus the explanation, and reschedules the question.",
    inputSchema: { type: "object", properties: { question_id: { type: "string" }, chosen: { type: "string", description: "Letter A–E" } }, required: ["question_id", "chosen"] },
  },
  {
    name: "add_questions",
    description: "Save original board-style single-best-answer questions to the bank (4–5 choices, exactly one correct, explanation covering why each distractor is wrong).",
    inputSchema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              stem: { type: "string" },
              choices: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" } }, required: ["id", "text"] } },
              answer: { type: "string" },
              explanation: { type: "string" },
              topic: topicEnum,
              difficulty: { type: "integer", minimum: 1, maximum: 3 },
            },
            required: ["stem", "choices", "answer", "explanation"],
          },
        },
      },
      required: ["questions"],
    },
  },
  {
    name: "search_library",
    description: "Full-text search Kia's study library (his SCCT Level 2 module study guides, tutorials, uploaded textbook PDFs and notes). Returns excerpts with document title and page. Use to ground answers and cite sources.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 15, default: 6 } }, required: ["query"] },
  },
  {
    name: "save_note",
    description: "Save a study note (Markdown) to Kia's library so it becomes searchable on the site and by the tutor.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"] },
  },
];

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

function text(data: unknown) {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

async function callTool(name: string, a: Record<string, unknown>) {
  switch (name) {
    case "get_study_status":
      return text(await studyStatus());
    case "get_due_flashcards":
      return text(await dueCards(Number(a.limit) || 10, a.topic ? String(a.topic) : undefined));
    case "review_flashcard":
      return text((await reviewCard(String(a.card_id), Math.max(0, Math.min(3, Number(a.grade))) as 0 | 1 | 2 | 3)) ?? "Card not found");
    case "add_flashcards":
      return text({ created: (await addCards(((a.cards as never[]) ?? []).map((c: object) => ({ ...(c as object), source: "claude-desktop" }) as never))).length });
    case "get_due_questions":
      return text(await nextQuestions(Number(a.limit) || 5, a.topic ? String(a.topic) : undefined));
    case "record_question_answer":
      return text((await answerQuestion(String(a.question_id), String(a.chosen))) ?? "Question not found");
    case "add_questions":
      return text({ created: (await addQuestions((a.questions as never[]) ?? [], "claude-desktop")).length });
    case "search_library":
      return text(await searchLibrary(String(a.query ?? ""), Number(a.limit) || 6));
    case "save_note":
      return text(await addNote(String(a.title), String(a.body)));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handle(msg: Rpc) {
  const id = msg.id ?? null;
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const error = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
  switch (msg.method) {
    case "initialize": {
      const requested = String(msg.params?.protocolVersion ?? "");
      return reply({
        protocolVersion: SUPPORTED.includes(requested) ? requested : SUPPORTED[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Kia's personal cardiac CT board-prep data. Use get_study_status to see what's due and his weakest topics; quiz him with get_due_flashcards / get_due_questions and record results; save new flashcards, questions and notes he asks for.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      try {
        return reply(await callTool(name, (msg.params?.arguments as Record<string, unknown>) ?? {}));
      } catch (e) {
        return reply({ ...text(`Error: ${e instanceof Error ? e.message : String(e)}`), isError: true });
      }
    }
    case "resources/list":
      return reply({ resources: [] });
    case "prompts/list":
      return reply({ prompts: [] });
    default:
      return error(-32601, `Method not found: ${msg.method}`);
  }
}

function authorized(token: string) {
  const expected = process.env.MCP_TOKEN;
  return !!expected && expected.length >= 24 && safeEqual(token, expected);
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!authorized(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Rpc | Rpc[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const msgs = Array.isArray(body) ? body : [body];
  const requests = msgs.filter((m) => m.id !== undefined && m.id !== null);
  if (!requests.length) return new Response(null, { status: 202 }); // notifications only
  const results = await Promise.all(requests.map(handle));
  return NextResponse.json(Array.isArray(body) ? results : results[0]);
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!authorized(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // No server-initiated streams.
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new Response(null, { status: 405 });
}
