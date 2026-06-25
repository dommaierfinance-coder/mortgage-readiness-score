// src/lib/extractPdf.js
// Browser-side PDF text extraction with a page cap that covers normal-to-long reports
// while keeping the downstream analysis under the serverless 60s limit.
//
// Reads up to MAX_PAGES, strips obvious payment-grid noise and disclosure boilerplate
// to keep the payload lean, and falls back to OCR for scanned/image PDFs.

import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Covers the large majority of real client reports (incl. long histories) while
// staying fast enough to beat the 60s Hobby-plan function timeout.
const MAX_PAGES = 60;
const MAX_CHARS = 200000;
const MIN_TEXT_CHARS = 200;
const MAX_PDF_BYTES_FOR_FALLBACK = 3.3 * 1024 * 1024;

const GRID_TOKEN = /\b(OK|ND|CO|CLS|N\/A|NA|30|60|90|120|150|180|R[1-9]|I[1-9]|C[1-9]|X{1,2})\b/gi;
const SEPARATORS = /[\s,|/\\\-–—.*]+/g;

function isGridNoiseLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < 12) return false;
  const stripped = trimmed.replace(GRID_TOKEN, "").replace(SEPARATORS, "");
  return stripped.length / trimmed.length < 0.15;
}

const DISCLOSURE_HINTS = [
  "fair credit reporting act",
  "summary of your rights",
  "you have the right",
  "para informaci",
  "equal credit opportunity",
  "consumer financial protection bureau",
  "permissible purpose",
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
    const pageLimit = Math.min(pdf.numPages, MAX_PAGES);
    const parts = [];
    for (let i = 1; i <= pageLimit; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
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
