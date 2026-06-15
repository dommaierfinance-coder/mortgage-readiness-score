// ---------------------------------------------------------------------------
// Credit analysis engine — pure, deterministic functions.
//
// Extraction (reading the PDF) is done by Claude server-side; everything in this
// file runs in the browser on the structured data Claude returns. Keeping the
// math here (rather than asking the model for recommendations) makes the advice
// precise, repeatable, and auditable.
//
// The score model is an internally-consistent HEURISTIC, not the real FICO
// algorithm. Its job is to rank actions correctly (which paydown helps most) and
// to drive the what-if simulator with believable deltas — not to predict a
// bureau score to the point. When the report includes a real score we anchor to
// it and apply our model only for relative changes.
// ---------------------------------------------------------------------------

export const REVOLVING = new Set(["revolving", "credit_card", "card", "charge"]);

const num = (x) => {
  const n = typeof x === "string" ? Number(x.replace(/[^0-9.\-]/g, "")) : Number(x);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Utilization thresholds that move scores, from worst to best. The optimizer
// walks a card down these one level at a time.
export const UTIL_STEPS = [0.9, 0.5, 0.3, 0.1, 0];

export const UTIL_LABEL = {
  0.9: "under 90%",
  0.5: "under 50%",
  0.3: "under 30%",
  0.1: "under 10%",
  0: "paid to $0",
};

// ---------------------------------------------------------------------------
// Account helpers
// ---------------------------------------------------------------------------

export function revolvingCards(report) {
  return (report.accounts || [])
    .filter((a) => REVOLVING.has(a.type) && a.status !== "closed")
    .map((a, i) => ({
      id: a.id || `card-${i}`,
      creditor: a.creditor || "Credit card",
      balance: num(a.balance),
      limit: num(a.creditLimit) || num(a.highBalance) || 0,
    }))
    .filter((c) => c.limit > 0);
}

// Per-card and aggregate utilization. `overrides` maps card id -> new balance,
// used by the simulator and the paydown optimizer to model "what if I pay this".
export function utilization(report, overrides = {}) {
  const cards = revolvingCards(report).map((c) => {
    const balance = overrides[c.id] != null ? overrides[c.id] : c.balance;
    return { ...c, balance, util: c.limit > 0 ? balance / c.limit : 0 };
  });
  const totalBalance = cards.reduce((s, c) => s + c.balance, 0);
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0);
  const aggregate = totalLimit > 0 ? totalBalance / totalLimit : 0;
  const maxCard = cards.reduce((m, c) => Math.max(m, c.util), 0);
  return { cards, totalBalance, totalLimit, aggregate, maxCard };
}

// ---------------------------------------------------------------------------
// Negative items
// ---------------------------------------------------------------------------

function addYears(dateStr, years) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  d.setFullYear(d.getFullYear() + years);
  return d;
}

const fmtDate = (d) =>
  d ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—";

// Builds the negatives & dispute audit: collections, charge-offs, late payments,
// public records — each with a recommended action, a 7-year fall-off date, and a
// dispute flag when an item is already past the date it legally should drop off.
export function negativesAudit(report) {
  const now = new Date();
  const items = [];

  for (const c of report.collections || []) {
    const dofd = c.dateFirstDelinquency || c.dateOpened || c.dateReported;
    const falloff = dofd ? addYears(dofd, 7) : null;
    const aged = falloff && falloff < now;
    items.push({
      kind: "Collection",
      creditor: c.agency || c.originalCreditor || "Collection account",
      detail: c.originalCreditor ? `Originally ${c.originalCreditor}` : "",
      balance: num(c.balance),
      severity: aged ? "dispute" : c.status === "paid" ? "medium" : "high",
      falloff: fmtDate(falloff),
      aged,
      action: aged
        ? "Past the 7-year reporting limit — dispute for removal with all three bureaus."
        : c.status === "paid"
        ? "Already paid. Send a goodwill deletion request asking the bureau to remove it."
        : "Negotiate a 'pay-for-delete' in writing before paying, or dispute if the debt isn't yours.",
    });
  }

  for (const a of report.accounts || []) {
    if (a.worstStatus === "chargeoff") {
      const dofd = a.dateFirstDelinquency || a.opened;
      const falloff = dofd ? addYears(dofd, 7) : null;
      const aged = falloff && falloff < now;
      items.push({
        kind: "Charge-off",
        creditor: a.creditor || "Account",
        detail: "Account charged off by the lender",
        balance: num(a.balance) || num(a.pastDue),
        severity: aged ? "dispute" : "high",
        falloff: fmtDate(falloff),
        aged,
        action: aged
          ? "Past the 7-year limit — dispute for removal."
          : "Request a pay-for-delete or settlement-for-deletion in writing.",
      });
    }
    const lates = num(a.late90) + num(a.late60) + num(a.late30);
    if (lates > 0 && a.worstStatus !== "chargeoff") {
      items.push({
        kind: "Late payments",
        creditor: a.creditor || "Account",
        detail: `${num(a.late30)}× 30-day · ${num(a.late60)}× 60-day · ${num(a.late90)}× 90-day`,
        balance: 0,
        severity: num(a.late90) > 0 ? "high" : "medium",
        falloff: "—",
        aged: false,
        action:
          "Send a goodwill letter asking the creditor to remove the late marks — most effective when the account is now current and otherwise in good standing.",
      });
    }
  }

  for (const p of report.publicRecords || []) {
    const falloff = p.dateFiled ? addYears(p.dateFiled, 7) : null;
    items.push({
      kind: "Public record",
      creditor: p.type || "Public record",
      detail: p.status || "",
      balance: num(p.amount),
      severity: "high",
      falloff: fmtDate(falloff),
      aged: falloff && falloff < now,
      action: "Verify accuracy — public records are frequently misreported. Dispute any errors.",
    });
  }

  const order = { dispute: 0, high: 1, medium: 2 };
  items.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  return items;
}

