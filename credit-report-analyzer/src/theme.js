// Shared visual language — matches the Dom Maier Finance brand used across the suite.
export const ACCENT = "#C9A96E";
export const BG = "#0a0a0a";
export const BORDER = "rgba(255,255,255,0.08)";
export const CARD = "rgba(255,255,255,0.02)";

export const RED = "#ef4444";
export const AMBER = "#f59e0b";
export const GREEN = "#10b981";

export const FONT = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";
export const SERIF = "'Playfair Display',Georgia,serif";
export const MONO = "'Courier New',monospace";

// Color a 300–850 score.
export function scoreColor(score) {
  if (score >= 740) return GREEN;
  if (score >= 670) return ACCENT;
  if (score >= 580) return AMBER;
  return RED;
}

// Label a 300–850 score band (FICO conventions).
export function scoreBand(score) {
  if (score >= 800) return "Exceptional";
  if (score >= 740) return "Very Good";
  if (score >= 670) return "Good";
  if (score >= 580) return "Fair";
  return "Poor";
}

export const fmtUSD = (n) =>
  "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

export const fmtPct = (n) =>
  (Number.isFinite(n) ? Math.round(n * 100) : 0) + "%";
