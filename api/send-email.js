
async function addToKlaviyo(name, email, phone, score, scoreCat) {
  const firstName = name.split(' ')[0];
  const lastName = name.split(' ').slice(1).join(' ') || '';
  try {
    await fetch('https://a.klaviyo.com/client/subscriptions/?company_id=YfGTZv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'revision': '2023-12-15' },
      body: JSON.stringify({
        data: {
          type: 'subscription',
          attributes: {
            profile: {
              data: {
                type: 'profile',
                attributes: {
                  email,
                  phone_number: phone,
                  first_name: firstName,
                  last_name: lastName,
                  properties: {
                    mortgage_score: score,
                    score_category: scoreCat,
                    source: scoreCat === 'facebook-lead' ? 'Facebook Ad' : 'Mortgage Quiz',
                  }
                }
              }
            }
          },
          relationships: {
            list: { data: { type: 'list', id: 'XFE7AE' } }
          }
        }
      })
    });
  } catch(e) {
    console.error('Klaviyo error:', e);
  }
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, score, score_cat, submittedAt } = req.body;
  const isFacebookLead = score_cat === 'facebook-lead';
  const isQuizStart = score_cat === 'quiz-start';

  try {
    // Email 1 — Notify Dom
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer re_MWK8F8E3_4bbJ1E7afnguC4FNaoMrhg1E`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Dom Maier Finance <notifications@dommaierfinance.com>',
        to: 'dom@dommaierfinance.com',
        subject: `New ${isFacebookLead ? 'Facebook ' : isQuizStart ? 'Quiz Start — ' : ''}Lead — ${name}`,
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

    // Email 2 — Customer auto-reply (quiz only, not Facebook leads or quiz-start)
    if (!isFacebookLead && !isQuizStart && email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer re_MWK8F8E3_4bbJ1E7afnguC4FNaoMrhg1E`, 'Content-Type': 'application/json' },
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

    // Add to Klaviyo
    await addToKlaviyo(name, email, phone, score || 0, score_cat || 'unknown');

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
// deploy Thu Jun 11 17:04:06 UTC 2026
