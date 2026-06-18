// Verifies a Gumroad license key for the paid "action toolkit." No user accounts
// needed — the license key itself is the credential. Set GUMROAD_PRODUCT_ID in
// the environment to your Gumroad product's ID (Product → Settings → enable
// "Generate a unique license key per sale").
export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ valid: false, error: "Method not allowed" });

  const productId = process.env.GUMROAD_PRODUCT_ID;
  if (!productId) {
    return res.status(500).json({ valid: false, error: "Licensing isn't configured yet (missing GUMROAD_PRODUCT_ID)." });
  }

  const { licenseKey } = req.body || {};
  if (!licenseKey || !String(licenseKey).trim()) {
    return res.status(400).json({ valid: false, error: "Please enter your license key." });
  }

  try {
    const params = new URLSearchParams({
      product_id: productId,
      license_key: String(licenseKey).trim(),
      increment_uses_count: "false", // re-verifying shouldn't inflate the use count
    });
    const gr = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = await gr.json();

    if (!data.success) {
      return res.status(200).json({ valid: false, error: "That license key wasn't found. Double-check it and try again." });
    }

    const p = data.purchase || {};
    // Reject revoked purchases (and, for memberships, lapsed ones).
    const inactive =
      p.refunded || p.chargebacked || p.disputed ||
      p.subscription_cancelled_at || p.subscription_ended_at || p.subscription_failed_at;
    if (inactive) {
      return res.status(200).json({ valid: false, error: "This purchase is no longer active." });
    }

    return res.status(200).json({ valid: true, product: p.product_name || null });
  } catch (error) {
    console.error("license verify error:", error?.message || error);
    return res.status(500).json({ valid: false, error: "Couldn't verify right now — please try again shortly." });
  }
}
