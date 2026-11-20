"use client";
import { useState } from "react";

export default function SettingsForm({ examDate, budget, envBudget }: { examDate: string; budget: number; envBudget: boolean }) {
  const [date, setDate] = useState(examDate);
  const [cap, setCap] = useState(String(budget));
  const [msg, setMsg] = useState("");

  async function save() {
    const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exam_date: date, monthly_budget_usd: Number(cap) }) });
    setMsg(r.ok ? "Saved" : "Save failed");
    setTimeout(() => setMsg(""), 2000);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="label">Board exam date</span>
          <input className="input mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Monthly AI budget (USD, 0 = no cap)</span>
          <input className="input mt-1" type="number" min={0} value={cap} disabled={envBudget} onChange={(e) => setCap(e.target.value)} />
          {envBudget && <span className="text-xs text-[var(--color-muted)]">Set by MONTHLY_BUDGET_USD in Vercel</span>}
        </label>
      </div>
      <div className="flex gap-2 items-center">
        <button className="btn btn-primary" onClick={save}>Save</button>
        {msg && <span className="text-sm text-[var(--color-muted)]">{msg}</span>}
        <button className="btn ml-auto" onClick={logout}>Sign out</button>
      </div>
    </section>
  );
}
