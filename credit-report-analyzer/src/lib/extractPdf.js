// src/lib/extractPdf.js
// Browser-side PDF text extraction with a scanned-report fallback.
//
// Strategy:
//   1. Try to pull the embedded text layer with pdf.js (works for true text PDFs
//      like annualcreditreport.com downloads). Sends ~50 KB instead of a 12 MB file.
//   2. If the extracted text is too thin, the PDF is almost certainly scanned/image-based.
//      Fall back to sending the raw PDF as base64 so Claude can OCR it natively.
//
// Requires: npm install pdfjs-dist

import * as pdfjsLib from "pdfjs-dist";

// Load the pdf.js worker from a CDN that matches the installed version exactly.
// (Avoids bundler-specific worker path resolution, which can break the build.)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// If the whole report yields fewer than this many characters, treat it as scanned.
const MIN_TEXT_CHARS = 400;
// Hard ceiling for the base64 fallback path (~3.3 MB raw PDF after base64 inflation
// stays under Vercel's 4.5 MB body limit). Reports above this on the scanned path
// get a clear message instead of a silent failure.
const MAX_PDF_BYTES_FOR_FALLBACK = 3.3 * 1024 * 1024;

/**
 * Reads a File (PDF) and returns one of:
 *   { mode: "text", text: "..." }     -> send as { text } to /api/analyze
 *   { mode: "pdf",  pdf: "<base64>" }  -> send as { pdf }  to /api/analyze
 *   { mode: "error", message: "..." }  -> show to the user, don't call the API
 */
export async function extractReport(file) {
  if (!file || file.type !== "application/pdf") {
    return { mode: "error", message: "Please upload a PDF credit report." };
  }

  const buffer = await file.arrayBuffer();

  // --- Step 1: try the text layer ---
  let text = "";
  try {
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
      pages.push(pageText);
    }
    text = pages.join("\n").replace(/\s+\n/g, "\n").trim();
  } catch (e) {
    // Corrupt/locked PDF or parsing failure -> try the scanned fallback path below.
    text = "";
  }

  // --- Step 2: decide path ---
  if (text.length >= MIN_TEXT_CHARS) {
    return { mode: "text", text };
  }

  // Thin or empty text => scanned/image PDF. Fall back to sending the PDF for OCR,
  // but only if it's small enough to clear Vercel's body limit.
  if (file.size > MAX_PDF_BYTES_FOR_FALLBACK) {
    return {
      mode: "error",
      message:
        "This looks like a scanned/image report that's too large to process. " +
        "For best results, download a text-based PDF from AnnualCreditReport.com, " +
        "or upload a smaller scan.",
    };
  }

  const base64 = await fileToBase64(file);
  return { mode: "pdf", pdf: base64 };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const result = String(reader.result || "");
      // strip the "data:application/pdf;base64," prefix
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
