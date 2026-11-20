"use client";
import { useCallback, useEffect, useState } from "react";

type Doc = { id: string; title: string; kind: string; pages: number | null; chunks: number; created_at: string };
type Hit = { id: string; title: string; page: number | null; heading: string | null; content: string };
type Chunk = { page: number | null; heading?: string | null; content: string };

// Links to the Claude-made study guides (private artifacts, open while signed in to claude.ai).
const GUIDES: [string, string][] = [
  ["Master index", "https://claude.ai/artifact/P3S8kYx4CZ71NG4K5WAC1w"],
  ["Reading protocols (coronary, TAVR, TMVR, TTVR)", "https://claude.ai/artifact/DF351Hk6ee75FFQgTmZTfH"],
  ["Radiation & protocoling + CBCCT prep", "https://claude.ai/artifact/6aWK1FfNynFxZ9pzkZKnCc"],
  ["Gated CTA of the aorta", "https://claude.ai/artifact/XisGbKydCEnQQAFGKzVWfy"],
  ["Coronary CT: CAC & CCTA", "https://claude.ai/artifact/HLYQCUn9q6eFu3zbf4WQTs"],
  ["M02 Artifacts", "https://claude.ai/artifact/3gXxBU7G8KzfwzwKSywRBU"],
  ["M03 Simple Coronary Cases", "https://claude.ai/artifact/TsRTdkk2TMLoGVCJmfhsMX"],
  ["M04 Coronary Cases Part 2", "https://claude.ai/artifact/Js3e8JYokGsbVt7r7ir2iC"],
  ["M05 Moderate to Advanced Coronary", "https://claude.ai/artifact/FbSDdwkkiTKTTpUnfVwSqU"],
  ["M06 Moderate to Severe Coronary", "https://claude.ai/artifact/DS9gFwWLTH8RvXPT42gnJ7"],
  ["M07 Grafts and Stents", "https://claude.ai/artifact/U76qRgtr6PWa3bCPkabg2N"],
  ["M08 Aortic Cases", "https://claude.ai/artifact/EdsK3WVU5jEoknDd5rZfBG"],
  ["M09 Valvular Cases", "https://claude.ai/artifact/Gk8sHueKwTw6NKLQhJ78jq"],
  ["M10 Structural Heart Disease", "https://claude.ai/artifact/8aw3mqtDwA6XHQM39shXjj"],
  ["M11 Congenital Heart Disease", "https://claude.ai/artifact/1cAneFW2dnC2gHko3GS6sc"],
  ["M12 Cardiomyopathy, LV and RV", "https://claude.ai/artifact/5rh3SWd8SGZ7atuR8T2cnk"],
  ["M13 Extracardiac Findings", "https://claude.ai/artifact/5wTw9P61S3BwmoVxV2zD1Z"],
  ["M14 Clinical Cases I", "https://claude.ai/artifact/89eoFThi9oeMJaTCppYM5v"],
  ["M15 Clinical Cases II", "https://claude.ai/artifact/XG1GYYKTw7E1zSX7viCDqW"],
];

function splitText(text: string, page: number | null, size = 1400): Chunk[] {
  const clean = text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const out: Chunk[] = [];
  let rest = clean;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n\n", size);
    if (cut < size * 0.5) cut = rest.lastIndexOf(". ", size) + 1;
    if (cut < size * 0.5) cut = size;
    out.push({ page, content: rest.slice(0, cut).trim() });
    rest = rest.slice(cut);
  }
  if (rest.trim()) out.push({ page, content: rest.trim() });
  return out;
}

async function pdfToChunks(data: ArrayBuffer, onPage: (p: number, n: number) => void) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const chunks: Chunk[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let text = "";
    for (const it of tc.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof it.str !== "string") continue;
      text += it.str + (it.hasEOL ? "\n" : " ");
    }
    chunks.push(...splitText(text, p));
    onPage(p, doc.numPages);
  }
  return { chunks, pages: doc.numPages };
}

function htmlToText(html: string) {
  const d = new DOMParser().parseFromString(html, "text/html");
  d.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
  d.querySelectorAll("p,div,li,h1,h2,h3,h4,tr,br,section").forEach((n) => n.append("\n"));
  return d.body?.textContent ?? "";
}

