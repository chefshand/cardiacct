import { headers } from "next/headers";
import { db, getSetting } from "@/lib/db";
import { budget, monthSpend, MODELS } from "@/lib/claude";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "cardiacct.kiaafshar.org";
  const token = process.env.MCP_TOKEN;
  const mcpUrl = token ? `https://${host}/api/mcp/${token}` : null;
  const [examDate, cap, spent, byFeature] = await Promise.all([
    getSetting<string>("exam_date", "2027-10-01"),
    budget(),
    monthSpend(),
    db()`select feature, model, count(*)::int as calls, sum(cost_usd)::float as cost from cardiacct.usage
      where created_at >= date_trunc('month', now() at time zone 'America/Denver') at time zone 'America/Denver'
      group by feature, model order by cost desc`,
  ]);

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <SettingsForm examDate={examDate} budget={cap} envBudget={!!process.env.MONTHLY_BUDGET_USD} />

      <section className="card p-5 space-y-2">
        <h2 className="font-semibold">AI usage this month</h2>
        <p className="text-sm">${spent.toFixed(2)} {cap > 0 ? `of $${cap} cap` : "(no cap)"}</p>
        <p className="text-xs text-[var(--color-muted)]">Tutor: {MODELS.tutor} · Question writer: {MODELS.writer} · Flashcards: {MODELS.fast}</p>
        {byFeature.length > 0 && (
          <table className="text-sm w-full mt-2">
            <tbody>
              {byFeature.map((r) => (
                <tr key={`${r.feature}-${r.model}`} className="border-t border-[var(--color-line)]">
                  <td className="py-1">{r.feature}</td><td className="text-[var(--color-muted)]">{r.model}</td>
                  <td className="text-right">{r.calls} calls</td><td className="text-right">${Number(r.cost).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">Connect Claude Desktop</h2>
        {mcpUrl ? (
          <>
            <p className="text-sm">In Claude (desktop or claude.ai): <b>Settings → Connectors → Add custom connector</b>. Name it <i>Cardiac CT</i> and paste this URL. Leave the OAuth fields empty.</p>
            <code className="block text-xs break-all bg-[var(--color-accent-soft)] rounded-lg p-3">{mcpUrl}</code>
            <p className="text-xs text-[var(--color-muted)]">Treat this URL like a password: anyone with it can read and add to your study data. To revoke it, change MCP_TOKEN in Vercel and redeploy.</p>
            <p className="text-sm">Then try: <i>&quot;Quiz me on my due cardiac CT flashcards&quot;</i>, <i>&quot;What are my weakest topics? Give me 5 questions on the weakest one and save them to my bank&quot;</i>, or <i>&quot;Make flashcards from what we just discussed&quot;</i>.</p>
          </>
        ) : (
          <p className="text-sm text-[var(--color-warn)]">Set MCP_TOKEN in Vercel to enable the connector.</p>
        )}
      </section>

      <section className="card p-5 space-y-2">
        <h2 className="font-semibold">Install as an app</h2>
        <p className="text-sm"><b>iPhone/iPad:</b> open in Safari → Share → Add to Home Screen. <b>Mac (Chrome):</b> address bar install icon. <b>Mac (Safari):</b> File → Add to Dock.</p>
        <p className="text-xs text-[var(--color-muted)]">Flashcards keep working offline; reviews sync when you&apos;re back online.</p>
      </section>
    </div>
  );
}
