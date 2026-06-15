import { useState, useRef, useEffect } from "react";
import { ACCENT, BORDER, MONO } from "../theme";
import { Card, SectionTitle, Button } from "./ui";

const SUGGESTIONS = [
  "Which account should I pay off first and why?",
  "How long until I could be mortgage-ready?",
  "Is it worth disputing my collections?",
  "What's hurting my score the most right now?",
];

// Sends a compact, non-identifying summary of the report to the AI coach so it
// can answer questions about THIS user's situation.
function summarize(report, analysis) {
  return {
    score: analysis.score,
    providedScore: analysis.providedScore,
    aggregateUtilization: Math.round((analysis.utilization.aggregate || 0) * 100) + "%",
    cards: analysis.utilization.cards.map((c) => ({
      creditor: c.creditor, balance: c.balance, limit: c.limit, utilization: Math.round(c.util * 100) + "%",
    })),
    negatives: analysis.negatives.map((n) => ({ kind: n.kind, creditor: n.creditor, balance: n.balance, falloff: n.falloff, aged: n.aged })),
    scoredInquiries: analysis.inquiries.scoredCount,
    avgAccountAgeYears: Math.round(analysis.ageMix.avgYears * 10) / 10,
    factors: Object.fromEntries(Object.entries(analysis.factors).map(([k, v]) => [k, Math.round(v.health * 100) + "%"])),
  };
}

export default function Coach({ report, analysis }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi — I've reviewed your report. Ask me anything about your score, what to pay first, or how to get mortgage-ready." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const next = [...messages, { role: "user", text: q }];
    setMessages(next);
    setBusy(true);
    try {
      const resp = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: summarize(report, analysis),
          history: next.slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "The coach is unavailable right now.");
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SectionTitle kicker="Ask" title="Your AI credit coach" sub="Answers grounded in your actual report. Educational guidance — not a credit-repair service or financial advice." />
      <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: 480 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: "0.85rem" }}>
              <div style={{ maxWidth: "82%", padding: "0.7rem 1rem", borderRadius: 10, fontSize: "0.86rem", lineHeight: 1.6, background: m.role === "user" ? ACCENT : "rgba(255,255,255,0.04)", color: m.role === "user" ? "#0a0a0a" : "rgba(255,255,255,0.8)", border: m.role === "user" ? "none" : `1px solid ${BORDER}`, whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          ))}
          {busy && (
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", color: "rgba(255,255,255,0.35)", fontSize: "0.82rem" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid rgba(201,169,110,0.2)", borderTop: `2px solid ${ACCENT}`, animation: "spin 0.8s linear infinite" }} />
              Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div style={{ padding: "0 1.25rem 0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} style={{ padding: "0.45rem 0.8rem", borderRadius: 14, background: "rgba(201,169,110,0.06)", border: `1px solid rgba(201,169,110,0.25)`, color: ACCENT, fontSize: "0.76rem", cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.6rem", padding: "0.85rem 1rem", borderTop: `1px solid ${BORDER}` }}>
          <input
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about your report…"
            style={{ flex: 1, padding: "0.7rem 1rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 6, color: "#fff", fontSize: "0.88rem", fontFamily: "inherit", outline: "none" }}
          />
          <Button onClick={() => send()} disabled={busy} style={{ padding: "0.7rem 1.2rem" }}>Send</Button>
        </div>
      </Card>
    </div>
  );
}