// ---------------------------------------------------------------------------
// Hard inquiries
// ---------------------------------------------------------------------------

export function inquiriesAudit(report) {
  const now = new Date();
  const recent = (report.inquiries || []).map((q) => {
    const d = q.date ? new Date(q.date) : null;
    const monthsAgo = d ? (now - d) / (1000 * 60 * 60 * 24 * 30.44) : null;
    return {
      creditor: q.creditor || "Inquiry",
      date: fmtDate(d),
      monthsAgo: monthsAgo != null ? Math.round(monthsAgo) : null,
      falloff: d ? fmtDate(addYears(q.date, 2)) : "—",
      scored: monthsAgo != null && monthsAgo <= 12, // only ~12 months affect score
    };
  });
  return { all: recent, scoredCount: recent.filter((q) => q.scored).length };
}

// ---------------------------------------------------------------------------
// Account age & mix
// ---------------------------------------------------------------------------

export function ageAndMix(report) {
  const now = new Date();
  const ages = (report.accounts || [])
    .map((a) => (a.opened ? (now - new Date(a.opened)) / (1000 * 60 * 60 * 24 * 365.25) : null))
    .filter((y) => y != null && y >= 0);
  const avg = ages.length ? ages.reduce((s, y) => s + y, 0) / ages.length : 0;
  const oldest = ages.length ? Math.max(...ages) : 0;

  const types = new Set((report.accounts || []).map((a) => a.type));
  const hasRevolving = [...types].some((t) => REVOLVING.has(t));
  const hasInstallment = [...types].some(
    (t) => !REVOLVING.has(t) && t && t !== "other"
  );
  return { avgYears: avg, oldestYears: oldest, hasRevolving, hasInstallment, typeCount: types.size };
}

// ---------------------------------------------------------------------------
// Score model — 5 FICO factors mapped to 300–850
// ---------------------------------------------------------------------------

// Smooth, monotonic utilization curve in [0,1]. Continuous (no flat bands) so
// every dollar of paydown produces a measurable, correctly-ranked impact —
// steeper near the bottom because going 30%→10%→0% is worth more than 90%→80%.
function utilSubScore(u) {
  if (u <= 0) return 1;
  const x = Math.min(u, 1);
  return Math.max(0, 1 - Math.sqrt(x) * 0.95);
}

// Equal-weight average of per-card utilization health. Equal (not limit-)
// weighting mirrors how scoring treats each card's utilization fairly
// independently, and keeps the optimizer focused on the most over-extended
// cards first (a maxed card hurts regardless of its limit). The dollar-weighted
// view is already captured by the aggregate term.
function perCardUtilScore(cards) {
  if (!cards.length) return 0.7;
  return cards.reduce((s, c) => s + utilSubScore(c.util), 0) / cards.length;
}

