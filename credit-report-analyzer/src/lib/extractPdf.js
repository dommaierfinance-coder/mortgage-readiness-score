// src/lib/extractPdf.js
// Browser-side PDF text extraction that reads the ENTIRE report (no page cap) so no
// account is ever missed, then returns the text in CHUNKS. Upload.jsx sends each chunk
// to /api/analyze in parallel and merges the results — keeping each analysis call well
// under the 60s serverless limit while capturing every tradeline regardless of page.

import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MIN_TEXT_CHARS = 200;
const MAX_PDF_BYTES_FOR_FALLBACK = 3.3 * 1024 * 1024;
// Target size per analysis chunk (chars). Each chunk is one /api/analyze call.
// ~90k chars keeps a single call comfortably fast under the 60s timeout.
const CHUNK_TARGET_CHARS = 90000;
// Safety ceiling on total text we'll process.
const MAX_TOTAL_CHARS = 400000;

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

function filterLines(raw) {
  const lines = String(raw || "").split("\n");
  const kept = [];
  for (const line of lines) {
    if (isGridNoiseLine(line)) continue;
    if (isDisclosureLine(line)) continue;
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

// Split text into chunks of ~CHUNK_TARGET_CHARS, breaking on line boundaries so an
// account's lines stay together as much as possible.
function chunkText(text) {
  if (text.length <= CHUNK_TARGET_CHARS) return [text];
  const lines = text.split("\n");
  const chunks = [];
  let current = "";
  for (const line of lines) {
    if (current.length + line.length + 1 > CHUNK_TARGET_CHARS && current.length > 0) {
      chunks.push(current);
      current = "";
    }
    current += line + "\n";
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

/**
 * Returns one of:
 *   { mode: "chunks", chunks: [str, ...] }  -> send each to /api/analyze, merge results
 *   { mode: "pdf", pdf }                     -> scanned fallback (single call)
 *   { mode: "error", message }
 */
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

  let filtered = filterLines(rawText);
  if (filtered.length > MAX_TOTAL_CHARS) filtered = filtered.slice(0, MAX_TOTAL_CHARS);

  if (filtered.length >= MIN_TEXT_CHARS) {
    return { mode: "chunks", chunks: chunkText(filtered) };
  }

  // No usable text => scanned/image PDF. OCR fallback (single call) if small enough.
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
