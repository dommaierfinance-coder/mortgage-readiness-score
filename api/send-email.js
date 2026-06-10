export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, score, score_cat, submittedAt } = req.body;
  const isFacebookLead = score_cat === 'facebook-lead';

  try {
    // Email 1 — Notify Dom
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Dom Maier Finance <notifications@dommaierfinance.com>',
        to: 'dommaier.finance@gmail.com',
        subject: `New ${isFacebookLead ? 'Facebook ' : ''}Lead — ${name}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff;border-radius:8px;">
          <h2 style="color:#C9A96E;margin-bottom:16px;">New ${isFacebookLead ? 'Facebook ' : ''}Lead</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#888;">Name</td><td style="padding:8px 0;color:#fff;font-weight:600;">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#888;">Email</td><td style="padding:8px 0;color:#fff;">${email}</td></tr>
            <tr><td style="padding:8px 0;color:#888;">Phone</td><td style="padding:8px 0;color:#fff;">${phone}</td></tr>
            ${!isFacebookLead ? `<tr><td style="padding:8px 0;color:#888;">Score</td><td style="padding:8px 0;color:#C9A96E;font-weight:700;font-size:18px;">${score}/100</td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#888;">Source</td><td style="padding:8px 0;color:#fff;">${isFacebookLead ? 'Facebook Ad' : 'Mortgage Quiz'}</td></tr>
            <tr><td style="padding:8px 0;color:#888;">Time</td><td style="padding:8px 0;color:#fff;">${new Date(submittedAt).toLocaleString()}</td></tr>
          </table>
        </div>`,
      }),
    });

    // Email 2 — Customer auto-reply (quiz only, not Facebook leads)
    if (!isFacebookLead && email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Dom Maier Finance <notifications@dommaierfinance.com>',
          to: email,
          subject: 'Your Mortgage Readiness Results — Dom Maier Finance',
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff;border-radius:8px;">
            <h2 style="color:#C9A96E;margin-bottom:8px;">Hi ${name},</h2>
            <p style="color:#aaa;font-size:16px;line-height:1.6;">Your Mortgage Readiness Score: <strong style="color:#C9A96E;font-size:20px;">${score}/100</strong></p>
            <p style="color:#aaa;font-size:15px;line-height:1.6;">Dom will personally review your results and reach out within 24 hours to discuss your path to homeownership.</p>
            <p style="color:#aaa;font-size:15px;line-height:1.6;">In the meantime, check out our <a href="https://app.dommaierfinance.com" style="color:#C9A96E;">Debt Simulator</a> to keep building your plan.</p>
            <hr style="border:none;border-top:1px solid #222;margin:24px 0;"/>
            <p style="color:#555;font-size:13px;">— Dom Maier Finance<br><a href="https://dommaierfinance.com" style="color:#C9A96E;">dommaierfinance.com</a></p>
          </div>`,
        }),
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
