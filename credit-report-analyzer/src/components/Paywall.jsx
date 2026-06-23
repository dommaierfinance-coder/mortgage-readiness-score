import { useState } from "react";
import { ACCENT, BORDER, RED, GREEN } from "../theme";
import { Card, SectionTitle, Button } from "./ui";
import { verifyLicense } from "../lib/license";

// Gumroad checkout link — set VITE_GUMROAD_URL in the Vercel project (build-time).
const BUY_URL = import.meta.env.VITE_GUMROAD_URL || "";

const PERKS = [
  "Full report analysis with your 300–850 score estimate",
  "Five-factor breakdown of what's affecting your score",
  "Paydown optimizer with budget allocation",
  "What-if score simulator",
  "AI coach to help you understand your report",
  "Negative-item timeline & progress tracking",
];

export default function Paywall({ feature, onUnlock }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function unlock() {
    if (!key.trim()) return setError("Enter the license key from your purchase email.");
    setError("");
    setBusy(true);
    try {
      const res = await verifyLicense(key);
      if (res.valid) onUnlock?.();
      else setError(res.error || "That key didn't work.");
    } catch {
      setError("Couldn't verify right now — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SectionTitle kicker="Premium" title="Unlock the Credit Report Analyzer" sub="Upload your report and get your full score breakdown, paydown optimizer, what-if simulator, and AI coach. One-time purchase — then enter your license key below to unlock." />
      <Card style={{ padding: "1.75rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.5rem" }}>
          {PERKS.map((p) => (
            <div key={p} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
              <span style={{ color: ACCENT, fontWeight: 700, flexShrink: 0 }}>✓</span>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.88rem", lineHeight: 1.5 }}>{p}</span>
            </div>
          ))}
        </div>

        <Button
          onClick={() => BUY_URL && window.open(BUY_URL, "_blank")}
          disabled={!BUY_URL}
          style={{ width: "100%", padding: "0.85rem", textTransform: "uppercase", fontWeight: 700, marginBottom: "1.25rem", opacity: BUY_URL ? 1 : 0.5 }}
        >
          {BUY_URL ? "Unlock the Toolkit →" : "Purchase link coming soon"}
        </Button>

        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "1.25rem" }}>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
            Already purchased? Enter your license key
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
              style={{ flex: "1 1 220px", padding: "0.7rem 1rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 5, color: "#fff", fontSize: "0.85rem", fontFamily: "'Courier New',monospace", outline: "none" }}
            />
            <Button onClick={unlock} disabled={busy} style={{ padding: "0.7rem 1.4rem" }}>{busy ? "Checking…" : "Unlock"}</Button>
          </div>
          {error && <p style={{ color: RED, fontSize: "0.8rem", margin: "0.6rem 0 0" }}>{error}</p>}
        </div>
      </Card>
      <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "1rem" }}>
        One-time purchase · Your key is checked securely and saved on this device.
      </p>
    </div>
  );
}
