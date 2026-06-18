import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 30 };

const SYSTEM = `You are a knowledgeable, encouraging credit coach for Dom Maier Finance, helping people get mortgage-ready.

You are given a compact, non-identifying summary of the user's credit report. Answer their questions using THAT specific data — reference their actual cards, balances, utilization, and negatives. Be concrete and prioritized: tell them exactly what to do first and why.

Guidelines:
- Lead with the answer. Keep replies to 2-4 short paragraphs or a tight list.
- Utilization is the fastest lever; payment history matters most long-term.
- When relevant, suggest disputes, goodwill letters, or pay-for-delete for negatives.
- This is educational information, not financial, legal, or credit-repair advice. Don't promise specific score numbers.
- If asked something the report doesn't cover, say so briefly and give general best practice.`;

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
      return res.status(200).json({ reply: "I can't help with that one — but ask me anything about paying down balances, disputing negatives, or getting mortgage-ready." });
    }
    const reply = (message.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return res.status(200).json({ reply: reply || "Sorry, I didn't catch that — could you rephrase?" });
  } catch (error) {
    console.error("coach error:", error?.message || error);
    return res.status(500).json({ error: "The coach is unavailable right now. Please try again shortly." });
  }
}
