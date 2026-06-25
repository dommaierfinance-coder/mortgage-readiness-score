// src/lib/extractPdf.js
// Browser-side PDF text extraction with resilient page-by-page reading.
//
// Credit reports from the bureaus are TEXT PDFs but can be very long (100+ pages).
// We extract page by page so a single problematic page can't abort the whole job,
// and we keep whatever text we successfully pull. Only a PDF that yields essentially
// no text at all is treated as scanned/image-based and routed to the OCR fallback.

import * as pdfjsLib from "pdfjs-dist";

// Load the pdf.js worker from a CDN that matches the installed version exactly.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Below this, we treat the document as having no usable text layer (scanned).
const MIN_TEXT_CHARS = 200;
// Fallback (scanned) path ceiling: base64 inflates ~33%, must clear Vercel's ~4.5 MB body cap.
const MAX_PDF_BYTES_FOR_FALLBACK = 3.3 * 1024 * 1024;

/**
 * Returns one of:
 *   { mode: "text", text }            -> send as { text }
 *   { mode: "pdf",  pdf }             -> send as { pdf }   (scanned fallback)
 *   { mode: "error", message }        -> show to user
 */
export async function extractReport(file) {
  if (!file || file.type !== "application/pdf") {
    return { mode: "error", message: "Please upload a PDF credit report." };
  }

  const buffer = await file.arrayBuffer();

  let text = "";
  let pagesRead = 0;
  let openedOk = false;

  try {
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    openedOk = true;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
        if (pageText.trim()) {
          parts.push(pageText);
          pagesRead++;
        }
      } catch (pageErr) {
        // Skip a bad page, keep going.
        continue;
      }
    }
    text = parts.join("\n").replace(/[ \t]+\n/g, "\n").trim();
  } catch (e) {
    // Could not open/parse the PDF at all.
    openedOk = false;
  }

  // Got usable text -> always send as text (works regardless of file size).
  if (text.length >= MIN_TEXT_CHARS) {
    return { mode: "text", text };
  }

  // Opened fine but essentially no text => scanned/image PDF. Try OCR fallback if small enough.
  if (file.size <= MAX_PDF_BYTES_FOR_FALLBACK) {
    const base64 = await fileToBase64(file);
    return { mode: "pdf", pdf: base64 };
  }

  // No text and too large to send as a PDF.
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
