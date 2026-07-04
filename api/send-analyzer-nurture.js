// /api/send-analyzer-nurture.js
// Daily cron: walks AnalyzerLeads, sends the next due email via Resend,
// updates Last_email_sent. Mirrors send-nurture.js exactly, pointed at the
// AnalyzerLeads table with the Credit Report Analyzer sales sequence.
//
// Sequence days: 0, 1, 2, 3, 4, 5  (tighter than the mortgage nurture — this is a
// sales sequence with an expiring discount, so momentum matters)

const SUPABASE_URL = "https://kdpcfyugwzeaqudpatrs.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Dom Maier <dom@dommaierfinance.com>";
const REPLY_TO = "dom@dommaierfinance.com";

// Live links
const DEMO_URL = "https://youtu.be/uiQDMFExyxo";
const ANALYZER_URL = "https://analyzer.dommaierfinance.com";
const GUMROAD_URL = "https://financier54.gumroad.com/l/dmhdih"; // Credit Report Analyzer
const DISCOUNT_CODE = "T2CAL0X";

// --- The sequence. step = which email; day = days after Created_at it should send ---
const SEQUENCE = [
  { step: 1, day: 0, subject: "Here's your Credit Report Analyzer demo 🎥",        body: email1 },
  { step: 2, day: 1, subject: "Most people have no idea what's on their credit report", body: email2 },
  { step: 3, day: 2, subject: "The #1 factor that moves your score",                body: email3 },
  { step: 4, day: 3, subject: "Why your credit card balances matter more than you think", body: email4 },
  { step: 5, day: 4, subject: "Everything you get with the Analyzer",               body: email5 },
  { step: 6, day: 5, subject: "Last day for 20% off ⏳",                            body: email6 },
];

export default async function handler(req, res) {
  const auth = req.headers["authorization"];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const leadsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/AnalyzerLeads?Sequence_complete=eq.false&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const leads = await leadsRes.json();
    if (!Array.isArray(leads)) {
      return res.status(500).json({ error: "Bad Supabase response", detail: leads });
    }

    const now = new Date();
    const results = [];

    for (const lead of leads) {
      if (!lead.Email || !lead.Created_at) continue;

      const created = new Date(lead.Created_at);
      const daysSince = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      const lastStep = lead.Last_email_sent || 0;

      const nextEmail = SEQUENCE.find(
        (e) => e.step > lastStep && e.day <= daysSince
      );

      if (!nextEmail) continue;

      const firstName = (lead.Name || "there").split(" ")[0];
      const html = nextEmail.body(firstName);

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [lead.Email],
          reply_to: REPLY_TO,
          subject: nextEmail.subject,
          html,
        }),
      });

      if (!sendRes.ok) {
        const err = await sendRes.text();
        results.push({ email: lead.Email, step: nextEmail.step, ok: false, err });
        continue;
      }

      const isLast = nextEmail.step === SEQUENCE[SEQUENCE.length - 1].step;
      await fetch(`${SUPABASE_URL}/rest/v1/AnalyzerLeads?id=eq.${lead.id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          Last_email_sent: nextEmail.step,
          Sequence_complete: isLast,
        }),
      });

      results.push({ email: lead.Email, step: nextEmail.step, ok: true });
    }

    return res.status(200).json({ processed: results.length, results });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ---------- Email bodies (compliant copy, brand-styled) ----------
function wrap(inner) {
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2a2620;font-size:15px;line-height:1.6;">
  <div style="text-align:center;padding:18px 0;border-bottom:1px solid #e5dfd2;">
    <span style="font-family:Georgia,serif;font-size:22px;color:#c9a84c;font-style:italic;">Dom Maier Finance</span>
  </div>
  <div style="padding:22px 4px;">${inner}</div>
  <div style="border-top:1px solid #e5dfd2;padding:14px 4px;font-size:11px;color:#8a8170;text-align:center;">
    Dom Maier Finance · dommaierfinance.com · Financial education and coaching.<br>
    This material is for educational purposes only and is not credit repair, debt settlement, legal, or financial advice.<br>
    <a href="{{unsubscribe}}" style="color:#8a8170;">Unsubscribe</a>
  </div>
</div>`;
}
function signoff() {
  return `<p style="margin-top:18px;font-style:italic;">— Dom<br>Dom Maier Finance</p>`;
}
function btn(label, url) {
  return `<p style="text-align:center;margin:24px 0;">
    <a href="${url}" style="background:#c9a84c;color:#1a1a1a;font-weight:bold;text-decoration:none;padding:13px 26px;border-radius:6px;display:inline-block;">${label}</a>
  </p>`;
}
// Discount CTA reused across every email
function offerBlock() {
  return `${btn(`Get the Credit Report Analyzer — $16 →`, GUMROAD_URL)}
  <p style="text-align:center;color:#8a8170;font-size:13px;margin-top:-10px;">Use code <b>${DISCOUNT_CODE}</b> at checkout for 20% off</p>`;
}

