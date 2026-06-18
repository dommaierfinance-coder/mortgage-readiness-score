# Credit Report Analyzer — Dom Maier Finance

Upload a credit report PDF and get a prioritized, data-driven plan to raise your score the fastest. Built with React + Vite, deployed on Vercel, powered by Claude for PDF extraction.

> ⚠️ This is a **self-contained project** that currently lives in a subfolder of
> the `mortgage-readiness-score` repo (creating a separate GitHub repo wasn't
> possible from the build session). To split it into its own repo, copy this
> `credit-report-analyzer/` directory into a new empty repo — nothing in the code
> depends on the parent.

## What it does

- **PDF analysis** — Claude (`claude-opus-4-8`) reads the uploaded report and extracts accounts, balances, limits, collections, charge-offs, late payments, and inquiries into a structured schema. The PDF is never stored.
- **Score factor dashboard** — estimates a 300–850 score from the five FICO factors and shows where each stands. Anchors to the report's real score when present.
- **Fastest-paydown optimizer** — ranks each card paydown by score-points-per-dollar, crossing the utilization thresholds (90% → 50% → 30% → 10% → $0) that move scores. Enter a budget to get an optimal allocation.
- **What-if simulator** — sliders + toggles to model paying down balances or removing a negative, with live estimated score impact.
- **Negatives & dispute audit** — every derogatory item with a recommended action and 7-year fall-off date; flags items already past due to drop.
- **Dispute letter generator** — pre-filled dispute / goodwill / pay-for-delete / validation letters, ready to download and mail.
- **AI credit coach** — chat grounded in the user's actual (non-identifying) report summary.
- **Action roadmap, education hub, and progress tracking** (local-only snapshots).
- **Book-a-call** — lead capture that hands off to Dom via Resend + Klaviyo.

## Architecture

```
src/
  lib/credit.js     Deterministic scoring engine (utilization, paydown optimizer,
                    score model, negatives audit, roadmap) — pure functions.
  lib/letters.js    Dispute letter templates.
  lib/storage.js    Local-only progress snapshots.
  components/        Upload portal + dashboard sections.
api/
  analyze.js        PDF → structured report (Claude, structured outputs).
  coach.js          AI coach chat.
  lead.js           Lead capture → Resend + Klaviyo.
```

Extraction (reading the PDF) is done by Claude server-side; **all scoring math runs in the browser** on the structured data, so the recommendations are precise and repeatable rather than model-guessed. The score is an internally-consistent heuristic for ranking actions and driving the simulator — not an official FICO score.

## Local development

```bash
npm install

# Terminal 1 — serverless functions (needs the Vercel CLI: npm i -g vercel)
ANTHROPIC_API_KEY=sk-ant-... vercel dev   # serves /api on :3000

# Terminal 2 — the Vite dev server (proxies /api to :3000)
npm run dev
```

No API key handy? Click **"Try it with sample data"** on the upload screen — the whole dashboard works against a bundled sample report.

## Environment variables (set in Vercel)

| Variable | Used by | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | `analyze`, `coach` | Yes (for real PDFs + coach) |
| `GUMROAD_PRODUCT_ID` | `verify-license` | For the paywall — your Gumroad product ID |
| `VITE_GUMROAD_URL` | Paywall buy button | For the paywall — your Gumroad checkout URL (build-time) |
| `RESEND_API_KEY` | `lead` | Optional |
| `LEAD_NOTIFY_TO` | `lead` | Optional (defaults to dom@…) |
| `LEAD_FROM` | `lead` | Optional |
| `KLAVIYO_COMPANY_ID`, `KLAVIYO_LIST_ID` | `lead` | Optional |

### Paywall (Gumroad)

The action toolkit (paydown optimizer, simulator, dispute letters, AI coach, progress) is gated behind a one-time Gumroad purchase; the score, factor dashboard, negatives audit, roadmap, and education stay free.

1. Create a Gumroad **product** → Settings → enable **"Generate a unique license key per sale."**
2. Set **`GUMROAD_PRODUCT_ID`** (server env) to the product's ID, and **`VITE_GUMROAD_URL`** (build env) to its checkout URL.
3. Buyers paste their license key into the in-app **Unlock** box; `api/verify-license.js` checks it against Gumroad's license API and unlocks the toolkit on that device.

`VITE_GUMROAD_URL` is read at build time, so set it in Vercel before deploying (or redeploy after adding it).

## Deploy

Import the project into Vercel (framework preset: Vite), set `ANTHROPIC_API_KEY`, and deploy. The `api/` functions run on the Node runtime; `analyze` is allowed up to 60s for multi-page PDFs.

---

Educational information only. Not financial, legal, or credit-repair advice.
