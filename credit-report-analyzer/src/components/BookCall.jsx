import { useState } from "react";
import { ACCENT, BORDER, RED, GREEN } from "../theme";
import { Card, SectionTitle, Button } from "./ui";

// Lead capture → hands off to Dom via the shared /api/lead endpoint (Resend +
// Klaviyo), consistent with the rest of the Dom Maier Finance suite.
export default function BookCall({ analysis }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) return setErr("Please fill in all fields.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErr("Please enter a valid email address.");
    setErr("");
    setBusy(true);
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
          score: analysis?.score ?? 0, source: "Credit Report Analyzer",
          submittedAt: new Date().toISOString(),
        }),
      });
    } catch { /* non-blocking */ }
    setBusy(false);
    setDone(true);
  }

  const field = (key, label, ph, type = "text") => (
    <div>
      <label style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.35rem" }}>{label}</label>
      <input type={type} value={form[key]} placeholder={ph} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        style={{ width: "100%", padding: "0.75rem 1rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 5, color: "#fff", fontSize: "0.9rem", fontFamily: "inherit", outline: "none" }} />
    </div>
  );

  return (
    <div>
      <SectionTitle kicker="Get help" title="Talk through your mortgage-readiness goals" sub="Book a free, no-obligation consultation about your path to home financing. Dom is a licensed loan originator — this is an educational mortgage-readiness conversation, not a credit-repair service. He won't dispute, remove, or fix items on your report." />
      <Card style={{ padding: "1.75rem" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "0.65rem", color: GREEN, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.6rem" }}>Request received</div>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.95rem", lineHeight: 1.6, margin: 0 }}>
              Thanks, <strong style={{ color: "#fff" }}>{form.name.split(" ")[0]}</strong>. Dom will be in touch shortly to schedule your consultation.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "0.85rem", marginBottom: "1rem" }}>
              {field("name", "Full name", "Jane Smith")}
              {field("email", "Email", "jane@example.com", "email")}
              {field("phone", "Phone", "(555) 000-0000", "tel")}
            </div>
            {err && <p style={{ color: RED, fontSize: "0.82rem", marginBottom: "0.75rem" }}>{err}</p>}
            <Button onClick={submit} disabled={busy} style={{ padding: "0.8rem 1.75rem", textTransform: "uppercase", fontWeight: 700 }}>
              {busy ? "Sending…" : "Book my free consultation →"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
