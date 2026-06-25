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
// Vite-friendly worker import.
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// If the whole report yields fewer than this many characters, treat it as scanned.
const MIN_TEXT_CHARS = 400;
// Hard ceiling for the base64 fallback path (~3.3 MB raw PDF after base64 inflation
// stays under Vercel's 4.5 MB body limit).
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

  // --- Step 1: try
