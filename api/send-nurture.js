// /api/send-nurture.js
// Daily cron: walks MortgageLeads, sends the next due email via Resend,
// updates Last_email_sent. Reads secrets from environment variables.
//
// Sequence days: 0, 1, 3, 5, 7, 14
// Last_email_sent stores the day-number of the most recent email sent (starts at 0... see note)

const SUPABASE_URL = "https://kdpcfyugwzeaqudpatrs.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // service role or anon key
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Dom Maier <dom@dommaierfinance.com>";
const REPLY_TO = "dom@dommaierfinance.com";
const SHOP_URL = "https://dommaierfinance.com/shop"; // update to live links when ready

// --- The sequence. step = which email; day = days after Created_at it should send ---
const SEQUENCE = [
  { step: 1, day: 0,  subject: "Here's where you stand 👇",                  body: email1 },
  { step: 2, day: 1,  subject: "What's really behind a mortgage approval",    body: email2 },
  { step: 3, day: 3,  subject: "Most people have never heard of this — and it matters", body: email3 },
  { step: 4, day: 5,  subject: "How to actually understand your own report",  body: email4 },
  { step: 5, day: 7,  subject: "She thought she was years away. She wasn't.", body: email5 },
  { step: 6, day: 14, subject: "Last note from me (for now)",                 body: email6 },
];

