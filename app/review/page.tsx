"use client";
import { useCallback, useEffect, useState } from "react";
import Markdown from "@/components/Markdown";
import { TOPICS, topicLabel } from "@/lib/topics";

type Card = { id: string; front: string; back: string; topic: string; source: string | null; reps: number };
type Pending = { id: string; grade: number; at: string };

const CACHE = "ct_due_cache_v1";
const QUEUE = "ct_review_queue_v1";

function read<T>(k: string, d: T): T {
  try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
}

export default function Review() {
  const [cards, setCards] = useState<Card[]>([]);
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(0);
  const [done, setDone] = useState(0);
  const [topic, setTopic] = useState("");
  const [adding, setAdding] = useState(false);

  const flush = useCallback(async () => {
    const q = read<Pending[]>(QUEUE, []);
    setPending(q.length);
    if (!q.length || !navigator.onLine) return;
    try {
      const r = await fetch("/api/cards/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviews: q }) });
      if (r.ok) {
        const remaining = read<Pending[]>(QUEUE, []).slice(q.length);
        write(QUEUE, remaining);
        setPending(remaining.length);
      }
    } catch { /* stay queued */ }
  }, []);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    await flush();
    try {
      const r = await fetch(`/api/cards?limit=150${t ? `&topic=${t}` : ""}`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      const { cards } = await r.json();
      setCards(cards);
      if (!t) write(CACHE, cards);
      setOffline(false);
    } catch {
      const queued = new Set(read<Pending[]>(QUEUE, []).map((p) => p.id));
      setCards(read<Card[]>(CACHE, []).filter((c) => !queued.has(c.id) && (!t || c.topic === t)));
      setOffline(true);
    }
    setI(0);
    setShow(false);
    setLoading(false);
  }, [flush]);

  useEffect(() => {
    load("");
    const on = () => { flush(); setOffline(false); };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [load, flush]);

  const card = cards[i];

  const grade = useCallback((g: number) => {
    if (!card) return;
    const q = read<Pending[]>(QUEUE, []);
    q.push({ id: card.id, grade: g, at: new Date().toISOString() });
    write(QUEUE, q);
    write(CACHE, read<Card[]>(CACHE, []).filter((c) => c.id !== card.id));
    setPending(q.length);
    setDone((d) => d + 1);
    // "Again" cards come back at the end of this session.
    if (g === 0) setCards((cs) => [...cs, card]);
    setI((x) => x + 1);
    setShow(false);
    if (q.length >= 5) flush();
  }, [card, flush]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (!show && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setShow(true); }
      else if (show && ["1", "2", "3", "4"].includes(e.key)) grade(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, grade]);

  useEffect(() => { if (cards.length && i >= cards.length) flush(); }, [i, cards.length, flush]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flashcards</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {loading ? "Loading…" : `${Math.max(0, cards.length - i)} left · ${done} reviewed`}
            {offline && " · offline"}{pending > 0 && ` · ${pending} to sync`}
          </p>
        </div>
        <div className="flex gap-2">
          <select className="input !w-auto text-sm" value={topic} onChange={(e) => { setTopic(e.target.value); load(e.target.value); }}>
            <option value="">All topics</option>
            {TOPICS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <button className="btn" onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "+ Card"}</button>
        </div>
      </div>

      {adding && <AddCard onDone={() => setAdding(false)} />}

      {!loading && !card && (
        <div className="card p-8 text-center space-y-2">
          <div className="text-lg font-semibold">All caught up</div>
          <p className="text-sm text-[var(--color-muted)]">No cards due{topic ? " in this topic" : ""}. Add cards from the tutor, or ask Claude Desktop to make some.</p>
        </div>
      )}

      {card && (
        <div className="card p-6 md:p-8 min-h-[320px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <span className="chip">{topicLabel(card.topic)}</span>
            {card.reps === 0 && <span className="text-xs text-[var(--color-muted)]">new</span>}
          </div>
          <div className="text-lg font-medium leading-relaxed"><Markdown>{card.front}</Markdown></div>
          {show && (
            <div className="mt-5 pt-5 border-t border-[var(--color-line)]">
              <Markdown>{card.back}</Markdown>
              {card.source && <div className="text-xs text-[var(--color-muted)] mt-3">Source: {card.source}</div>}
            </div>
          )}
          <div className="mt-auto pt-6">
            {!show ? (
              <button className="btn btn-primary w-full py-3" onClick={() => setShow(true)}>Show answer <span className="opacity-60 text-xs">(space)</span></button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {[["Again", "var(--color-bad)"], ["Hard", "var(--color-warn)"], ["Good", "var(--color-good)"], ["Easy", "var(--color-accent)"]].map(([l, c], g) => (
                  <button key={l} className="btn py-3 flex-col !gap-0" style={{ borderColor: c }} onClick={() => grade(g)}>
                    <span style={{ color: c }}>{l}</span><span className="text-[10px] opacity-50">{g + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddCard({ onDone }: { onDone: () => void }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [topic, setTopic] = useState("general");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await fetch("/api/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cards: [{ front, back, topic, source: "manual" }] }) });
    setFront(""); setBack(""); setBusy(false); onDone();
  }
  return (
    <div className="card p-4 space-y-3">
      <textarea className="input" rows={2} placeholder="Front (question)" value={front} onChange={(e) => setFront(e.target.value)} />
      <textarea className="input" rows={3} placeholder="Back (answer, Markdown OK)" value={back} onChange={(e) => setBack(e.target.value)} />
      <div className="flex gap-2">
        <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="general">General</option>
          {TOPICS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <button className="btn btn-primary" disabled={busy || !front.trim() || !back.trim()} onClick={save}>Save</button>
      </div>
    </div>
  );
}
