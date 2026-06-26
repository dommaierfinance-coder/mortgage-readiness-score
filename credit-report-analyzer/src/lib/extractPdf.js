// src/lib/extractPdf.js
// Reads the ENTIRE report, strips legal-disclosure boilerplate, then chunks the text
// on ACCOUNT BOUNDARIES so no single account is ever split across two analysis calls.
//
// Why boundary-aware chunking: long-history accounts (mortgages, HELOCs) span page
// breaks and are buried in large payment-history grids. Splitting blindly at a character
// count cut these accounts in half, so neither parallel call saw a complete tradeline and
// the account vanished. We instead split between accounts, keeping each block intact.

import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MIN_TEXT_CHARS = 200;
const MAX_PDF_BYTES_FOR_FALLBACK = 3.3 * 1024 * 1024;
// Soft target per chunk; we never split an account to honor it.
const CHUNK_TARGET_CHARS = 85000;
const MAX_TOTAL_CHARS = 500000;

const DISCLOSURE_HINTS = [
  "fair credit reporting act",
  "summary of your rights",
  "you have the right to",
  "para informaci",
  "equal credit opportunity act",
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
    if (isDisclosureLine(line)) continue;
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

// Each account block in these reports is anchored by an "Account Information" line,
// preceded by the creditor name (and usually a "Total Months:" / grid above it).
// We treat "Account Information" as the start-of-account marker and cut chunks
// only at the line BEFORE a marker, so a full account never straddles two chunks.
const ACCOUNT_MARKER = /account information/i;

function splitIntoAccountBlocks(text) {
  const lines = text.split("\n");
  const markerIdx = [];
  for (let i = 0; i < lines.length; i++) {
    if (ACCOUNT_MARKER.test(lines[i])) markerIdx.push(i);
  }
  // No markers found -> fall back to whole text as one block.
  if (markerIdx.length === 0) return [text];

  // Block boundaries: start a new block a couple lines BEFORE each marker so the
  // creditor name (which sits just above "Account Information") stays with its block.
  const starts = markerIdx.map((idx) => Math.max(0, idx - 2));
  // Dedup/sort starts.
  const uniqStarts = [...new Set(starts)].sort((a, b) => a - b);

  const blocks = [];
  // Preamble (header/personal info) before the first account becomes its own block.
  if (uniqStarts[0] > 0) blocks.push(lines.slice(0, uniqStarts[0]).join("\n"));
  for (let k = 0; k < uniqStarts.length; k++) {
    const from = uniqStarts[k];
    const to = k + 1 < uniqStarts.length ? uniqStarts[k + 1] : lines.length;
    blocks.push(lines.slice(from, to).join("\n"));
  }
  return blocks.filter((b) => b.trim().length > 0);
}

// Pack whole account blocks into chunks up to ~CHUNK_TARGET_CHARS, never splitting a block.
function chunkByBlocks(text) {
  const blocks = splitIntoAccountBlocks(text);
  const chunks = [];
  let current = "";
  for (const block of blocks) {
    // If a single block alone exceeds the target, it still goes in its own chunk whole.
    if (current && current.length + block.length + 1 > CHUNK_TARGET_CHARS) {
      chunks.push(current);
      current = "";
    }
    current += (current ? "\n" : "") + block;
  }
  if (current.trim()) chunks.push(current);
  return chunks.length ? chunks : [text];
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
    return { mode: "chunks", chunks: chunkByBlocks(filtered) };
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
