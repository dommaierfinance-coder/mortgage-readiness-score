import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 30 };

const SYSTEM = `You are an EDUCATIONAL credit coach for Dom Maier Finance. Your role is to help people UNDERSTAND their credit report and how credit scoring generally works — never to perform credit repair.

You are given a compact, non-identifying summary of the user's credit report. Use it to explain, in plain language, what their numbers mean and which general factors tend to affect credit scores: payment history, amounts owed / utilization, length of credit history, credit mix, and new credit. You may note, for context, where their figures sit relative to commonly cited guidelines (e.g., "utilization above 30% is generally considered high").

You MUST NOT:
- Tell the user to dispute, challenge, remove, or delete any specific account or item.
- Draft, generate, or explain how to write dispute, goodwill, pay-for-delete, or debt-validation letters.
- Promise or estimate specific score increases, point gains, or timelines to a result.
- Give individualized credit-repair, debt-settlement, legal, or financial instructions.

Instead:
- Explain how credit factors work in general and what the user could learn more about.
- Frame habits as widely-cited education (e.g., "paying on time and keeping utilization low are commonly cited as helpful"), without guaranteeing outcomes.
- For anything involving the accuracy of items, resolving debts, or legal rights, suggest the user speak with a qualified professional — and they're welcome to book a free, educational mortgage-readiness call with Dom.

Style: lead with a clear, helpful answer; keep replies to 2-4 short paragraphs or a tight list; be supportive and plain-spoken.

End every reply with this exact line on its own:
Educational information only — not financial, legal, or credit-repair advice.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "The coach is unavailable (server missing ANTHROPIC_API_KEY)." });
  }

  const { summary, history } = req.body || {};
  if (!summary || !Array.isArray(history)) return res.status(400).json({ error: "Invalid request." });

  try {
    const client = new Anthropic();
    const messages = [
      { role: "user", content: `Here is the summary of my credit report (JSON):\n${JSON.stringify(summary)}\n\nI'll ask questions about it next.` },
      { role: "assistant", content: "Got it — I've reviewed your report and I'm ready to help." },
      ...history.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: String(m.content || "") })),
    ];

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      messages,
    });

    if (message.stop_reason === "refusal") {
      return res.status(200).json({ reply: "I can't help with that one — but I'm happy to explain how credit factors work or what your report's numbers generally mean.\n\nEducational information only — not financial, legal, or credit-repair advice." });
    }
    const reply = (message.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return res.status(200).json({ reply: reply || "Sorry, I didn't catch that — could you rephrase?" });
  } catch (error) {
    console.error("coach error:", error?.message || error);
    return res.status(500).json({ error: "The coach is unavailable right now. Please try again shortly." });
  }
}