// Returns each factor's "health" in [0,1] plus a weighted 300–850 estimate.
export function scoreFactors(report, overrides = {}) {
  const u = utilization(report, overrides);
  const neg = report; // raw, for payment history

  // Payment history (35%)
  let pay = 1.0;
  for (const c of neg.collections || []) pay -= c.status === "paid" ? 0.12 : 0.25;
  for (const a of neg.accounts || []) {
    if (a.worstStatus === "chargeoff") pay -= 0.25;
    pay -= num(a.late90) * 0.15;
    pay -= num(a.late60) * 0.1;
    pay -= num(a.late30) * 0.06;
  }
  for (const p of neg.publicRecords || []) pay -= 0.3;
  pay = clamp(pay, 0, 1);

  // Utilization (30%) — blends overall utilization with the per-card picture.
  const util =
    u.totalLimit > 0 ? 0.5 * utilSubScore(u.aggregate) + 0.5 * perCardUtilScore(u.cards) : 0.7;

  // Length of history (15%)
  const { avgYears, hasRevolving, hasInstallment, typeCount } = ageAndMix(report);
  let age;
  if (avgYears >= 9) age = 1.0;
  else if (avgYears >= 7) age = 0.85;
  else if (avgYears >= 4) age = 0.7;
  else if (avgYears >= 2) age = 0.5;
  else age = 0.3;

  // Credit mix (10%)
  const mix = hasRevolving && hasInstallment ? 1.0 : typeCount >= 1 ? 0.6 : 0.4;

  // New credit / inquiries (10%)
  const scored = inquiriesAudit(report).scoredCount;
  const inquiry = scored === 0 ? 1 : scored === 1 ? 0.95 : scored === 2 ? 0.85 : scored === 3 ? 0.7 : scored === 4 ? 0.55 : 0.4;

  const composite =
    0.35 * pay + 0.3 * util + 0.15 * age + 0.1 * mix + 0.1 * inquiry;
  const estimate = Math.round(300 + 550 * composite);

  return {
    estimate: clamp(estimate, 300, 850),
    factors: {
      payment: { weight: 0.35, health: pay, label: "Payment History" },
      utilization: { weight: 0.3, health: util, label: "Credit Utilization" },
      age: { weight: 0.15, health: age, label: "Length of History" },
      mix: { weight: 0.1, health: mix, label: "Credit Mix" },
      inquiry: { weight: 0.1, health: inquiry, label: "New Credit / Inquiries" },
    },
  };
}

const baseEstimate = (report, overrides) => scoreFactors(report, overrides).estimate;

// Anchor model deltas to the bureau's real score when we have one, so the
// numbers the user sees track their actual starting point.
export function anchoredScore(report, overrides = {}) {
  const provided = num(report.providedScore);
  const est = baseEstimate(report, overrides);
  if (provided >= 300 && provided <= 850) {
    const base = baseEstimate(report, {});
    return clamp(Math.round(provided + (est - base)), 300, 850);
  }
  return est;
}

// ---------------------------------------------------------------------------
// Fastest-paydown optimizer
// ---------------------------------------------------------------------------

function nextThresholdBelow(util) {
  for (const t of UTIL_STEPS) if (t < util - 1e-9) return t;
  return null;
}