function email1(name) {
  return wrap(`<p>Hey ${name},</p>
  <p>Thanks for requesting the demo — here it is.</p>
  ${btn("▶️ Watch the 2-minute walkthrough", DEMO_URL)}
  <p>In it, I show you exactly how the Credit Report Analyzer breaks down your credit report into plain English — what's helping your score, what's holding it back, and where to focus first. No jargon, no guesswork.</p>
  <p>Give it a watch, and if you've got questions, just hit reply. I read every one.</p>
  ${offerBlock()}${signoff()}`);
}
function email2(name) {
  return wrap(`<p>Hey ${name},</p>
  <p>Here's something I've seen over and over in 13 years around credit and lending:</p>
  <p>Most people have <i>never actually read</i> their own credit report. Not because they don't care — because it's written to be confusing. Pages of codes, cryptic account statuses, numbers that decide whether they get approved or turned away.</p>
  <p>That's the whole reason I built the Credit Report Analyzer. You upload your report, and it translates the entire thing into language that actually makes sense — your five score factors, what each one means, and which ones are dragging you down.</p>
  <p>If you missed the demo yesterday, here it is again:</p>
  ${btn("▶️ Watch the demo", DEMO_URL)}
  ${offerBlock()}${signoff()}`);
}
function email3(name) {
  return wrap(`<p>Hey ${name},</p>
  <p>Quick credit education tip that a lot of people get wrong:</p>
  <p><b>Payment history is the single biggest factor in your score — about 35% of it.</b> More than your balances, more than the length of your history, more than anything else.</p>
  <p>That's why one missed payment can hurt more than people expect, and why consistent on-time payments are one of the most widely cited habits for building credit over time. A lot of folks set up autopay for at least the minimums just to protect that history.</p>
  <p>The Analyzer shows you exactly how your payment history is scoring right now — and breaks down the other four factors too, so you can see the full picture instead of guessing.</p>
  ${offerBlock()}${signoff()}`);
}
function email4(name) {
  return wrap(`<p>Hey ${name},</p>
  <p>Another one worth understanding: <b>credit utilization</b> — how much of your available credit you're using — is about 30% of your score.</p>
  <p>Here's the part most people miss: it's not just your <i>total</i> utilization that matters, it's each card individually. One maxed-out card can weigh on your score even if your others have plenty of room. Many people aim to keep balances well under 30% of each card's limit as a general reference point.</p>
  <p>The Analyzer's paydown tool actually shows you <i>which card to pay down first</i> for the biggest impact — using whatever amount you've got to work with. It takes the guesswork out completely.</p>
  ${offerBlock()}${signoff()}`);
}
function email5(name) {
  return wrap(`<p>Hey ${name},</p>
  <p>I've shared a few credit education tips this week — payment history, utilization, where to focus. Here's what you get when you run your <i>own</i> report through the full Analyzer:</p>
  <p>✅ Your 5-factor score breakdown in plain English<br>
  ✅ A paydown plan showing which balances to tackle first<br>
  ✅ A what-if simulator to test moves before you make them<br>
  ✅ An AI coach that's read your report and answers your questions<br>
  ✅ A negatives breakdown showing what's on there and when it typically ages off<br>
  ✅ Progress tracking so you can watch your numbers over time</p>
  <p>All of it, right now, for <b>$16</b> with code <b>${DISCOUNT_CODE}</b> (normally $20):</p>
  ${offerBlock()}
  <p>This is the clearest picture of your credit you'll get without paying for a full report or a consultant.</p>${signoff()}`);
}
function email6(name) {
  return wrap(`<p>Hey ${name},</p>
  <p>Quick heads up — the <b>${DISCOUNT_CODE}</b> discount comes down after today.</p>
  <p>After that, the Credit Report Analyzer goes back to full price. If you've been thinking about finally seeing what's actually on your credit report — and what to do about it — this is the moment to grab it while it's <b>$16 instead of $20</b>.</p>
  ${btn("Get the Analyzer for $16 →", GUMROAD_URL)}
  <p style="text-align:center;color:#8a8170;font-size:13px;margin-top:-10px;">Use code <b>${DISCOUNT_CODE}</b> — expires tonight</p>
  <p>Whatever you decide, I'm glad you've been following along this week. Understanding your credit is the first real step toward being mortgage-ready — and you're already ahead of most people just for paying attention to it.</p>${signoff()}`);
}
