"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";

type Msg = { role: "user" | "assistant"; content: string; sources?: { n: number; title: string; page: number | null }[] };
type Conv = { id: string; title: string; updated_at: string };

const STARTERS = [
  "Teach me CT physics from scratch the way I'd need it for boards: kVp, mAs, pitch, temporal and spatial resolution.",
  "Walk me through a systematic read of a CCTA, step by step, with the planes and windows to use.",
  "How do I measure the aortic annulus for TAVR, and what are the common measurement errors?",
  "Explain CAD-RADS 2.0 with worked examples, including the modifiers.",
];

export default function Tutor() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [cardMsg, setCardMsg] = useState<Record<number, string>>({});
  const [showList, setShowList] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(async () => {
    const r = await fetch("/api/conversations", { cache: "no-store" });
    if (r.ok) setConvs((await r.json()).conversations);
  }, []);

  useEffect(() => {
    loadConvs();
    const ctx = sessionStorage.getItem("ct_tutor_context");
    if (ctx) {
      setContext(ctx);
      setInput("Explain this more deeply — the underlying concept, why each wrong option is wrong, and the board pearl.");
      sessionStorage.removeItem("ct_tutor_context");
    }
  }, [loadConvs]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function open(id: string) {
    setConvId(id);
    setShowList(false);
    const r = await fetch(`/api/conversations?id=${id}`, { cache: "no-store" });
    setMsgs((await r.json()).messages);
  }

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setBusy(true);
    setInput("");
    const shown = context ? `${context}\n\n${message}` : message;
    setMsgs((m) => [...m, { role: "user", content: shown }, { role: "assistant", content: "" }]);
    const ctx = context;
    setContext("");
    try {
      const r = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message, context: ctx || undefined }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error(j.error || "Request failed");
      }
      const id = r.headers.get("X-Conversation-Id");
      if (id && !convId) setConvId(id);
      let sources: Msg["sources"] = [];
      try { sources = JSON.parse(decodeURIComponent(r.headers.get("X-Sources") || "[]")); } catch { /* none */ }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: acc, sources }]);
      }
      loadConvs();
    } catch (e) {
      setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: `**Error:** ${e instanceof Error ? e.message : String(e)}` }]);
    }
    setBusy(false);
  }

  async function makeCards(idx: number) {
    setCardMsg((c) => ({ ...c, [idx]: "Making cards…" }));
    const r = await fetch("/api/cards/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msgs[idx].content }) });
    const j = await r.json();
    setCardMsg((c) => ({ ...c, [idx]: j.error ? j.error : `Added ${j.created} flashcards` }));
  }

  async function saveNote(idx: number) {
    const title = msgs[idx - 1]?.content.split("\n").pop()?.slice(0, 100) || "Tutor note";
    await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "note", title, body: msgs[idx].content }) });
    setCardMsg((c) => ({ ...c, [idx]: "Saved to library" }));
  }

  function newChat() {
    setConvId(null);
    setMsgs([]);
    setShowList(false);
  }

  async function del(id: string) {
    await fetch(`/api/conversations?id=${id}`, { method: "DELETE" });
    if (id === convId) newChat();
    loadConvs();
  }

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-5">
      <aside className={`${showList ? "block" : "hidden"} md:block space-y-2`}>
        <button className="btn btn-primary w-full" onClick={newChat}>New conversation</button>
        <div className="card p-2 max-h-[70vh] overflow-y-auto">
          {convs.length === 0 && <p className="text-xs text-[var(--color-muted)] p-2">No conversations yet.</p>}
          {convs.map((c) => (
            <div key={c.id} className={`group flex items-center rounded-lg ${c.id === convId ? "bg-[var(--color-accent-soft)]" : ""}`}>
              <button onClick={() => open(c.id)} className="flex-1 text-left text-sm px-2 py-1.5 truncate">{c.title}</button>
              <button onClick={() => del(c.id)} className="opacity-0 group-hover:opacity-60 px-2 text-xs" aria-label="Delete">✕</button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex flex-col min-h-[calc(100vh-10rem)] min-w-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold tracking-tight">Tutor</h1>
          <button className="btn md:hidden text-sm" onClick={() => setShowList((s) => !s)}>History</button>
        </div>

        <div className="flex-1 space-y-4">
          {msgs.length === 0 && (
            <div className="card p-5 space-y-3">
              <p className="text-sm text-[var(--color-muted)]">Ask anything about cardiovascular CT. Answers draw on your library (study guides, uploaded books, notes) and cite it when relevant.</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {STARTERS.map((s) => (
                  <button key={s} className="text-left text-sm rounded-xl border border-[var(--color-line)] p-3 hover:border-[var(--color-accent)]" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl bg-[var(--color-accent)] text-white px-4 py-2.5 text-sm whitespace-pre-wrap">{m.content}</div>
              ) : (
                <div className="card p-5">
                  {m.content ? <Markdown>{m.content}</Markdown> : <span className="text-sm text-[var(--color-muted)]">Thinking…</span>}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[var(--color-line)] text-xs text-[var(--color-muted)] space-y-0.5">
                      {m.sources.map((s) => <div key={s.n}>[{s.n}] {s.title}{s.page ? `, p.${s.page}` : ""}</div>)}
                    </div>
                  )}
                  {m.content && !(busy && i === msgs.length - 1) && (
                    <div className="mt-3 flex gap-2 flex-wrap items-center">
                      <button className="btn text-xs !py-1" onClick={() => makeCards(i)}>Make flashcards</button>
                      <button className="btn text-xs !py-1" onClick={() => saveNote(i)}>Save as note</button>
                      {cardMsg[i] && <span className="text-xs text-[var(--color-muted)]">{cardMsg[i]}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottom} />
        </div>

        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] md:bottom-4 mt-4">
          {context && (
            <div className="card p-3 mb-2 text-xs text-[var(--color-muted)] flex justify-between gap-2">
              <span className="line-clamp-2">Attached: question you just answered</span>
              <button onClick={() => setContext("")}>✕</button>
            </div>
          )}
          <div className="card p-2 flex gap-2 items-end shadow-lg">
            <textarea className="flex-1 bg-transparent resize-none outline-none px-2 py-2 text-[15px] max-h-48" rows={Math.min(6, Math.max(1, input.split("\n").length))}
              placeholder="Ask about cardiac CT…" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="btn btn-primary" disabled={busy || !input.trim()} onClick={() => send()}>{busy ? "…" : "Send"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
