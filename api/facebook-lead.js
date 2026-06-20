// /api/facebook-lead.js
// Receives Facebook Lead Ads webhooks, fetches lead details from Meta,
// and inserts them into the MortgageLeads table.
//
// Env vars required:
//   META_VERIFY_TOKEN   - shared secret for the webhook handshake
//   META_PAGE_TOKEN     - Page Access Token to fetch lead details from Meta
//   SUPABASE_SERVICE_KEY - already set
//
// Meta sends only a leadgen_id on each new lead; we call the Graph API to
// retrieve the actual field values (name, email, phone).

const SUPABASE_URL = "https://kdpcfyugwzeaqudpatrs.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const META_PAGE_TOKEN = process.env.META_PAGE_TOKEN;

export default async function handler(req, res) {
  // ---- 1. Verification handshake (Meta calls this once with GET) ----
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
      // Echo the challenge back to confirm ownership
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "Verification failed" });
  }

  // ---- 2. Incoming lead notification (Meta calls this with POST) ----
  if (req.method === "POST") {
    try {
      const body = req.body;

      // Meta wraps leads in entry[].changes[].value.leadgen_id
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

          // field_data is an array of {name, values:[...]}
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

          // Insert into MortgageLeads (Created_at, Last_email_sent, Sequence_complete auto-default)
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
            }),
          });

          results.push({ leadgenId, email, ok: insertRes.ok });
        }
      }

      // Always 200 quickly so Meta doesn't retry
      return res.status(200).json({ received: true, results });
    } catch (e) {
      // Still 200 to avoid Meta retry storms; log the error in the body
      return res.status(200).json({ received: true, error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
