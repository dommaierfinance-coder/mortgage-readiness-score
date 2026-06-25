// src/lib/extractPdf.js
// Browser-side PDF text extraction with resilient, page-capped reading.
//
// Credit reports are TEXT PDFs but can run 100+ pages. The account/collection/
// inquiry/public-record data the analyzer needs lives in the earlier pages; the
// long tail is repetitive payment-history grids and legal disclosures. We cap how
// many pages we extract so the downstream analysis finishes within the serverless
// time limit, while still capturing everything that matters.

import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Stop extracting after this many pages. Generous enough to capture all tradelines/
// collections/inquiries on even large multi-bureau pulls; small enough to keep
// analysis under the serverless timeout.
const MAX_PAGES = 45;
// Also cap total characters as a second guardrail.
const MAX_CHARS = 180000;
// Below this, treat as scanned/image (no usable text layer).
const MIN_TEXT_CHARS = 200;
// Scanned-PDF OCR fallback ceiling (base64 must clear Vercel's body limit).
const MAX_PDF_BYTES_FOR_FALLBACK = 3.3 * 1024 * 1024;

/**
 * Returns one of:
 *   { mode: "text", text }     -> send as { text }
 *   { mode: "pdf",  pdf }      -> send as { pdf }   (scanned fallback)
 *   { mode: "error", message } -> show to user
 */
export async function extractReport(file) {
  if (!file || file.type !== "application/pdf") {
    return { mode: "error", message: "Please upload a PDF credit report." };
  }

  const buffer = await file.arrayBuffer();

  let text = "";
  let openedOk = false;

  try {
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    openedOk = true;
    const pageLimit = Math.min(pdf.numPages, MAX_PAGES);
    const parts = [];
    let chars = 0;
    for (let i = 1; i <= pageLimit; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
        if (pageText.trim()) {
          parts.push(pageText);
          chars += pageText.length;
        }
        if (chars >= MAX_CHARS) break;
      } catch (pageErr) {
        continue; // skip a bad page, keep going
      }
    }
    text = parts.join("\n").replace(/[ \t]+\n/g, "\n").trim();
    if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
  } catch (e) {
    openedOk = false;
  }

  if (text.length >= MIN_TEXT_CHARS) {
    return { mode: "text", text };
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