// Builds the fastest-paydown plan in two phases:
//   1. Greedy allocation — repeatedly fund the threshold-crossing (across all
//      cards) with the best score-gain-per-dollar until budget runs out (or,
//      with no budget, until every card hits $0). This decides how much each
//      card should ultimately be paid.
//   2. Consolidate — collapse to ONE step per card, ordered by the priority in
//      which the greedy phase first funded it, with the cumulative score after
//      each card. Clean for the user, faithful to the optimization.
export function paydownPlan(report, budget) {
  const cards = revolvingCards(report).filter((c) => c.balance > 0);
  const startScore = anchoredScore(report, {});
  if (!cards.length) return { steps: [], startScore, endScore: startScore, totalCost: 0, budget };

  const base = Object.fromEntries(cards.map((c) => [c.id, c.balance]));
  const limit = Object.fromEntries(cards.map((c) => [c.id, c.limit]));
  const name = Object.fromEntries(cards.map((c) => [c.id, c.creditor]));
  const sim = { ...base };
  let remaining = budget == null ? Infinity : Math.max(0, budget);
  let running = startScore;
  const order = [];

  while (remaining > 0) {
    let best = null;
    for (const id in sim) {
      const bal = sim[id];
      if (bal <= 0 || limit[id] <= 0) continue;
      const util = bal / limit[id];
      // Consider every threshold below the current utilization (down to $0), not
      // just the next one — otherwise a maxed card's tiny first step looks weak
      // and the optimizer keeps deferring the paydown that matters most.
      for (const t of UTIL_STEPS) {
        if (t >= util - 1e-9) continue;
        const targetBal = Math.max(0, Math.round(t * limit[id]));
        const amount = bal - targetBal;
        if (amount <= 0) continue;
        const impact = anchoredScore(report, { ...sim, [id]: targetBal }) - running;
        const perDollar = impact / Math.max(amount, 1);
        if (!best || perDollar > best.perDollar + 1e-9 || (Math.abs(perDollar - best.perDollar) < 1e-9 && impact > best.impact)) {
          best = { id, amount, targetBal, perDollar, impact };
        }
      }
    }
    if (!best) break;
    const pay = Math.min(best.amount, remaining);
    if (pay <= 0) break;
    if (!order.includes(best.id)) order.push(best.id);
    sim[best.id] -= pay;
    running = anchoredScore(report, sim);
    remaining -= pay;
  }

  // Consolidate: apply each touched card, in priority order, to its final balance.
  const cur = { ...base };
  let runEach = startScore;
  const steps = [];
  for (const id of order) {
    const before = runEach;
    cur[id] = sim[id];
    runEach = anchoredScore(report, cur);
    steps.push({
      creditor: name[id],
      amount: base[id] - sim[id],
      fromUtil: base[id] / limit[id],
      toUtil: sim[id] / limit[id],
      paidOff: sim[id] <= 0,
      impact: Math.max(0, runEach - before),
      runningScore: runEach,
    });
  }

  const totalCost = steps.reduce((s, st) => s + st.amount, 0);
  return { steps, startScore, endScore: runEach, totalCost, budget };
}

// ---------------------------------------------------------------------------
// Action roadmap — prioritized, grouped by timeframe
// ---------------------------------------------------------------------------

export function roadmap(report) {
  const u = utilization(report);
  const negs = negativesAudit(report);
  const { avgYears, hasInstallment, hasRevolving } = ageAndMix(report);
  const inq = inquiriesAudit(report);

  const now = [];
  const soon = [];
  const ongoing = [];

  // Disputes are the fastest, lowest-effort wins.
  const disputable = negs.filter((n) => n.aged);
  if (disputable.length)
    now.push(`Dispute ${disputable.length} item(s) that are past the 7-year reporting limit — these should already be gone.`);

  if (u.maxCard > 0.3) {
    const overCards = u.cards.filter((c) => c.util > 0.3).length;
    now.push(`Pay down ${overCards} card(s) over 30% utilization — start with the paydown plan, which targets the fastest score gains first.`);
  }

  const recentLates = (report.accounts || []).some((a) => num(a.late30) + num(a.late60) + num(a.late90) > 0);
  if (recentLates) now.push("Set every account to autopay so you never add another late payment — payment history is 35% of your score.");

  const unpaidColl = negs.filter((n) => n.kind === "Collection" && n.severity === "high");
  if (unpaidColl.length)
    soon.push(`Negotiate pay-for-delete on ${unpaidColl.length} open collection(s) — get the deletion agreement in writing before you pay.`);

  if (u.aggregate > 0.1 && u.aggregate <= 0.3)
    soon.push("Push overall utilization under 10% — the last few points before applying for a mortgage are worth real score points.");

  if (!hasInstallment && hasRevolving)
    soon.push("Consider a small credit-builder loan to add an installment account — credit mix is 10% of your score.");

  ongoing.push("Keep your oldest accounts open and active — closing them shortens your credit history.");
  if (inq.scoredCount >= 2) ongoing.push("Avoid new credit applications for now — recent inquiries are still weighing on your score.");
  ongoing.push("Re-pull and re-upload your report in 30–45 days to track progress and confirm changes posted.");

  if (!now.length) now.push("No urgent red flags — keep balances low and payments on time.");
  return { now, soon, ongoing };
}

// ---------------------------------------------------------------------------
// One call to assemble everything the dashboard needs.
// ---------------------------------------------------------------------------

export function analyze(report) {
  const sf = scoreFactors(report);
  return {
    score: anchoredScore(report),
    estimatedScore: sf.estimate,
    providedScore: num(report.providedScore) || null,
    factors: sf.factors,
    utilization: utilization(report),
    negatives: negativesAudit(report),
    inquiries: inquiriesAudit(report),
    ageMix: ageAndMix(report),
    roadmap: roadmap(report),
  };
}
