import { useMemo, useState } from "react";
import {
  ACCENT, BORDER, RED, AMBER, GREEN, MONO,
  scoreColor, fmtUSD, fmtPct,
} from "../theme";
import { Card, SectionTitle, Button, Pill, Bar, ScoreDial } from "./ui";
import {
  paydownPlan, scoreFactors, utilization, anchoredScore,
} from "../lib/credit";
import { LETTER_TYPES, buildLetter } from "../lib/letters";

const healthColor = (h) => (h >= 0.8 ? GREEN : h >= 0.55 ? ACCENT : h >= 0.35 ? AMBER : RED);

// ---------------------------------------------------------------------------
// Score factor dashboard
// ---------------------------------------------------------------------------
export function ScoreFactors({ analysis }) {
  const f = analysis.factors;
  const rows = [f.payment, f.utilization, f.age, f.mix, f.inquiry];
  return (
    <div>
      <SectionTitle kicker="Overview" title="Your score at a glance" sub="An estimate built from the five factors that determine a FICO score. When your report includes a real score, we anchor to it." />
      <Card style={{ padding: "1.75rem" }}>
        <ScoreDial
          score={analysis.score}
          note={analysis.providedScore ? `Reported on file: ${analysis.providedScore}. Bars below show where each factor stands.` : "Estimated from your report. Bars below show where each factor stands."}
        />
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
        {rows.map((r) => (
          <Card key={r.label} style={{ padding: "1.1rem 1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{r.label}</span>
              <Pill color="rgba(255,255,255,0.4)">{Math.round(r.weight * 100)}% of score</Pill>
            </div>
            <Bar value={r.health} color={healthColor(r.health)} />
            <div style={{ fontSize: "0.72rem", color: healthColor(r.health), marginTop: "0.5rem", fontWeight: 600 }}>
              {r.health >= 0.8 ? "Strong" : r.health >= 0.55 ? "Fair" : r.health >= 0.35 ? "Needs work" : "Hurting your score"}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fastest-paydown optimizer
// ---------------------------------------------------------------------------
export function PaydownOptimizer({ report }) {
  const [budgetStr, setBudgetStr] = useState("");
  const budget = budgetStr.trim() === "" ? null : Math.max(0, Number(budgetStr.replace(/[^0-9.]/g, "")));
  const plan = useMemo(() => paydownPlan(report, budget), [report, budget]);
  const u = utilization(report);

  return (
    <div>
      <SectionTitle
        kicker="Fastest gains"
        title="Pay down in this order"
        sub="Credit utilization updates within one billing cycle, so it's the quickest lever. We rank each paydown by score-points-per-dollar and cross the thresholds (90% → 50% → 30% → 10% → $0) that actually move your score."
      />

      <Card style={{ padding: "1.25rem 1.5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: "0.4rem" }}>
              How much can you put toward balances? (optional)
            </label>
            <input
              value={budgetStr}
              onChange={(e) => setBudgetStr(e.target.value)}
              placeholder="e.g. 1500"
              inputMode="numeric"
              style={{ width: "100%", padding: "0.7rem 1rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 5, color: "#fff", fontSize: "0.95rem", fontFamily: "inherit", outline: "none" }}
            />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Projected score</div>
            <div style={{ fontFamily: MONO, fontSize: "1.5rem", fontWeight: 700 }}>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>{plan.startScore}</span>
              <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 0.4rem" }}>→</span>
              <span style={{ color: scoreColor(plan.endScore) }}>{plan.endScore}</span>
              {plan.endScore > plan.startScore && <span style={{ color: GREEN, fontSize: "0.9rem", marginLeft: "0.4rem" }}>+{plan.endScore - plan.startScore}</span>}
            </div>
          </div>
        </div>
        <div style={{ marginTop: "0.85rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
          <span>Overall utilization: <strong style={{ color: scoreColor(900 - u.aggregate * 300) }}>{fmtPct(u.aggregate)}</strong></span>
          <span>Total card debt: <strong style={{ color: "#fff" }}>{fmtUSD(u.totalBalance)}</strong></span>
          {budget != null && <span>Plan cost: <strong style={{ color: "#fff" }}>{fmtUSD(plan.totalCost)}</strong></span>}
        </div>
      </Card>

      {plan.steps.length === 0 ? (
        <Card style={{ padding: "1.5rem", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
          No revolving balances to pay down — your utilization is already in great shape.
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {plan.steps.map((s, i) => (
            <Card key={i} style={{ padding: "0.9rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "rgba(201,169,110,0.12)", border: `1px solid rgba(201,169,110,0.4)`, color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff" }}>{s.creditor}</div>
                <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.45)" }}>
                  Pay {fmtUSD(s.amount)} → {s.paidOff ? "pays this card off" : `drops it from ${fmtPct(s.fromUtil)} to ${fmtPct(s.toUtil)} utilization`}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {s.impact > 0 && <div style={{ color: GREEN, fontWeight: 700, fontFamily: MONO, fontSize: "0.95rem" }}>+{s.impact}</div>}
                <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)" }}>est. pts</div>
              </div>
            </Card>
          ))}
          <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", margin: "0.5rem 0 0", lineHeight: 1.6 }}>
            Point estimates are directional, not a promise — actual movement depends on your full file. The <em>order</em> is what matters: it always front-loads the cheapest, highest-impact paydowns.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// What-if simulator
// ---------------------------------------------------------------------------
export function Simulator({ report }) {
  const cards = utilization(report).cards;
  const [balances, setBalances] = useState(() => Object.fromEntries(cards.map((c) => [c.id, c.balance])));
  const [removed, setRemoved] = useState({}); // negative id -> bool

  const baseEstimate = useMemo(() => scoreFactors(report, {}).estimate, [report]);
  const baseAnchored = useMemo(() => anchoredScore(report, {}), [report]);

  // Build a modified report reflecting the toggles, then estimate.
  const scenario = useMemo(() => {
    const modified = {
      ...report,
      collections: (report.collections || []).filter((c) => !removed["coll:" + c.id]),
      accounts: (report.accounts || []).map((a) =>
        removed["chg:" + a.id] ? { ...a, worstStatus: "current", late30: 0, late60: 0, late90: 0 } : a
      ),
    };
    const est = scoreFactors(modified, balances).estimate;
    const delta = est - baseEstimate;
    return Math.max(300, Math.min(850, baseAnchored + delta));
  }, [report, balances, removed, baseEstimate, baseAnchored]);

  const delta = scenario - baseAnchored;
  const chargeoffs = (report.accounts || []).filter((a) => a.worstStatus === "chargeoff");
  const collections = report.collections || [];

  return (
    <div>
      <SectionTitle kicker="What-if" title="Model your moves" sub="Drag a balance down or remove a negative to see the estimated impact instantly. Great for deciding where your next dollar — or dispute — goes." />

      <Card style={{ padding: "1.5rem", marginBottom: "1rem", textAlign: "center" }}>
        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.4rem" }}>Simulated score</div>
        <div style={{ fontFamily: MONO, fontSize: "2.6rem", fontWeight: 700, color: scoreColor(scenario), lineHeight: 1 }}>{scenario}</div>
        <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: delta > 0 ? GREEN : delta < 0 ? RED : "rgba(255,255,255,0.4)" }}>
          {delta > 0 ? `+${delta} from today (${baseAnchored})` : delta < 0 ? `${delta} from today (${baseAnchored})` : `Same as today (${baseAnchored})`}
        </div>
      </Card>

      {cards.length > 0 && (
        <Card style={{ padding: "1.25rem 1.5rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.7rem", color: ACCENT, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginBottom: "1rem" }}>Card balances</div>
          {cards.map((c) => {
            const bal = balances[c.id];
            const util = c.limit > 0 ? bal / c.limit : 0;
            return (
              <div key={c.id} style={{ marginBottom: "1.1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.35rem" }}>
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{c.creditor}</span>
                  <span style={{ color: scoreColor(900 - util * 300), fontFamily: MONO }}>{fmtUSD(bal)} · {fmtPct(util)}</span>
                </div>
                <input
                  type="range" min={0} max={c.limit} step={Math.max(1, Math.round(c.limit / 100))} value={bal}
                  onChange={(e) => setBalances((p) => ({ ...p, [c.id]: Number(e.target.value) }))}
                  style={{ width: "100%", accentColor: ACCENT }}
                />
              </div>
            );
          })}
          <Button variant="muted" style={{ padding: "0.4rem 0.9rem", fontSize: "0.78rem" }} onClick={() => setBalances(Object.fromEntries(cards.map((c) => [c.id, c.balance])))}>Reset balances</Button>
        </Card>
      )}

      {(collections.length > 0 || chargeoffs.length > 0) && (
        <Card style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ fontSize: "0.7rem", color: ACCENT, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginBottom: "1rem" }}>Remove a negative</div>
          {collections.map((c) => (
            <Toggle key={c.id} label={`Collection · ${c.agency || c.originalCreditor}`} checked={!!removed["coll:" + c.id]} onChange={(v) => setRemoved((p) => ({ ...p, ["coll:" + c.id]: v }))} />
          ))}
          {chargeoffs.map((a) => (
            <Toggle key={a.id} label={`Charge-off · ${a.creditor}`} checked={!!removed["chg:" + a.id]} onChange={(v) => setRemoved((p) => ({ ...p, ["chg:" + a.id]: v }))} />
          ))}
          <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", margin: "0.5rem 0 0" }}>Simulates a successful dispute, goodwill removal, or pay-for-delete.</p>
        </Card>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", cursor: "pointer" }}>
      <span onClick={() => onChange(!checked)} style={{ width: 40, height: 22, borderRadius: 11, background: checked ? ACCENT : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#0a0a0a", transition: "left 0.2s" }} />
      </span>
      <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Negatives & dispute audit
// ---------------------------------------------------------------------------
export function Negatives({ analysis }) {
  const items = analysis.negatives;
  const sevColor = { dispute: RED, high: RED, medium: AMBER };
  const sevLabel = { dispute: "Dispute now", high: "High impact", medium: "Medium" };
  return (
    <div>
      <SectionTitle kicker="Clean-up" title="Negatives & disputes" sub="Every derogatory item with a recommended action and the date it must legally fall off your report. Items already past that date are flagged to dispute immediately." />
      {items.length === 0 ? (
        <Card style={{ padding: "1.5rem", textAlign: "center", color: GREEN }}>No negative items found — excellent. Keep payments on time and balances low.</Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.map((it, i) => (
            <Card key={i} style={{ padding: "1.1rem 1.25rem", borderColor: it.aged ? "rgba(239,68,68,0.35)" : BORDER }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "#fff" }}>{it.creditor}</span>
                  <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", marginLeft: "0.6rem" }}>{it.kind}</span>
                </div>
                <Pill color={sevColor[it.severity] || AMBER}>{sevLabel[it.severity] || "Review"}</Pill>
              </div>
              {it.detail && <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem" }}>{it.detail}{it.balance > 0 ? ` · ${fmtUSD(it.balance)}` : ""}</div>}
              <div style={{ fontSize: "0.83rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>{it.action}</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginTop: "0.6rem" }}>Falls off: {it.falloff}{it.aged ? " — already past due to drop" : ""}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispute letter generator
// ---------------------------------------------------------------------------
export function LetterGenerator({ report, analysis }) {
  const [type, setType] = useState("dispute");
  const [itemIdx, setItemIdx] = useState(0);
  const [sender, setSender] = useState({ name: "", address: "", cityStateZip: "", ssnLast4: "" });
  const [copied, setCopied] = useState(false);

  const items = analysis.negatives.length ? analysis.negatives : [{ creditor: "" }];
  const letter = useMemo(() => buildLetter(type, items[itemIdx] || items[0], sender), [type, itemIdx, items, sender]);

  const download = () => {
    const blob = new Blob([letter], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${type}-letter.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copy = () => { navigator.clipboard?.writeText(letter); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const field = (key, label, ph) => (
    <div style={{ flex: "1 1 180px" }}>
      <label style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.3rem" }}>{label}</label>
      <input value={sender[key]} onChange={(e) => setSender((p) => ({ ...p, [key]: e.target.value }))} placeholder={ph}
        style={{ width: "100%", padding: "0.6rem 0.8rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 5, color: "#fff", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }} />
    </div>
  );

  return (
    <div>
      <SectionTitle kicker="Take action" title="Generate a dispute letter" sub="Pre-filled and ready to print and mail. Fill in your details, pick the item and letter type, then download. Send by certified mail and keep copies." />
      <Card style={{ padding: "1.25rem 1.5rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <div style={{ flex: "1 1 220px" }}>
            <label style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.3rem" }}>Letter type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
              {LETTER_TYPES.map((t) => <option key={t.id} value={t.id} style={{ background: "#111" }}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <label style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.3rem" }}>Item</label>
            <select value={itemIdx} onChange={(e) => setItemIdx(Number(e.target.value))} style={selectStyle}>
              {items.map((it, i) => <option key={i} value={i} style={{ background: "#111" }}>{it.creditor || "Manual entry"}{it.kind ? ` (${it.kind})` : ""}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {field("name", "Your name", "Jane Smith")}
          {field("address", "Street address", "123 Main St")}
          {field("cityStateZip", "City, State ZIP", "Austin, TX 78701")}
          {field("ssnLast4", "SSN last 4", "1234")}
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", padding: "0.75rem 1rem", borderBottom: `1px solid ${BORDER}` }}>
          <Button variant="muted" style={{ padding: "0.4rem 0.9rem", fontSize: "0.78rem" }} onClick={copy}>{copied ? "Copied ✓" : "Copy"}</Button>
          <Button variant="ghost" style={{ padding: "0.4rem 0.9rem", fontSize: "0.78rem" }} onClick={download}>Download .txt</Button>
        </div>
        <pre style={{ margin: 0, padding: "1.25rem 1.5rem", whiteSpace: "pre-wrap", fontFamily: MONO, fontSize: "0.78rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, maxHeight: 420, overflow: "auto" }}>{letter}</pre>
      </Card>
    </div>
  );
}
const selectStyle = { width: "100%", padding: "0.6rem 0.8rem", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 5, color: "#fff", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" };

// ---------------------------------------------------------------------------
// Action roadmap
// ---------------------------------------------------------------------------
export function Roadmap({ analysis }) {
  const r = analysis.roadmap;
  const groups = [
    { title: "This month", color: RED, items: r.now },
    { title: "Next 30–60 days", color: AMBER, items: r.soon },
    { title: "Ongoing habits", color: GREEN, items: r.ongoing },
  ];
  return (
    <div>
      <SectionTitle kicker="Your plan" title="Step-by-step roadmap" sub="Everything above, sequenced into a plan you can actually follow." />
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {groups.map((g) => (
          <Card key={g.title} style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.9rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.color }} />
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>{g.title}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
              {g.items.map((it, i) => (
                <div key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                  <span style={{ color: g.color, fontSize: "0.8rem", marginTop: "0.1rem", flexShrink: 0 }}>→</span>
                  <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>{it}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Education hub
// ---------------------------------------------------------------------------
const LESSONS = [
  { q: "What actually moves my score the fastest?", a: "Credit utilization. It's ~30% of your FICO score and recalculates every billing cycle, so paying a card below 30% (then 10%) can lift your score within weeks — far faster than waiting for negatives to age off." },
  { q: "What is the '30% rule' and the AZEO trick?", a: "Keep each card and your overall balance under 30% of the limit — under 10% is even better. 'AZEO' (All Zero Except One) means paying every card to $0 and leaving a tiny balance on just one before the statement closes. It's an advanced trick that can squeeze out a few extra points right before a mortgage application." },
  { q: "Should I close old credit cards?", a: "Usually no. Length of credit history is 15% of your score, and closing your oldest card shortens it and lowers your total available credit (raising utilization). Keep old no-fee cards open and use them occasionally." },
  { q: "Do paid collections still hurt me?", a: "On older scoring models, yes — but newer models (FICO 9, VantageScore 3.0+) ignore paid collections. The best outcome is deletion: negotiate 'pay-for-delete' in writing before paying, or send a goodwill letter if it's already paid." },
  { q: "How long do negatives stay on my report?", a: "Most negatives — late payments, collections, charge-offs — fall off 7 years after the original delinquency date. Hard inquiries stop affecting your score after 12 months and drop off entirely after 2 years. Anything past these dates should be disputed for removal." },
  { q: "How do I keep good credit once I've built it?", a: "Autopay everything (payment history is 35%), keep utilization low, don't close old accounts, and only apply for new credit when you need it. Re-check your report a few times a year for errors." },
];
export function Education() {
  const [open, setOpen] = useState(0);
  return (
    <div>
      <SectionTitle kicker="Learn" title="Credit, explained simply" sub="The core ideas behind everything in this tool — so you can keep good credit, not just build it." />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {LESSONS.map((l, i) => (
          <Card key={i} style={{ padding: 0, overflow: "hidden" }}>
            <button onClick={() => setOpen(open === i ? -1 : i)} style={{ width: "100%", textAlign: "left", padding: "1rem 1.25rem", background: "transparent", border: "none", color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <span>{l.q}</span>
              <span style={{ color: ACCENT, transform: open === i ? "rotate(45deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>+</span>
            </button>
            {open === i && <div style={{ padding: "0 1.25rem 1.1rem", color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", lineHeight: 1.65 }}>{l.a}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------
export function Progress({ history }) {
  const data = history || [];
  return (
    <div>
      <SectionTitle kicker="Track" title="Your progress" sub="Re-upload a fresh report each month to watch your score and utilization trend. Snapshots are stored only on this device." />
      {data.length < 2 ? (
        <Card style={{ padding: "1.5rem", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
          {data.length === 0 ? "No snapshots yet." : "One snapshot saved. Re-upload a report in ~30 days to see your trend."}
        </Card>
      ) : (
        <Card style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height: 140, marginBottom: "1rem" }}>
            {data.map((d, i) => {
              const h = ((d.score - 300) / 550) * 100;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "0.7rem", color: scoreColor(d.score), fontFamily: MONO }}>{d.score}</span>
                  <div style={{ width: "100%", maxWidth: 40, height: `${h}%`, background: scoreColor(d.score), borderRadius: "3px 3px 0 0", opacity: 0.85 }} />
                  <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.3)" }}>{new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", borderTop: `1px solid ${BORDER}`, paddingTop: "1rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
            <span>Latest util: <strong style={{ color: "#fff" }}>{data[data.length - 1].utilization}%</strong></span>
            <span>Negatives: <strong style={{ color: "#fff" }}>{data[data.length - 1].negatives}</strong></span>
            <span>Change: <strong style={{ color: scoreColor(data[data.length - 1].score) }}>{data[data.length - 1].score - data[0].score >= 0 ? "+" : ""}{data[data.length - 1].score - data[0].score} pts</strong></span>
          </div>
        </Card>
      )}
    </div>
  );
}
