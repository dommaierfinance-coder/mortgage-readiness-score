import { useState, useRef } from "react";
import { ACCENT, BORDER, RED } from "../theme";
import { Button } from "./ui";
import { SAMPLE_REPORT } from "../sampleReport";
import { extractReport } from "../lib/extractPdf";

// Text PDFs send only extracted text (tiny), so the only real ceiling is the
// scanned-PDF fallback path, which extractReport caps internally (~3.3 MB).
// We allow large uploads here because a 30 MB *text* report still sends ~50 KB.
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
      // Extract text in the browser. Falls back to sending the PDF for scanned reports.
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
