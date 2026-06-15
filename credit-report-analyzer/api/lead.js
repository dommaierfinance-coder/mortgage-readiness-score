// Lead capture → notifies Dom via Resend and (optionally) syncs to Klaviyo.
// Secrets come from environment variables — set them in your Vercel project:
//   RESEND_API_KEY, LEAD_NOTIFY_TO, LEAD_FROM, KLAVIYO_COMPANY_ID, KLAVIYO_LIST_ID
// Any that are missing are simply skipped, so the form never blocks the user.

export const config = { maxDuration: 15 };

async function notifyByEmail({ name, email, phone, score, source, submittedAt }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const to = process.env.LEAD_NOTIFY_TO || "dom@dommaierfinance.com";
  const from = process.env.LEAD_FROM || "Dom Maier Finance <notifications@dommaierfinance.com>";
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `New Credit Analyzer Lead — ${name}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff;border-radius:8px;">
        <h2 style="color:#C9A96E;margin-bottom:16px;">New Lead — Credit Report Analyzer</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#888;">Name</td><td style="padding:8px 0;color:#fff;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Email</td><td style="padding:8px 0;color:#fff;">${email}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Phone</td><td style="padding:8px 0;color:#fff;">${phone}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Est. Score</td><td style="padding:8px 0;color:#C9A96E;font-weight:700;">${score}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Source</td><td style="padding:8px 0;color:#fff;">${source || "Credit Report Analyzer"}</td></tr>
          <tr><td style="padding:8px 0;color:#888;">Time</td><td style="padding:8px 0;color:#fff;">${new Date(submittedAt || Date.now()).toLocaleString()}</td></tr>
        </table>
      </div>`,
    }),
  });
}

async function syncKlaviyo({ name, email, phone, score }) {
  const companyId = process.env.KLAVIYO_COMPANY_ID;
  const listId = process.env.KLAVIYO_LIST_ID;
  if (!companyId || !listId) return;
  const [firstName, ...rest] = (name || "").split(" ");
  await fetch(`https://a.klaviyo.com/client/subscriptions/?company_id=${companyId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", revision: "2023-12-15" },
    body: JSON.stringify({
      data: {
        type: "subscription",
        attributes: {
          profile: {
            data: {
              type: "profile",
              attributes: {
                email,
                phone_number: phone,
                first_name: firstName,
                last_name: rest.join(" "),
                properties: { credit_score_estimate: score, source: "Credit Report Analyzer" },
              },
            },
          },
        },
        relationships: { list: { data: { type: "list", id: listId } } },
      },
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const lead = req.body || {};
  if (!lead.email) return res.status(400).json({ error: "Missing fields." });

  try {
    await Promise.allSettled([notifyByEmail(lead), syncKlaviyo(lead)]);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("lead error:", error?.message || error);
    // Never block the user on a delivery failure.
    return res.status(200).json({ success: true });
  }
}
