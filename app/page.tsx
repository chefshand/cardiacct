import Link from "next/link";
import { studyStatus } from "@/lib/data";
import { budget, monthSpend } from "@/lib/claude";
import { TOPICS } from "@/lib/topics";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [s, spent, cap] = await Promise.all([studyStatus(), monthSpend(), budget()]);
  const max = Math.max(1, ...s.daily.map((d) => d.cards + d.questions));
  const examLabel = new Date(s.exam_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const untested = TOPICS.filter((t) => !s.topics.find((x) => x.topic === t.key));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {s.days_to_exam > 0 ? `${s.days_to_exam} days to boards (${examLabel})` : "Exam date passed — update it in Settings"}
            {s.streak > 0 && ` · ${s.streak}-day streak`}
          </p>
        </div>
        <Link href="/tutor" className="btn">Ask the tutor</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/review" className="card p-5 hover:border-[var(--color-accent)] transition">
          <div className="label">Flashcards due</div>
          <div className="text-4xl font-bold mt-1">{s.cards.due}</div>
          <div className="text-sm text-[var(--color-muted)] mt-1">{s.cards.total} in deck · {s.cards.mature} mature</div>
          <div className="btn btn-primary mt-4 w-full">{s.cards.due ? "Review now" : "Browse deck"}</div>
        </Link>
        <Link href="/questions" className="card p-5 hover:border-[var(--color-accent)] transition">
          <div className="label">Questions due</div>
          <div className="text-4xl font-bold mt-1">{s.questions.due}</div>
          <div className="text-sm text-[var(--color-muted)] mt-1">{s.questions.total} in bank</div>
          <div className="btn btn-primary mt-4 w-full">{s.questions.total ? "Start questions" : "Generate first set"}</div>
        </Link>
        <div className="card p-5">
          <div className="label">Last 14 days</div>
          <div className="flex items-end gap-1 h-20 mt-3" aria-label="Daily activity">
            {s.daily.map((d) => {
              const n = d.cards + d.questions;
              return (
                <div key={d.day} className="flex-1 flex flex-col justify-end" title={`${d.day}: ${d.cards} cards, ${d.questions} questions`}>
                  <div className="rounded-sm bg-[var(--color-accent)]" style={{ height: `${Math.max(n ? 6 : 2, (n / max) * 100)}%`, opacity: n ? 1 : 0.2 }} />
                </div>
              );
            })}
          </div>
          <div className="text-xs text-[var(--color-muted)] mt-2">
            AI spend this month: ${spent.toFixed(2)} {cap > 0 ? `of $${cap}` : ""}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Accuracy by topic (60 days)</h2>
          <Link href="/questions" className="text-sm text-[var(--color-accent)]">Practice weakest →</Link>
        </div>
        {s.topics.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] mt-3">No questions answered yet. Generate a set on the Questions page to start tracking.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {s.topics.map((t) => (
              <Link key={t.topic} href={`/questions?topic=${t.topic}`} className="block">
                <div className="flex justify-between text-sm">
                  <span>{t.label}</span>
                  <span className="text-[var(--color-muted)]">{Math.round(t.accuracy * 100)}% · {t.attempts}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-line)] mt-1 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(t.accuracy * 100)}%`, background: t.accuracy >= 0.75 ? "var(--color-good)" : t.accuracy >= 0.6 ? "var(--color-warn)" : "var(--color-bad)" }} />
                </div>
              </Link>
            ))}
          </div>
        )}
        {untested.length > 0 && (
          <div className="mt-4">
            <div className="label mb-2">Not yet tested</div>
            <div className="flex flex-wrap gap-2">
              {untested.map((t) => (
                <Link key={t.key} href={`/questions?topic=${t.key}`} className="chip">{t.label}</Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
