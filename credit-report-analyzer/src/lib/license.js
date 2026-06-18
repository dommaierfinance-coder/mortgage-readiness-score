// Client-side license state. The verified key is cached in localStorage so the
// user stays unlocked across visits on this device.
const KEY = "cra_license_v1";

export function getStoredLicense() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function isUnlocked() {
  const l = getStoredLicense();
  return !!(l && l.valid);
}

export async function verifyLicense(licenseKey) {
  const resp = await fetch("/api/verify-license", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseKey }),
  });
  const data = await resp.json().catch(() => ({ valid: false, error: "Unexpected response." }));
  if (resp.ok && data.valid) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ valid: true, key: String(licenseKey).trim(), at: Date.now() }));
    } catch {
      /* ignore storage failures */
    }
  }
  return data;
}

export function clearLicense() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
