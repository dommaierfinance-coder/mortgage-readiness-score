// Progress tracking. We store ONLY non-identifying snapshots (score + a few
// aggregate metrics) in localStorage so the user can re-upload a later report
// and see their trend. The raw report and any PII are never persisted.

const KEY = "cra_progress_v1";

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordSnapshot(analysis) {
  try {
    const history = loadHistory();
    const snap = {
      date: new Date().toISOString(),
      score: analysis.score,
      utilization: Math.round((analysis.utilization.aggregate || 0) * 100),
      negatives: analysis.negatives.length,
      inquiries: analysis.inquiries.scoredCount,
    };
    // De-dupe same-day snapshots (keep the latest).
    const today = snap.date.slice(0, 10);
    const filtered = history.filter((h) => h.date.slice(0, 10) !== today);
    filtered.push(snap);
    localStorage.setItem(KEY, JSON.stringify(filtered.slice(-24)));
    return filtered;
  } catch {
    return loadHistory();
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
