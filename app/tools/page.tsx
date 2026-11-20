"use client";
import { useMemo, useState } from "react";

const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "—");

function Panel({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="card p-5 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {children}
      {note && <p className="text-xs text-[var(--color-muted)]">{note}</p>}
    </section>
  );
}

function Field({ label, value, onChange, unit, step }: { label: string; value: string; onChange: (v: string) => void; unit?: string; step?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="flex items-center gap-2 mt-1">
        <input className="input" inputMode="decimal" type="number" step={step ?? "any"} value={value} onChange={(e) => onChange(e.target.value)} />
        {unit && <span className="text-xs text-[var(--color-muted)] w-14 shrink-0">{unit}</span>}
      </div>
    </label>
  );
}

function Out({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-[var(--color-line)] last:border-0">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ---------------- CAD-RADS 2.0 ----------------
const STEN = [
  { v: "0", l: "0% — no plaque or stenosis" },
  { v: "1", l: "1–24% minimal" },
  { v: "2", l: "25–49% mild" },
  { v: "3", l: "50–69% moderate" },
  { v: "4A", l: "70–99% severe (1–2 vessels)" },
  { v: "5", l: "100% total occlusion" },
];
const MGMT: Record<string, string> = {
  "0": "No CAD. No further cardiac testing for atherosclerosis; consider non-atherosclerotic causes of symptoms.",
  "1": "Minimal non-obstructive CAD. Preventive therapy and risk-factor modification.",
  "2": "Mild non-obstructive CAD. Preventive therapy and risk-factor modification.",
  "3": "Moderate stenosis. Consider functional assessment (CT-FFR or stress testing); preventive and anti-anginal therapy.",
  "4A": "Severe stenosis. Consider ICA or functional assessment; preventive and anti-anginal therapy.",
  "4B": "Left main ≥50% or 3-vessel obstructive disease. ICA recommended.",
  "5": "Total occlusion. Consider ICA and/or viability assessment.",
  N: "Non-diagnostic study. Obstructive CAD cannot be excluded; consider additional or alternative evaluation.",
};

function CadRads() {
  const [s, setS] = useState("2");
  const [lm, setLm] = useState(false);
  const [three, setThree] = useState(false);
  const [nd, setNd] = useState(false);
  const [pMode, setPMode] = useState<"cac" | "sis">("cac");
  const [pVal, setPVal] = useState("");
  const [hrp, setHrp] = useState(false);
  const [isc, setIsc] = useState("");
  const [st, setSt] = useState(false);
  const [gr, setGr] = useState(false);
  const [ex, setEx] = useState(false);

  const res = useMemo(() => {
    if (nd) return { code: "CAD-RADS N", cat: "N" };
    let cat = s;
    if ((lm || three) && s !== "5") cat = "4B";
    const v = n(pVal);
    let p = "";
    if (Number.isFinite(v) && v > 0) {
      if (pMode === "cac") p = v <= 100 ? "P1" : v <= 300 ? "P2" : v < 1000 ? "P3" : "P4";
      else p = v <= 2 ? "P1" : v <= 4 ? "P2" : v <= 7 ? "P3" : "P4";
    }
    const mods = [p, hrp ? "HRP" : "", isc, st ? "S" : "", gr ? "G" : "", ex ? "E" : ""].filter(Boolean);
    return { code: `CAD-RADS ${cat}${mods.length ? "/" + mods.join("/") : ""}`, cat };
  }, [s, lm, three, nd, pMode, pVal, hrp, isc, st, gr, ex]);

  const cb = (l: string, v: boolean, f: (b: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v} onChange={(e) => f(e.target.checked)} />{l}</label>
  );

  return (
    <Panel title="CAD-RADS 2.0 builder" note="Summary of the 2022 CAD-RADS 2.0 expert consensus for stable chest pain. Check modifier order and management wording against the source document before reporting.">
      <label className="block"><span className="label">Maximal stenosis</span>
        <select className="input mt-1" value={s} onChange={(e) => setS(e.target.value)}>{STEN.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {cb("Left main ≥50%", lm, setLm)}
        {cb("3-vessel ≥70%", three, setThree)}
        {cb("Non-diagnostic study", nd, setNd)}
        {cb("High-risk plaque (≥2 features)", hrp, setHrp)}
        {cb("Stent (S)", st, setSt)}
        {cb("Graft (G)", gr, setGr)}
        {cb("Exception — non-atherosclerotic (E)", ex, setEx)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">Plaque burden from</span>
          <select className="input mt-1" value={pMode} onChange={(e) => setPMode(e.target.value as "cac" | "sis")}>
            <option value="cac">CAC score</option><option value="sis">Segment involvement score</option>
          </select>
        </label>
        <Field label={pMode === "cac" ? "CAC (Agatston)" : "SIS (segments)"} value={pVal} onChange={setPVal} />
      </div>
      <label className="block"><span className="label">Ischemia (CT-FFR / CTP)</span>
        <select className="input mt-1" value={isc} onChange={(e) => setIsc(e.target.value)}>
          <option value="">Not assessed</option><option value="I+">I+ abnormal</option><option value="I-">I− normal</option><option value="I±">I± borderline</option>
        </select>
      </label>
      <div className="rounded-xl bg-[var(--color-accent-soft)] p-4">
        <div className="text-xl font-bold font-mono">{res.code}</div>
        <p className="text-sm mt-2">{MGMT[res.cat]}</p>
      </div>
    </Panel>
  );
}

// ---------------- Agatston / CAC-DRS ----------------
type Lesion = { vessel: string; area: string; hu: string };
const weight = (hu: number) => (hu >= 400 ? 4 : hu >= 300 ? 3 : hu >= 200 ? 2 : hu >= 130 ? 1 : 0);

function Agatston() {
  const [rows, setRows] = useState<Lesion[]>([{ vessel: "LAD", area: "", hu: "" }]);
  const [total, setTotal] = useState("");
  const calc = useMemo(() => {
    const per: Record<string, number> = {};
    let sum = 0;
    for (const r of rows) {
      const a = n(r.area), h = n(r.hu);
      if (!Number.isFinite(a) || !Number.isFinite(h) || a < 1) continue;
      const sc = a * weight(h);
      per[r.vessel] = (per[r.vessel] ?? 0) + sc;
      sum += sc;
    }
    const t = Number.isFinite(n(total)) ? n(total) : sum;
    const vessels = Object.values(per).filter((v) => v > 0).length;
    const a = t === 0 ? "A0" : t < 100 ? "A1" : t < 300 ? "A2" : "A3";
    return { per, sum, t, drs: t === 0 ? "CAC-DRS 0" : `CAC-DRS ${a}${vessels ? `/N${vessels}` : ""}` };
  }, [rows, total]);

  const upd = (i: number, k: keyof Lesion, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <Panel title="Agatston score & CAC-DRS" note="Teaching calculator: Agatston is summed per lesion per slice on 3-mm, 120-kVp non-contrast images. Lesions <1 mm² or <130 HU are excluded. Weights: 130–199 HU = 1, 200–299 = 2, 300–399 = 3, ≥400 = 4.">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[90px_1fr_1fr_auto] gap-2 items-center">
            <select className="input text-sm" value={r.vessel} onChange={(e) => upd(i, "vessel", e.target.value)}>
              {["LM", "LAD", "LCx", "RCA"].map((v) => <option key={v}>{v}</option>)}
            </select>
            <input className="input text-sm" type="number" placeholder="Area mm²" value={r.area} onChange={(e) => upd(i, "area", e.target.value)} />
            <input className="input text-sm" type="number" placeholder="Peak HU" value={r.hu} onChange={(e) => upd(i, "hu", e.target.value)} />
            <button className="text-sm px-2 text-[var(--color-muted)]" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn text-sm" onClick={() => setRows((rs) => [...rs, { vessel: "LAD", area: "", hu: "" }])}>+ Lesion</button>
      </div>
      <Field label="…or enter a known total score" value={total} onChange={setTotal} unit="AU" />
      <div>
        {Object.entries(calc.per).map(([v, s]) => <Out key={v} label={v} value={fmt(s, 0)} />)}
        <Out label="Total Agatston" value={fmt(calc.t, 0)} />
      </div>
      <div className="rounded-xl bg-[var(--color-accent-soft)] p-3 font-mono font-bold">{calc.drs}</div>
    </Panel>
  );
}

// ---------------- Dose ----------------
function Dose() {
  const [dlp, setDlp] = useState("");
  const [ctdi, setCtdi] = useState("");
  const [len, setLen] = useState("");
  const d = Number.isFinite(n(dlp)) ? n(dlp) : n(ctdi) * n(len);
  return (
    <Panel title="Radiation dose (DLP → effective dose)" note="E = DLP × k. k = 0.014 mSv/mGy·cm (adult chest, ICRP 103-era convention) or ≈0.026 (cardiac-specific). Report which factor you used.">
      <Field label="DLP" value={dlp} onChange={setDlp} unit="mGy·cm" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="…or CTDIvol" value={ctdi} onChange={setCtdi} unit="mGy" />
        <Field label="× scan length" value={len} onChange={setLen} unit="cm" />
      </div>
      <Out label="DLP used" value={`${fmt(d, 0)} mGy·cm`} />
      <Out label="E (k = 0.014)" value={`${fmt(d * 0.014, 2)} mSv`} />
      <Out label="E (k = 0.026)" value={`${fmt(d * 0.026, 2)} mSv`} />
    </Panel>
  );
}

// ---------------- TAVR annulus ----------------
function Annulus() {
  const [area, setArea] = useState("");
  const [per, setPer] = useState("");
  const [dmin, setDmin] = useState("");
  const [dmax, setDmax] = useState("");
  const a = n(area), p = n(per), mi = n(dmin), ma = n(dmax);
  return (
    <Panel title="TAVR annulus" note="Measure the virtual basal ring (three hinge points) in systole, double-oblique. Enter area in mm² and perimeter in mm.">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Area" value={area} onChange={setArea} unit="mm²" />
        <Field label="Perimeter" value={per} onChange={setPer} unit="mm" />
        <Field label="Min diameter" value={dmin} onChange={setDmin} unit="mm" />
        <Field label="Max diameter" value={dmax} onChange={setDmax} unit="mm" />
      </div>
      <Out label="Area-derived diameter 2√(A/π)" value={`${fmt(2 * Math.sqrt(a / Math.PI))} mm`} />
      <Out label="Perimeter-derived diameter P/π" value={`${fmt(p / Math.PI)} mm`} />
      <Out label="Mean diameter (min+max)/2" value={`${fmt((mi + ma) / 2)} mm`} />
      <Out label="Eccentricity index 1 − min/max" value={fmt(1 - mi / ma, 2)} />
    </Panel>
  );
}

// ---------------- Aortic indexing ----------------
function Aorta() {
  const [d, setD] = useState("");
  const [h, setH] = useState("");
  const [w, setW] = useState("");
  const dcm = n(d) / 10, hm = n(h) / 100, kg = n(w);
  const bsa = Math.sqrt((n(h) * kg) / 3600);
  const csa = Math.PI * (dcm / 2) ** 2;
  return (
    <Panel title="Aortic size indexing" note="Mosteller BSA. Area/height ratio uses maximal cross-sectional area in cm² ÷ height in m (2022 ACC/AHA aortic guideline). Compare with guideline thresholds for the specific aortic disease.">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Diameter" value={d} onChange={setD} unit="mm" />
        <Field label="Height" value={h} onChange={setH} unit="cm" />
        <Field label="Weight" value={w} onChange={setW} unit="kg" />
      </div>
      <Out label="BSA (Mosteller)" value={`${fmt(bsa, 2)} m²`} />
      <Out label="Aortic size index (diameter / BSA)" value={`${fmt(dcm / bsa, 2)} cm/m²`} />
      <Out label="Aortic height index (diameter / height)" value={`${fmt(dcm / hm, 2)} cm/m`} />
      <Out label="Cross-sectional area / height" value={`${fmt(csa / hm, 1)} cm²/m`} />
    </Panel>
  );
}

// ---------------- Contrast ----------------
function Contrast() {
  const [conc, setConc] = useState("350");
  const [rate, setRate] = useState("5");
  const [vol, setVol] = useState("70");
  const idr = (n(conc) * n(rate)) / 1000;
  return (
    <Panel title="Iodine delivery" note="Iodine delivery rate (IDR, gI/s) drives coronary enhancement; ~1.5–2 gI/s is typical for CCTA at 100–120 kVp. Lower kVp allows a lower IDR.">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Concentration" value={conc} onChange={setConc} unit="mgI/mL" />
        <Field label="Rate" value={rate} onChange={setRate} unit="mL/s" />
        <Field label="Volume" value={vol} onChange={setVol} unit="mL" />
      </div>
      <Out label="Iodine delivery rate" value={`${fmt(idr, 2)} gI/s`} />
      <Out label="Total iodine" value={`${fmt((n(conc) * n(vol)) / 1000, 1)} g`} />
      <Out label="Injection duration" value={`${fmt(n(vol) / n(rate), 1)} s`} />
    </Panel>
  );
}

export default function Tools() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reading tools</h1>
        <p className="text-sm text-[var(--color-muted)]">Calculators for practice and reporting. These are study aids, so verify against primary sources before clinical use.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-5 items-start">
        <CadRads />
        <Agatston />
        <Annulus />
        <Dose />
        <Aorta />
        <Contrast />
      </div>
    </div>
  );
}
