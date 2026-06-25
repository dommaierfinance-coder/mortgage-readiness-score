import Anthropic from "@anthropic-ai/sdk";

// Vercel: give the model room to read a long report.
export const config = { maxDuration: 60 };

// Structured-output schema. Claude reads the report (text or PDF) and returns exactly this shape,
// which the browser-side engine (src/lib/credit.js) then analyzes.
const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    bureau: { type: ["string", "null"], description: "Equifax, Experian, TransUnion, or the source" },
    reportDate: { type: ["string", "null"], description: "Report date, YYYY-MM-DD if available" },
    providedScore: { type: ["integer", "null"], description: "Credit score printed on the report, 300-850, else null" },
    scoreModel: { type: ["string", "null"], description: "e.g. FICO 8, VantageScore 3.0" },
    accounts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          creditor: { type: "string" },
          type: { type: "string", enum: ["revolving", "installment", "mortgage", "auto", "student", "personal", "other"] },
          balance: { type: "number" },
          creditLimit: { type: ["number", "null"] },
          highBalance: { type: ["number", "null"] },
          monthlyPayment: { type: ["number", "null"] },
          opened: { type: ["string", "null"], description: "YYYY-MM" },
          status: { type: "string", enum: ["open", "closed"] },
          worstStatus: { type: "string", enum: ["current", "late30", "late60", "late90", "collection", "chargeoff", "unknown"] },
          late30: { type: "integer" },
          late60: { type: "integer" },
          late90: { type: "integer" },
          pastDue: { type: "number" },
          dateFirstDelinquency: { type: ["string", "null"] },
        },
        required: ["id", "creditor", "type", "balance", "creditLimit", "highBalance", "monthlyPayment", "opened", "status", "worstStatus", "late30", "late60", "late90", "pastDue", "dateFirstDelinquency"],
      },
    },
    collections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          agency: { type: "string" },
          originalCreditor: { type: ["string", "null"] },
          balance: { type: "number" },
          status: { type: "string", enum: ["unpaid", "paid"] },
          dateOpened: { type: ["string", "null"] },
          dateFirstDelinquency: { type: ["string", "null"] },
        },
        required: ["id", "agency", "originalCreditor", "balance", "status", "dateOpened", "dateFirstDelinquency"],
      },
    },
    inquiries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          creditor: { type: "string" },
          date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          type: { type: "string", enum: ["hard", "soft"] },
        },
        required: ["creditor", "date", "type"],
      },
    },
    publicRecords: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          amount: { type: "number" },
          dateFiled: { type: ["string", "null"] },
          status: { type: ["string", "null"] },
        },
        required: ["type", "amount", "dateFiled", "status"],
      },
    },
    personalInfoFlags: { type: "array", items: { type: "string" } },
  },
  required: ["bureau", "reportDate", "providedScore", "scoreModel", "accounts", "collections", "inquiries", "publicRecords", "personalInfoFlags"],
};

const INSTRUCTIONS = `You are a meticulous credit-report data extractor. Read the attached credit report and extract every tradeline, collection, hard inquiry, and public record into the structured schema.

Rules:
- Give each account and collection a short unique id (a1, a2, c1, ...).
- type: classify credit cards/charge cards as "revolving"; everything else by kind (mortgage, auto, student, personal, installment, other).
- creditLimit: the card's limit; if absent use the high balance under highBalance and leave creditLimit null.
- worstStatus: the worst payment status ever shown for the account. Use "chargeoff" for charged-off accounts.
- late30/late60/late90: count of 30/60/90-day late marks in the payment history grid.
- providedScore: only if an actual numeric credit score (300-850) is printed; otherwise null.
- Dates: use YYYY-MM-DD when a full date is shown, YYYY-MM when only month/year.
- Do not invent data. Use null / 0 / empty arrays when something isn't present. Never include SSNs or full account numbers.`;

// Generous ceiling after trimming. ~280k chars ≈ ~70k tokens, comfortably within context.
const MAX_TEXT_CHARS = 280000;

/**
 * Long bureau reports (e.g. 100+ page TransUnion pulls) are dominated by repetitive
 * month-by-month payment-history grids and legal disclosure boilerplate that add tokens
 * without helping extraction. We compress those noisy regions while preserving the
 * account/collection/inquiry/public-record substance the schema needs.
 */
function trimReportText(raw) {
  let t = String(raw || "");

  // Normalize whitespace runs.
  t = t.replace(/[ \t\u00a0]{2,}/g, " ");
  // Collapse long runs of blank lines.
  t = t.replace(/\n{3,}/g, "\n\n");

  // Collapse long sequences of payment-grid tokens (OK, 30, 60, 90, CO, ND, dashes, etc.)
  // that repeat across many months. Keep a marker so the model still sees they existed.
  t = t.replace(
    /(?:\b(?:OK|ND|CO|30|60|90|120|150|180|R[1-9]|I[1-9]|C[1-9])\b[\s,|/–-]*){8,}/g,
    " [payment history grid] "
  );

  // Drop obvious legal/disclosure boilerplate blocks common to bureau PDFs.
  const boilerplate = [
    /Fair Credit Reporting Act[\s\S]{0,1200}?(?=\n\n|\n[A-Z])/g,
    /Para inform[\s\S]{0,800}?(?=\n\n)/g, // Spanish-language disclosures
    /You have the right to[\s\S]{0,600}?(?=\n\n)/g,
    /A Summary of Your Rights[\s\S]{0,1200}?(?=\n\n)/g,
  ];
  for (const re of boilerplate) t = t.replace(re, " ");

  // Final whitespace tidy.
  t = t.replace(/\n{3,}/g, "\n\n").trim();

  // Hard cap as a safety net.
  if (t.length > MAX_TEXT_CHARS) t = t.slice(0, MAX_TEXT_CHARS);
  return t;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Set it in your environment, or use the sample data to explore the app." });
  }

  const { text: reportText, pdf } = req.body || {};
  if (!reportText && !pdf) {
    return res.status(400).json({ error: "No report provided." });
  }

  let inputBlock;
  if (reportText && reportText.trim().length > 0) {
    const trimmed = trimReportText(reportText);
    inputBlock = { type: "text", text: `<credit_report>\n${trimmed}\n</credit_report>` };
  } else {
    inputBlock = { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } };
  }

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", name: "credit_report", schema: REPORT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            inputBlock,
            { type: "text", text: INSTRUCTIONS },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return res.status(422).json({ error: "The document could not be processed. Please ensure it's a standard credit report." });
    }

    const text = (message.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let report;
    try {
      report = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Could not parse the report. Please try a different PDF (a text-based report works best)." });
    }
    return res.status(200).json(report);
  } catch (error) {
    const status = error?.status;
    if (status === 401) return res.status(500).json({ error: "Invalid ANTHROPIC_API_KEY." });
    if (status === 413 || status === 400) return res.status(413).json({ error: "This report is unusually large. Please try downloading a fresh copy from AnnualCreditReport.com, or a single-bureau report." });
    console.error("analyze error:", error?.message || error);
    return res.status(500).json({ error: "Analysis failed. Please try again in a moment." });
  }
}
