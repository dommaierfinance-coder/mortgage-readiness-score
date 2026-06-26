import { useState, useRef } from "react";
import { ACCENT, BORDER, RED } from "../theme";
import { Button } from "./ui";
import { SAMPLE_REPORT } from "../sampleReport";
import { extractReport } from "../lib/extractPdf";

const MAX_MB = 30;

async function analyzeOne(payload) {
  const resp = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Analysis failed (${resp.status}).`);
  }
  return resp.json();
}

function mergeReports(reports) {
  const merged = {
    bureau: null, reportDate: null, providedScore: null, scoreModel: null,
    accounts: [], collections: [], inquiries: [], publicRecords: [], personalInfoFlags: [],
  };
  const seenAcct = new Set(), seenColl = new Set(), seenInq = new Set(), seenPub = new Set();
  const norm = (v) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

  for (const r of reports) {
    if (!r || typeof r !== "object") continue;
    if (merged.bureau == null && r.bureau != null) merged.bureau = r.bureau;
    if (merged.reportDate == null && r.reportDate != null) merged.reportDate = r.reportDate;
    if (merged.providedScore == null && r.providedScore != null) merged.providedScore = r.providedScore;
    if (merged.scoreModel == null && r.scoreModel != null) merged.scoreModel = r.scoreModel;
    for (const a of r.accounts || []) {
      const sig = `${norm(a.creditor)}|${norm(a.type)}|${norm(a.balance)}|${norm(a.opened)}`;
      if (seenAcct.has(sig)) continue; seenAcct.add(sig); merged.accounts.push(a);
    }
    for (const c of r.collections || []) {
      const sig = `${norm(c.agency)}|${norm(c.originalCreditor)}|${norm(c.balance)}`;
      if (seenColl.has(sig)) continue; seenColl.add(sig); merged.collections.push(c);
    }
    for (const q of r.inquiries || []) {
      const sig = `${norm(q.creditor)}|${norm(q.date)}|${norm(q.type)}`;
      if (seenInq.has(sig)) continue; seenInq.add(sig); merged.inquiries.push(q);
    }
    for (const p of r.publicRecords || []) {
      const sig = `${norm(p.type)}|${norm(p.amount)}|${norm(p.dateFiled)}`;
      if (seenPub.has(sig)) continue; seenPub.add(sig); merged.publicRecords.push(p);
    }
    for (const f of r.personalInfoFlags || []) {
      if (!merged.personalInfoFlags.includes(f)) merged.personalInfoFlags.push(f);
    }
  }
  merged.accounts.forEach((a, i) => { a.id = `a${i + 1}`; });
  merged.collections.forEach((c, i) => { c.id = `c${i + 1}`; });
  return merged;
}

export default function Upload({ onAnalyzed }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [debug, setDebug] = useState(null);
  const fileRef = useRef(null);

  async function handleFile(file) {
    setError(""); setDebug(null);
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF of your credit report."); return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please upload a PDF under ${MAX_MB} MB.`); return;
    }
    setBusy(true); setStatus("Reading your report…");
    try {
      const extracted = await extractReport(file);
      if (extracted.mode === "error") {
        setError(extracted.message); setBusy(false); setStatus(""); return;
      }

      let report;
      const dbg = { mode: extracted.mode, chunks: [] };

      if (extracted.mode === "pdf") {
        setStatus("Analyzing accounts, balances and negatives…");
        report = await analyzeOne({ pdf: extracted.pdf });
        dbg.chunks.push({ idx: 0, chars: "(pdf)", accounts: (report.accounts || []).length, creditors: (report.accounts || []).map((a) => a.creditor) });
      } else {
        const chunks = extracted.chunks;
        setStatus(`Analyzing your report (${chunks.length} sections)…`);
        const results = [];
        for (let i = 0; i < chunks.length; i++) {
          try {
            const r = await analyzeOne({ text: chunks[i] });
            results.push(r);
            dbg.chunks.push({
              idx: i, chars: chunks[i].length,
              accounts: (r.accounts || []).length,
              creditors: (r.accounts || []).map((a) => `${a.creditor} (${a.type})`),
            });
          } catch (err) {
            dbg.chunks.push({ idx: i, chars: chunks[i].length, error: err.message });
          }
        }
        report = results.length === 1 ? results[0] : mergeReports(results);
      }

      dbg.mergedAccounts = (report.accounts || []).length;
      setDebug(dbg);
      setStatus("");
      setBusy(false);
      window.__pendingReport = report;
    } catch (e) {
      setError(e.message || "Something went wrong analyzing your report. Please try again.");
      setBusy(false); setStatus("");
    }
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => !busy && fileRef.current?.click()}
        style={{
          border: `2px dashed ${drag ? ACCENT : "rgba(255,255,255,0.15)"}`,
          borderRadius: 12, padding: "3rem 2rem", textAlign: "center",
          cursor: busy ? "default" : "pointer",
          background: drag ? "rgba(201,169,110,0.05)" : "rgba(255,255,255,0.02)",
          transition: "all 0.2s ease",
        }}
      >
        <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
        {busy ? (
          <div>
            <div style={{ width: 28, height: 28, margin: "0 auto 1rem", borderRadius: "50%", border: "3px solid rgba(201,169,110,0.2)", borderTop: `3px solid ${ACCENT}`, animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.95rem", margin: 0 }}>{status}</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>📄</div>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: "1rem", margin: "0 0 0.4rem" }}>Drop your credit report PDF here</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", margin: 0 }}>or click to browse · PDF report</p>
          </div>
        )}
      </div>

      {error && <p style={{ color: RED, fontSize: "0.85rem", marginTop: "1rem", textAlign: "center" }}>{error}</p>}

      {debug && (
        <div style={{ marginTop: "1.25rem", padding: "1rem", border: `1px solid ${ACCENT}`, borderRadius: 8, background: "rgba(0,0,0,0.4)", fontSize: "0.72rem", color: "rgba(255,255,255,0.85)", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          <div style={{ color: ACCENT, marginBottom: 8 }}>DEBUG — {debug.chunks.length} chunk(s), merged accounts: {debug.mergedAccounts}</div>
          {debug.chunks.map((c) => (
            <div key={c.idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div>chunk {c.idx} · {c.chars} chars · {c.error ? `ERROR: ${c.error}` : `${c.accounts} accounts`}</div>
              {c.creditors && c.creditors.length > 0 && <div style={{ color: "rgba(255,255,255,0.55)" }}>{c.creditors.join(", ")}</div>}
            </div>
          ))}
          <Button variant="ghost" onClick={() => onAnalyzed(window.__pendingReport)}>Continue to dashboard →</Button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", marginTop: "1.25rem" }}>
        <Button variant="ghost" onClick={() => onAnalyzed(SAMPLE_REPORT)} disabled={busy}>
          Try it with sample data →
        </Button>
      </div>
    </div>
  );
}
