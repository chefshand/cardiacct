import Anthropic from "@anthropic-ai/sdk";
import { db, getSetting } from "@/lib/db";

export const MODELS = {
  tutor: process.env.TUTOR_MODEL || "claude-opus-5-5",
  writer: process.env.WRITER_MODEL || "claude-opus-5-5",
  fast: process.env.FAST_MODEL || "claude-haiku-5-5",
};

// USD per million tokens (platform.claude.com/docs/en/about-claude/pricing, Nov 2026).
function price(model: string, inputTokens: number) {
  if (model.includes("haiku")) return inputTokens > 100_000 ? { in: 0.5, out: 2.5 } : { in: 0.1, out: 0.5 };
  if (model.includes("sonnet")) return { in: 2, out: 10 };
  if (model.includes("fable")) return { in: 8, out: 40 };
  return { in: 4, out: 20 }; // opus
}

export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic();
}

type Usage = { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

export async function logUsage(feature: string, model: string, usage: Usage) {
  const input = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  const output = usage.output_tokens ?? 0;
  const p = price(model, input);
  const cost = (input * p.in + output * p.out) / 1_000_000;
  await db()`insert into cardiacct.usage (feature, model, input_tokens, output_tokens, cost_usd)
    values (${feature}, ${model}, ${input}, ${output}, ${cost})`;
  return cost;
}

export async function monthSpend() {
  const rows = await db()`select coalesce(sum(cost_usd),0)::float as total from cardiacct.usage
    where created_at >= date_trunc('month', now() at time zone 'America/Denver') at time zone 'America/Denver'`;
  return Number(rows[0].total);
}

export async function budget() {
  const env = process.env.MONTHLY_BUDGET_USD ? Number(process.env.MONTHLY_BUDGET_USD) : undefined;
  return env ?? Number(await getSetting<number>("monthly_budget_usd", 50));
}

/** Throws a user-readable error when this month's spend has reached the cap. */
export async function assertBudget() {
  const [spent, cap] = await Promise.all([monthSpend(), budget()]);
  if (cap > 0 && spent >= cap) {
    throw new BudgetError(`Monthly AI budget reached ($${spent.toFixed(2)} of $${cap}). Raise it in Settings or wait until next month.`);
  }
  return { spent, cap };
}

export class BudgetError extends Error {}

export const TUTOR_SYSTEM = `You are a cardiovascular CT tutor for Kia Afshar, MD, FACC — a practicing cardiologist board-certified in cardiovascular disease, echocardiography, nuclear cardiology and advanced heart failure/transplant, with structural heart and cardiac amyloidosis expertise. He is working through the SCCT Level 2 course and preparing for the CBCCT cardiovascular CT board exam (target fall 2027).

How to teach:
- He is an expert clinician but newer to CT. Build from foundations (physics, anatomy on CT, reconstruction planes) before nuance; never assume CT background. Bridge from echo/nuclear/cath concepts he already knows.
- Be textbook-quality and precise. Use concrete numbers (thresholds, HU, mm, dose) and name the guideline/document and year when you cite a cutoff (e.g., CAD-RADS 2.0 2022, SCCT 2016 guidelines, 2020 ACC/AHA valve). If recommendations differ between societies or have changed, say so.
- When excerpts from his library are provided, ground your answer in them and cite them inline as [1], [2]… matching the excerpt numbers. If the excerpts don't cover something, answer from your own knowledge and say so briefly.
- End substantive answers with a short "Board pearls" list (2–5 bullets) when relevant.
- For reading technique, give a systematic step-by-step approach (planes, windows, what to measure, pitfalls).
- If he pastes images or case details, never request or repeat patient identifiers.
- Use Markdown with headings and tables where they help. Be direct; skip filler.`;
