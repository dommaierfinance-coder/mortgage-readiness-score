import Anthropic from "@anthropic-ai/sdk";

// Vercel: give the model room to read a multi-page PDF.
export const config = { maxDuration: 60 };

// Structured-output schema. Claude reads the PDF and returns exactly this shape,
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

const INSTRUCTIONS = `You are a meticulous credit-report data extractor. Read the attached credit report PDF and extract every tradeline, collection, hard inquiry, and public record into the structured schema.

Rules:
- Give each account and collection a short unique id (a1, a2, c1, ...).
- type: classify credit cards/charge cards as "revolving"; everything else by kind (mortgage, auto, student, personal, installment, other).
- creditLimit: the card's limit; if absent use the high balance under highBalance and leave creditLimit null.
- worstStatus: the worst payment status ever shown for the account. Use "chargeoff" for charged-off accounts.
- late30/late60/late90: count of 30/60/90-day late marks in the payment history grid.
- providedScore: only if an actual numeric credit score (300-850) is printed; otherwise null.
- Dates: use YYYY-MM-DD when a full date is shown, YYYY-MM when only month/year.
- Do not invent data. Use null / 0 / empty arrays when something isn't present. Never include SSNs or full account numbers.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Set it in your environment, or use the sample data to explore the app." });
  }

  const { pdf } = req.body || {};
  if (!pdf) return res.status(400).json({ error: "No PDF provided." });

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", name: "credit_report", schema: REPORT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
            { type: "text", text: INSTRUCTIONS },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return res.status(422).json({ error: "The document could not be processed. Please ensure it's a standard credit report PDF." });
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
    if (status === 413 || status === 400) return res.status(413).json({ error: "That PDF is too large to process. Please upload a smaller, text-based report." });
    console.error("analyze error:", error?.message || error);
    return res.status(500).json({ error: "Analysis failed. Please try again in a moment." });
  }
}
