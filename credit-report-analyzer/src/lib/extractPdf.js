// src/lib/extractPdf.js
// Browser-side PDF text extraction that captures ALL accounts regardless of page,
// while stripping the bulk "noise" (payment-history grids + legal disclosures) that
// would otherwise blow the downstream analysis past the serverless time limit.
//
// Approach: read every page (so a tradeline on page 56 is never missed), then filter
// the text line-by-line, dropping lines that are essentially payment-grid tokens or
// known disclosure boilerplate. Everything substantive (creditors, balances, limits,
// dates, statuses, collections, inquiries) is preserved.

import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MIN_TEXT_CHARS = 200;
const MAX_PDF_BYTES_FOR_FALLBACK = 3.3 * 1024 * 1024;
// Final guardrail after filtering. Plenty for a fully-itemized multi-account report.
const MAX_CHARS = 220000;

// A line is "grid noise" if, after removing common payment-status tokens and
// separators, almost nothing meaningful is left. These tokens repeat month-by-month
// across years and dominate long reports without adding extractable data.
const GRID_TOKEN = /\b(OK|ND|CO|CLS|N\/A|NA|30|60|90|120|150|180|R[1-9]|I[1-9]|C[1-9]|X{1,2})\b/gi;
const SEPARATORS = /[\s,|/\\\-–—.*]+/g;

function isGridNoiseLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < 12) return false; // keep short labels/values
  const stripped = trimmed.replace(GRID_TOKEN, "").replace(SEPARATORS, "");
  // If <15% of the line survives after removing grid tokens/separators, it's a grid row.
  return stripped.length / trimmed.length < 0.15;
}

const DISCLOSURE_HINTS = [
  "fair credit reporting act",
  "summary of your rights",
  "you have the right",
  "para informaci",            // Spanish disclosures
  "equal credit opportunity",
  "consumer financial protection bureau",
  "permissible purpose",
  "this report does not",
];

function isDisclosureLine(line) {
  const l = line.toLowerCase();
  return DISCLOSURE_HINTS.some((h) => l.includes(h));
}

function filterReportText(raw) {
  const lines = String(raw || "").split("\n");
  const kept = [];
  for (const line of lines) {
    if (isGridNoiseLine(line)) continue;
    if (isDisclosureLine(line)) continue;
    kept.push(line);
  }
  let out = kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  if (out.length > MAX_CHARS) out = out.slice(0, MAX_CHARS);
  return out;
}

export async function extractReport(file) {
  if (!file || file.type !== "application/pdf") {
    return { mode: "error", message: "Please upload a PDF credit report." };
  }

  const buffer = await file.arrayBuffer();

  let rawText = "";
  let openedOk = false;

  try {
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    openedOk = true;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Preserve line structure: pdf.js gives items with positions; join with spaces
        // but break lines on items flagged hasEOL when available.
        let pageText = "";
        for (const it of content.items) {
          if (!("str" in it)) continue;
          pageText += it.str;
          pageText += it.hasEOL ? "\n" : " ";
        }
        if (pageText.trim()) parts.push(pageText);
      } catch (pageErr) {
        continue;
      }
    }
    rawText = parts.join("\n");
  } catch (e) {
    openedOk = false;
  }

  const filtered = filterReportText(rawText);

  if (filtered.length >= MIN_TEXT_CHARS) {
    return { mode: "text", text: filtered };
  }

  // No usable text => scanned/image PDF. Try OCR fallback if small enough.
  if (file.size <= MAX_PDF_BYTES_FOR_FALLBACK) {
    const base64 = await fileToBase64(file);
    return { mode: "pdf", pdf: base64 };
  }

  if (openedOk) {
    return {
      mode: "error",
      message:
        "We couldn't read selectable text from this report, and it's too large to process as an image. " +
        "Please download a fresh text-based PDF from AnnualCreditReport.com and try again.",
    };
  }
  return {
    mode: "error",
    message:
      "We couldn't open this PDF. Please re-download your report from AnnualCreditReport.com and upload the new file.",
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