export default async function handler(req, res) {
  // Protect the endpoint: require the Vercel cron secret
  const auth = req.headers["authorization"];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Pull all leads not yet finished with the sequence
    const leadsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/MortgageLeads?Sequence_complete=eq.false&select=*`,
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
      const lastStep = lead.Last_email_sent || 0; // highest step number already sent

      // Find the next email that's due: next step in sequence whose day <= daysSince
      const nextEmail = SEQUENCE.find(
        (e) => e.step > lastStep && e.day <= daysSince
      );

      if (!nextEmail) continue; // nothing due for this lead today

      // Send via Resend
      const firstName = (lead.Name || "there").split(" ")[0];
      const html = nextEmail.body(firstName, SHOP_URL);

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
        continue; // don't advance the counter if send failed — retry tomorrow
      }

      // Advance the counter; mark complete if that was the last email
      const isLast = nextEmail.step === SEQUENCE[SEQUENCE.length - 1].step;
      await fetch(`${SUPABASE_URL}/rest/v1/MortgageLeads?id=eq.${lead.id}`, {
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

function email1(name, shop) {
  return wrap(`<p>Hi ${name},</p>
  <p>Thanks for taking the Mortgage Readiness Score — you just did something most people skip entirely. They walk into a lender cold and find out the hard way that their credit wasn't ready.</p>
  <p>You took the smarter route. You checked first.</p>
  <p>Your score tells you one thing clearly: where you stand right now, and which areas are worth your attention before you ever fill out a mortgage application. Whether you landed high or low, that's not a verdict — it's a starting line.</p>
  <p>Over the next couple of weeks I'm going to walk you through how mortgage readiness actually works — what lenders look at, what moves the needle, and what's just noise. No jargon, no pressure.</p>
  <p>If you have a question about your result, just hit reply. This goes straight to my inbox and I read every one.</p>${signoff()}`);
}
function email2(name, shop) {
  return wrap(`<p>Hi ${name},</p>
  <p>When people imagine getting approved for a mortgage, they usually fixate on one number: their credit score. It matters — but it's one of five things a lender weighs.</p>
  <p><b>1. Credit history</b> — how long and how consistently you've managed credit.<br>
  <b>2. Income stability</b> — that what comes in is steady and documentable.<br>
  <b>3. Debt-to-income ratio</b> — how much of your monthly income is already spoken for.<br>
  <b>4. Down payment &amp; savings</b> — how much you can put down, plus a cushion.<br>
  <b>5. Employment record</b> — a stable work history reassures a lender.</p>
  <p>Four of the five have nothing to do with your credit score directly. That's the part most people miss — you have more levers to pull than you think.</p>
  <p>Tomorrow I'll go deeper on the one that trips up the most people: debt-to-income. Questions? Just reply.</p>${signoff()}`);
}
function email3(name, shop) {
  return wrap(`<p>Hi ${name},</p>
  <p>Let's talk about the metric that surprises people the most: your debt-to-income ratio, or DTI.</p>
  <p>It's simple math. Add up your monthly debt payments and divide by your gross monthly income. Lenders care about it a lot — someone with a great credit score can still get held up here if too much of their income is already committed.</p>
  <p>The encouraging part: DTI is one of the most controllable factors on the list. Every balance you pay down moves it in the right direction.</p>
  <p>That's exactly why I built the <b>Debt Payoff Planner</b> and the <b>Debt Payoff Simulator</b> — to help you see your balances clearly and choose a strategy that fits your budget. They're education tools, not magic, but seeing it laid out changes how people approach it.</p>
  <p>Take a look here whenever you're ready: <a href="${shop}" style="color:#9a7d2c;">${shop.replace('https://','')}</a></p>
  <p>No pressure either way. Reply if you want me to point you toward the right starting place.</p>${signoff()}`);
}
function email4(name, shop) {
  return wrap(`<p>Hi ${name},</p>
  <p>Most people have never read their own credit report line by line. It looks intimidating, so they glance at the score and close the tab.</p>
  <p>That's a missed opportunity, because the report is where the story actually lives. A few things worth knowing:</p>
  <p>• Your payment history carries the most weight of any single factor.<br>
  • Credit utilization moves faster than almost anything else.<br>
  • Errors and outdated information happen more often than people realize, and you have rights under federal law to request corrections.</p>
  <p>If you want a plain-language walkthrough, my <b>Credit Education Toolkit</b> breaks down how reports work, what your rights are, and how the system handles errors — written for normal people, not finance majors.</p>
  <p>It lives here whenever you're ready: <a href="${shop}" style="color:#9a7d2c;">${shop.replace('https://','')}</a></p>
  <p>And as always — reply with questions. I'd rather you understand this than buy anything.</p>${signoff()}`);
}
function email5(name, shop) {
  return wrap(`<p>Hi ${name},</p>
  <p>I want to share the kind of turnaround I see more often than people expect.</p>
  <p>Someone takes the readiness score, lands lower than they hoped, and assumes home ownership is years off. Then they actually look at the pieces — utilization, a couple of small balances, an error they'd never noticed — and realize the gap is smaller than the anxiety made it feel.</p>
  <p>That's the pattern. The distance is almost always shorter than the fear. What's usually missing isn't years of effort — it's a clear picture and a plan.</p>
  <p>That's the whole reason these tools exist: the <b>Debt Payoff Planner</b> to map your balances, the <b>Credit Education Toolkit</b> to understand your report, and the <b>Get Mortgage Ready</b> guide to tie it into a 90-day plan.</p>
  <p>See them all here: <a href="${shop}" style="color:#9a7d2c;">${shop.replace('https://','')}</a></p>
  <p>If you tell me your readiness score by reply, I'll tell you which one I'd start with if I were in your shoes. No charge for that — just reply.</p>${signoff()}`);
}
function email6(name, shop) {
  return wrap(`<p>Hi ${name},</p>
  <p>This is the last email in this series, so I'll keep it straight.</p>
  <p>Over the past two weeks I've walked you through what lenders look at, how debt-to-income works, how to read your own credit report, and why the gap to mortgage readiness is usually smaller than it feels.</p>
  <p>If you're ready for a concrete next step:</p>
  <p>• Understand your credit report and your rights → <b>Credit Education Toolkit</b><br>
  • Bring down debt and improve your DTI → <b>Debt Payoff Planner</b> &amp; <b>Debt Payoff Simulator</b><br>
  • Buying in the next 3–12 months → <b>Get Mortgage Ready</b></p>
  <p>Everything's in one place: <a href="${shop}" style="color:#9a7d2c;">${shop.replace('https://','')}</a></p>
  <p>And if you're not ready to buy anything, that's completely fine. Keep using the score, keep learning, and reply whenever you have a question. When you're ready to talk through your situation, just reply and we'll set up a conversation.</p>
  <p>Proud of you for taking this seriously. That alone puts you ahead.</p>${signoff()}`);
}
