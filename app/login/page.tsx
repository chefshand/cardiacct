"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") ? next : "/";
    } else {
      setErr((await r.json().catch(() => ({}))).error || "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <form onSubmit={submit} className="card p-7 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-lg" />
          <div>
            <h1 className="text-lg font-bold">Cardiac CT</h1>
            <p className="text-sm text-[var(--color-muted)]">Private study studio</p>
          </div>
        </div>
        <input className="input" type="password" autoComplete="current-password" placeholder="Password"
          value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <p className="text-sm text-[var(--color-bad)]">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy || !pw}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
