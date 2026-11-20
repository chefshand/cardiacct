# Cardiac CT — cardiacct.kiaafshar.org

Private cardiovascular CT board-prep studio (PWA) for Kia Afshar, MD.

## Features
- **Today**: due cards and questions, 14-day activity, accuracy by topic, days to boards, AI spend.
- **Flashcards**: SM-2 spaced repetition, keyboard shortcuts (space, 1–4), works offline (reviews queue and sync).
- **Questions**: original board-style MCQs written by Claude (Opus), grounded in the library, with spaced repetition and topic analytics.
- **Tutor**: streaming Claude tutor with full-text retrieval over the library, inline citations, one-click "Make flashcards" / "Save as note".
- **Library**: drop PDFs / Markdown / HTML / a .zip (e.g. *Cardiac CT Study Guides.zip*). Text is extracted in the browser; only the text is stored.
- **Tools**: CAD-RADS 2.0 builder, Agatston + CAC-DRS, DLP→mSv, TAVR annulus, aortic indexing, iodine delivery.
- **Claude Desktop connector**: remote MCP server at `/api/mcp/<MCP_TOKEN>`. Tools: study status, due cards/questions, record reviews/answers, add cards/questions, search library, save notes.
- **Budget cap**: monthly AI spend tracked per call; requests stop at the cap (Settings).

## Stack
Next.js 15 (App Router) on Vercel · Supabase Postgres (isolated `cardiacct` schema, accessed server-side only through the least-privilege `cardiacct_app` role) · Anthropic API · single-user password sign-in (signed 1-year cookie).

## Environment variables (Vercel → Settings → Environment Variables)
See `.env.example`.

| Name | What |
|---|---|
| `DATABASE_URL` | Transaction-pooler URL with the `cardiacct_app` role |
| `ANTHROPIC_API_KEY` | Anthropic Console key |
| `APP_PASSWORD` | Your sign-in password |
| `SESSION_SECRET` | 48+ random chars |
| `MCP_TOKEN` | 32+ random chars (part of the connector URL) |
| `MONTHLY_BUDGET_USD` | optional; otherwise set in the app |

## Local dev
`npm install && npm run dev` with a `.env.local`.
