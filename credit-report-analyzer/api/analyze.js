import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };

// JSON shape we ask Claude to return. (Described in the prompt; we parse the result.)
const SCHEMA_HINT = `{
  "bureau": string|null,                // Equifax, Experian, TransUnion, or source
  "reportDate": string|null,            // YYYY-MM-DD if available
  "providedScore": integer|null,        // printed score 300-850, else null
  "scoreModel": string|null,            // e.g. "FICO 8", "VantageScore 3.0"
  "accounts": [{
    "id": string,                       // short unique id: a1, a2, ...
    "creditor": string,
    "type": "revolving"|"installment"|"mortgage"|"auto"|"student"|"personal"|"other",
    "balance": number,
    "creditLimit": number|null,
    "highBalance": number|null,
    "monthlyPayment": number|null,
    "opened": string|null,              // YYYY-MM
    "status": "open"|"closed",
    "worstStatus": "current"|"late30"|"late60"|"late90"|"collection"|"chargeoff"|"unknown",
    "late30": integer,
    "late60": integer,
    "late90": integer,
    "pastDue": number,
    "dateFirstDelinquency": string|null
  }],
  "collections": [{
    "id": string,                       // c1, c2, ...
    "agency": string,
    "originalCreditor": string|null,
    "balance": number,
    "status": "unpaid"|"paid",
    "dateOpened": string|null,
    "dateFirstDelinquency": string|null
  }],
  "inquiries": [{ "creditor": string, "date": string|null, "type": "hard"|"soft" }],
  "publicRecords": [{ "type": string, "amount": number, "dateFiled": string|null, "status": string|null }],
  "personalInfoFlags": [string]
}`;

const INSTRUCTIONS = `You are a meticulous credit-report data extractor. Read the credit report and extract every tradeline, collection, hard inquiry, and public record.

Return ONLY a single JSON object matching exactly this shape (no markdown, no backticks, no commentary before or after):
${SCHEMA_HINT}

Rules:
- Give each account and collection a short unique id (a1, a2, c1, ...).
- type: classify credit cards/charge cards as "revolving"; everything else by kind (mortgage, auto, student, personal, installment, other).
- creditLimit: the card's limit; if absent use the high balance under highBalance and leave creditLimit null.
- worstStatus: the worst payment status ever shown. Use "chargeoff" for charged-off accounts.
- late30/late60/late90: count of 30/60/90-day late marks in the payment history.
- providedScore: only if an actual numeric score (300-850) is printed; otherwise null.
- Dates: YYYY-MM-DD when a full date is shown, YYYY-MM when only month/year.
- Do not invent data. Use null / 0 / empty arrays when absent. Never include SSNs or full account numbers.
- Output must be valid JSON and nothing else.`;

const MAX_TEXT_CHARS = 600000;

function stripToJson(s) {
  let t = String(s || "").trim();
  // Remove ```json fences if present.
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  // Slice from first { to last } to drop any stray prose.
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
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
    let t = reportText.replace(/[ \t\u00a0]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (t.length > MAX_TEXT_CHARS) t = t.slice(0, MAX_TEXT_CHARS);
    inputBlock = { type: "text", text: `<credit_report>\n${t}\n</credit_report>` };
  } else {
    inputBlock = { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } };
  }

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
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

    const raw = (message.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let report;
    try {
      report = JSON.parse(stripToJson(raw));
    } catch {
      return res.status(502).json({ error: "Could not parse the report. Please try again." });
    }
    return res.status(200).json(report);
  } catch (error) {
    const status = error?.status;
    const msg = error?.message || String(error);
    console.error("analyze error:", status, msg);
    if (status === 401) return res.status(500).json({ error: "Invalid ANTHROPIC_API_KEY." });
    return res.status(500).json({ error: `Analysis failed: ${msg.slice(0, 180)}` });
  }
}