export default function Library() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [kind, setKind] = useState("guide");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [note, setNote] = useState({ title: "", body: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/library", { cache: "no-store" });
    if (r.ok) setDocs((await r.json()).docs);
  }, []);
  useEffect(() => { load(); }, [load]);

  const say = (s: string) => setLog((l) => [...l.slice(-30), s]);

  async function ingest(title: string, chunks: Chunk[], pages: number | null) {
    if (!chunks.length) { say(`⚠︎ ${title}: no extractable text (scanned PDF?)`); return; }
    let r = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", title, kind, pages }) });
    if (r.status === 409) {
      if (!confirm(`"${title}" is already in the library. Replace it?`)) { say(`Skipped ${title}`); return; }
      r = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", title, kind, pages, replace: true }) });
    }
    const { id, error } = await r.json();
    if (!id) { say(`✕ ${title}: ${error}`); return; }
    for (let i = 0; i < chunks.length; i += 150) {
      const res = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "chunks", doc_id: id, start: i, chunks: chunks.slice(i, i + 150) }) });
      if (!res.ok) { say(`✕ ${title}: upload failed at chunk ${i}`); return; }
    }
    say(`✓ ${title} — ${chunks.length} passages${pages ? `, ${pages} pages` : ""}`);
  }

  async function handleFile(name: string, data: ArrayBuffer) {
    const title = name.replace(/^.*\//, "").replace(/\.(pdf|md|txt|html?)$/i, "");
    const lower = name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      say(`Reading ${title}…`);
      const { chunks, pages } = await pdfToChunks(data, (p, n) => { if (p % 25 === 0) say(`  ${title}: page ${p}/${n}`); });
      await ingest(title, chunks, pages);
    } else if (/\.(md|txt)$/.test(lower)) {
      await ingest(title, splitText(new TextDecoder().decode(data), null), null);
    } else if (/\.html?$/.test(lower)) {
      await ingest(title, splitText(htmlToText(new TextDecoder().decode(data)), null), null);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const buf = await f.arrayBuffer();
        if (f.name.toLowerCase().endsWith(".zip")) {
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(buf);
          const entries = Object.values(zip.files).filter((e) => !e.dir && !e.name.includes("__MACOSX") && /\.(pdf|md|txt|html?)$/i.test(e.name));
          say(`${f.name}: ${entries.length} files`);
          for (const e of entries) await handleFile(e.name, await e.async("arraybuffer"));
        } else {
          await handleFile(f.name, buf);
        }
      }
    } catch (e) {
      say(`✕ ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
    load();
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    const r = await fetch(`/api/library/search?q=${encodeURIComponent(q)}`);
    setHits((await r.json()).hits ?? []);
  }

  async function del(d: Doc) {
    if (!confirm(`Remove "${d.title}" from the library?`)) return;
    await fetch(`/api/library?id=${d.id}`, { method: "DELETE" });
    load();
  }

  async function saveNote() {
    await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "note", ...note }) });
    setNote({ title: "", body: "" });
    load();
  }

  const groups = ["guide", "book", "note", "other"].map((k) => ({ k, items: docs.filter((d) => d.kind === k) })).filter((g) => g.items.length);
  const label: Record<string, string> = { guide: "Study guides", book: "Textbooks", note: "Notes", other: "Other" };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>
        <p className="text-sm text-[var(--color-muted)]">Everything here is searchable by the tutor, the question writer and Claude Desktop. Files are read in your browser; only the extracted text is stored, privately.</p>
      </div>

      <form onSubmit={search} className="flex gap-2">
        <input className="input" placeholder="Search your library — e.g. annulus perimeter, napkin ring, DLP" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary">Search</button>
      </form>
      {hits && (
        <div className="space-y-2">
          {hits.length === 0 && <p className="text-sm text-[var(--color-muted)]">No matches.</p>}
          {hits.map((h) => (
            <div key={h.id} className="card p-4">
              <div className="text-xs font-semibold text-[var(--color-accent)]">{h.title}{h.page ? ` · p.${h.page}` : ""}</div>
              <p className="text-sm mt-1 whitespace-pre-wrap line-clamp-6">{h.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">Add files</h2>
          <p className="text-sm text-[var(--color-muted)]">
            PDF, Markdown, text, HTML, or a .zip of them. Drop <b>Cardiac CT Study Guides.zip</b> here to load all your module guides at once. For textbooks, use PDFs you own (e.g. the eBook editions that come with print copies).
          </p>
          <div className="flex gap-2 items-center">
            <select className="input !w-auto text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="guide">Study guide</option>
              <option value="book">Textbook</option>
              <option value="note">Note</option>
              <option value="other">Other</option>
            </select>
            <label className={`btn btn-primary flex-1 cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
              {busy ? "Processing…" : "Choose files"}
              <input type="file" multiple accept=".pdf,.zip,.md,.txt,.html,.htm" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          {log.length > 0 && (
            <pre className="text-xs bg-[var(--color-accent-soft)] rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">{log.join("\n")}</pre>
          )}
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">Quick note</h2>
          <input className="input" placeholder="Title" value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} />
          <textarea className="input" rows={4} placeholder="Pearls, mentor tips, your own reading checklist… (Markdown)" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} />
          <button className="btn btn-primary" disabled={!note.title.trim() || !note.body.trim()} onClick={saveNote}>Save note</button>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-5">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">In the library</h2>
          {docs.length === 0 && <p className="text-sm text-[var(--color-muted)]">Nothing yet — add your study-guide zip to get started.</p>}
          {groups.map((g) => (
            <div key={g.k} className="mb-4">
              <div className="label mb-1">{label[g.k]}</div>
              <ul className="divide-y divide-[var(--color-line)]">
                {g.items.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2 text-sm gap-3">
                    <span className="truncate">{d.title}</span>
                    <span className="flex items-center gap-3 shrink-0 text-[var(--color-muted)] text-xs">
                      {d.pages ? `${d.pages} pp` : ""} {d.chunks} passages
                      <button onClick={() => del(d)} className="hover:text-[var(--color-bad)]">Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Study guides on Claude</h2>
          <ul className="text-sm space-y-1">
            {GUIDES.map(([t, u]) => (
              <li key={u}><a href={u} target="_blank" rel="noreferrer" className="hover:text-[var(--color-accent)]">{t} ↗</a></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
