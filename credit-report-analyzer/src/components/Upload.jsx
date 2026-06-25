import { useState, useRef } from "react";
import { ACCENT, BORDER, RED } from "../theme";
import { Button } from "./ui";
import { SAMPLE_REPORT } from "../sampleReport";
import { extractReport } from "../lib/extractPdf";

const MAX_MB = 30;

export default function Upload({ onAnalyzed }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  async function handleFile(file) {
    setError("");
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF of your credit report.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please upload a PDF under ${MAX_MB} MB.`);
      return;
    }
    setBusy(true);
    setStatus("Reading your report…");
    try {
      const extracted = await extractReport(file);

      if (extracted.mode === "error") {
        setError(extracted.message);
        setBusy(false);
        setStatus("");
        return;
      }

      const payload =
        extracted.mode === "text" ? { text: extracted.text } : { pdf: extracted.pdf };

      setStatus("Analyzing accounts, balances and negatives…");
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Analysis failed (${resp.status}).`);
      }
      const report = await resp.json();
      onAnalyzed(report);
    } catch (e) {
      setError(e.message || "Something went wrong analyzing your report. Please try again.");
      setBusy(false);
      setStatus("");
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
          borderRadius: 12,
          padding: "3rem 2rem",
          textAlign: "center",
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
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.78rem", marginTop: "0.5rem" }}>This usually takes 15–30 seconds.</p>
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

      <div style={{ display: "flex", justifyContent: "center", marginTop: "1.25rem" }}>
        <Button variant="ghost" onClick={() => onAnalyzed(SAMPLE_REPORT)} disabled={busy}>
          Try it with sample data →
        </Button>
      </div>

      <div style={{ marginTop: "2rem", padding: "1.1rem 1.25rem", border: `1px solid ${BORDER}`, borderRadius: 8, background: "rgba(255,255,255,0.015)" }}>
        <div style={{ fontSize: "0.65rem", color: ACCENT, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.6rem" }}>Your privacy</div>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", lineHeight: 1.7 }}>
          <li>Your report is analyzed and <strong style={{ color: "rgba(255,255,255,0.7)" }}>never stored</strong> on our servers.</li>
          <li>The analysis runs in your browser; only non-identifying score snapshots are kept locally for progress tracking.</li>
          <li>Get your free report at <span style={{ color: ACCENT }}>AnnualCreditReport.com</span> and download it as a PDF.</li>
        </ul>
      </div>
    </div>
  );
}
