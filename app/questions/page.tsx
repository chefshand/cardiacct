"use client";
import { useCallback, useEffect, useState } from "react";
import Markdown from "@/components/Markdown";
import { TOPICS, topicLabel } from "@/lib/topics";

type Q = { id: string; stem: string; choices: { id: string; text: string }[]; topic: string; difficulty: number };
type Result = { correct: boolean; answer: string; explanation: string };
type Count = { topic: string; total: number; due: number };

export default function Questions() {
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState<Q | null>(null);
  const [counts, setCounts] = useState<Count[]>([]);
  const [chosen, setChosen] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState({ right: 0, total: 0 });
  const [gen, setGen] = useState({ topic: "", count: 5, focus: "", busy: false, msg: "" });

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setChosen("");
    setResult(null);
    const r = await fetch(`/api/questions${t ? `?topic=${t}` : ""}`, { cache: "no-store" });
    const j = await r.json();
    setQ(j.question);
    setCounts(j.counts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("topic") ?? "";
    setTopic(t);
    setGen((g) => ({ ...g, topic: t || "cad" }));
    load(t);
  }, [load]);

  async function submit() {
    if (!q || !chosen) return;
    const r = await fetch("/api/questions/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: q.id, chosen }) });
    const j: Result = await r.json();
    setResult(j);
    setSession((s) => ({ right: s.right + (j.correct ? 1 : 0), total: s.total + 1 }));
  }

  async function generate() {
    setGen((g) => ({ ...g, busy: true, msg: "Writing questions… (about 30–90 seconds)" }));
    const r = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: gen.topic, count: gen.count, focus: gen.focus || undefined }) });
    const j = await r.json();
    setGen((g) => ({ ...g, busy: false, msg: j.error ? j.error : `Added ${j.created} questions.` }));
    if (!j.error) load(topic);
  }

  function askTutor() {
    if (!q || !result) return;
    const ctx = `I just answered this board question (I chose ${chosen}; correct answer ${result.answer}).\n\n**Question:** ${q.stem}\n\n${q.choices.map((c) => `${c.id}. ${c.text}`).join("\n")}\n\n**Explanation given:** ${result.explanation}`;
    sessionStorage.setItem("ct_tutor_context", ctx);
    window.location.href = "/tutor";
  }

  const totals = counts.reduce((a, c) => ({ total: a.total + c.total, due: a.due + c.due }), { total: 0, due: 0 });

  return (
    <div className="grid md:grid-cols-[1fr_300px] gap-5">
      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Questions</h1>
            <p className="text-sm text-[var(--color-muted)]">
              {totals.due} due of {totals.total}{session.total > 0 && ` · this session ${session.right}/${session.total}`}
            </p>
          </div>
          <select className="input !w-auto text-sm" value={topic} onChange={(e) => { setTopic(e.target.value); load(e.target.value); }}>
            <option value="">All topics</option>
            {TOPICS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="card p-8 text-center text-[var(--color-muted)]">Loading…</div>
        ) : !q ? (
          <div className="card p-8 text-center space-y-2">
            <div className="text-lg font-semibold">No questions due{topic ? ` in ${topicLabel(topic)}` : ""}</div>
            <p className="text-sm text-[var(--color-muted)]">Generate a fresh set with the panel on the right.</p>
          </div>
        ) : (
          <div className="card p-6 space-y-4">
            <div className="flex gap-2 items-center">
              <span className="chip">{topicLabel(q.topic)}</span>
              <span className="text-xs text-[var(--color-muted)]">{"●".repeat(q.difficulty)}{"○".repeat(3 - q.difficulty)}</span>
            </div>
            <Markdown>{q.stem}</Markdown>
            <div className="space-y-2">
              {q.choices.map((c) => {
                const isAns = result && c.id === result.answer;
                const isWrong = result && c.id === chosen && !result.correct;
                return (
                  <button key={c.id} disabled={!!result} onClick={() => setChosen(c.id)}
                    className="w-full text-left rounded-xl border px-4 py-3 flex gap-3 transition"
                    style={{
                      borderColor: isAns ? "var(--color-good)" : isWrong ? "var(--color-bad)" : chosen === c.id ? "var(--color-accent)" : "var(--color-line)",
                      background: isAns ? "color-mix(in srgb, var(--color-good) 10%, transparent)" : isWrong ? "color-mix(in srgb, var(--color-bad) 10%, transparent)" : chosen === c.id ? "var(--color-accent-soft)" : "transparent",
                    }}>
                    <span className="font-bold w-5 shrink-0">{c.id}</span>
                    <span>{c.text}</span>
                  </button>
                );
              })}
            </div>
            {!result ? (
              <button className="btn btn-primary w-full" disabled={!chosen} onClick={submit}>Submit answer</button>
            ) : (
              <div className="space-y-4">
                <div className="font-semibold" style={{ color: result.correct ? "var(--color-good)" : "var(--color-bad)" }}>
                  {result.correct ? "Correct" : `Incorrect — answer is ${result.answer}`}
                </div>
                <div className="rounded-xl bg-[var(--color-accent-soft)] p-4"><Markdown>{result.explanation}</Markdown></div>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn btn-primary" onClick={() => load(topic)}>Next question</button>
                  <button className="btn" onClick={askTutor}>Ask the tutor about this</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold">Generate questions</h2>
          <p className="text-xs text-[var(--color-muted)]">Original board-style items written by Claude, grounded in your library when it has relevant material.</p>
          <select className="input text-sm" value={gen.topic} onChange={(e) => setGen({ ...gen, topic: e.target.value })}>
            {TOPICS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input className="input text-sm" placeholder="Optional focus, e.g. LAAO sizing" value={gen.focus} onChange={(e) => setGen({ ...gen, focus: e.target.value })} />
          <div className="flex gap-2 items-center">
            <select className="input text-sm !w-24" value={gen.count} onChange={(e) => setGen({ ...gen, count: Number(e.target.value) })}>
              {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn btn-primary flex-1" disabled={gen.busy} onClick={generate}>{gen.busy ? "Writing…" : "Generate"}</button>
          </div>
          {gen.msg && <p className="text-xs text-[var(--color-muted)]">{gen.msg}</p>}
        </div>
        {counts.length > 0 && (
          <div className="card p-4">
            <h2 className="font-semibold mb-2">Bank by topic</h2>
            <ul className="text-sm space-y-1">
              {counts.sort((a, b) => b.total - a.total).map((c) => (
                <li key={c.topic} className="flex justify-between">
                  <button className="text-left hover:text-[var(--color-accent)]" onClick={() => { setTopic(c.topic); load(c.topic); }}>{topicLabel(c.topic)}</button>
                  <span className="text-[var(--color-muted)]">{c.due}/{c.total}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
