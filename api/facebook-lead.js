// /api/facebook-lead.js
// Receives Facebook Lead Ads webhooks, fetches lead details from Meta,
// inserts them into MortgageLeads, AND sends the Day 0 welcome email instantly.
//
// Env vars required:
//   META_VERIFY_TOKEN    - shared secret for the webhook handshake
//   META_PAGE_TOKEN      - permanent Page Access Token to fetch lead details
//   SUPABASE_SERVICE_KEY - Supabase secret key
//   RESEND_API_KEY       - Resend key for sending the welcome email

const SUPABASE_URL = "https://kdpcfyugwzeaqudpatrs.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const META_PAGE_TOKEN = process.env.META_PAGE_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Dom Maier <dom@dommaierfinance.com>";
const REPLY_TO = "dom@dommaierfinance.com";

export default async function handler(req, res) {
  // ---- 1. Verification handshake (Meta calls this once with GET) ----
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "Verification failed" });
  }

  // ---- 2. Incoming lead notification (Meta calls this with POST) ----
  if (req.method === "POST") {
    try {
      const body = req.body;
      const entries = body?.entry || [];
      const results = [];

      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          if (change.field !== "leadgen") continue;
          const leadgenId = change?.value?.leadgen_id;
          if (!leadgenId) continue;

          // Fetch the lead's field data from the Graph API
          const leadRes = await fetch(
            `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${META_PAGE_TOKEN}`
          );
          const leadData = await leadRes.json();

          if (!leadData || !leadData.field_data) {
            results.push({ leadgenId, ok: false, err: "no field_data", detail: leadData });
            continue;
          }

          // Parse field_data into name / email / phone
          let name = "", email = "", phone = "";
          for (const f of leadData.field_data) {
            const val = (f.values && f.values[0]) || "";
            const key = (f.name || "").toLowerCase();
            if (key.includes("email")) email = val;
            else if (key.includes("phone")) phone = val;
            else if (key.includes("name")) name = name ? name + " " + val : val;
          }

          if (!email) {
            results.push({ leadgenId, ok: false, err: "no email in lead" });
            continue;
          }

          // Insert into MortgageLeads with Last_email_sent = 1 (Day 0 sent immediately below)
          const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/MortgageLeads`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              Name: name || "there",
              Email: email,
              Phone: phone || "",
              Source: "facebook",
              Last_email_sent: 1, // Day 0 goes out instantly below; cron picks up from #2
            }),
          });

          if (!insertRes.ok) {
            const err = await insertRes.text();
            results.push({ leadgenId, email, ok: false, err: "insert failed: " + err });
            continue;
          }

          // Send the Day 0 welcome email instantly via Resend
          const firstName = (name || "there").split(" ")[0];
          const sendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: FROM,
              to: [email],
              reply_to: REPLY_TO,
              subject: "Here's where you stand 👇",
              html: welcomeEmail(firstName),
            }),
          });

          results.push({
            leadgenId,
            email,
            inserted: true,
            welcomeSent: sendRes.ok,
          });
        }
      }

      // Always 200 quickly so Meta doesn't retry
      return res.status(200).json({ received: true, results });
    } catch (e) {
      return res.status(200).json({ received: true, error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

// ---- Day 0 welcome email (matches the nurture sequence's email #1) ----
function welcomeEmail(name) {
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2a2620;font-size:15px;line-height:1.6;">
  <div style="text-align:center;padding:18px 0;border-bottom:1px solid #e5dfd2;">
    <span style="font-family:Georgia,serif;font-size:22px;color:#c9a84c;font-style:italic;">Dom Maier Finance</span>
  </div>
  <div style="padding:22px 4px;">
    <p>Hi ${name},</p>
    <p>Thanks for taking the Mortgage Readiness Score — you just did something most people skip entirely. They walk into a lender cold and find out the hard way that their credit wasn't ready.</p>
    <p>You took the smarter route. You checked first.</p>
    <p>Your score tells you one thing clearly: where you stand right now, and which areas are worth your attention before you ever fill out a mortgage application. Whether you landed high or low, that's not a verdict — it's a starting line.</p>
    <p>Over the next couple of weeks I'm going to walk you through how mortgage readiness actually works — what lenders look at, what moves the needle, and what's just noise. No jargon, no pressure.</p>
    <p>If you have a question about your result, just hit reply. This goes straight to my inbox and I read every one.</p>
    <p style="margin-top:18px;font-style:italic;">— Dom<br>Dom Maier Finance</p>
  </div>
  <div style="border-top:1px solid #e5dfd2;padding:14px 4px;font-size:11px;color:#8a8170;text-align:center;">
    Dom Maier Finance · dommaierfinance.com · Financial education and coaching.<br>
    This material is for educational purposes only and is not credit repair, debt settlement, legal, or financial advice.
  </div>
</div>`;
}
