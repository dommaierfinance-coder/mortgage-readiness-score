# Credit Report Analyzer — Dom Maier Finance

Upload a credit report PDF to understand what's affecting your score, with an educational breakdown of the factors. Built with React + Vite, deployed on Vercel, powered by Claude for PDF extraction. Educational information only — not financial, legal, or credit-repair advice.

> ⚠️ This is a **self-contained project** that currently lives in a subfolder of
> the `mortgage-readiness-score` repo (creating a separate GitHub repo wasn't
> possible from the build session). To split it into its own repo, copy this
> `credit-report-analyzer/` directory into a new empty repo — nothing in the code
> depends on the parent.

## What it does

- **PDF analysis** — Claude (`claude-sonnet-4-6`) reads the uploaded report and extracts accounts, balances, limits, collections, charge-offs, late payments, and inquiries into a structured schema. The PDF is never stored.
- **Score factor dashboard** — estimates a 300–850 score from the five FICO factors and shows where each stands. Anchors to the report's real score when present.
- **Paydown optimizer (educational)** — illustrates how lowering balances across common utilization reference points (90% → 50% → 30% → 10% → $0) relates to the estimated score; optional budget allocation. Estimates only, not a promise of results.
- **What-if simulator** — sliders + toggles to model how different factors could affect the estimated score (e.g., an item no longer on the report once it ages off).
- **Negative items (educational)** — each derogatory item with a plain-language explanation and typical 7-year fall-off date; no instructions to act.
- **AI coach** — educational chat grounded in the user's non-identifying report summary; explains factors and never drafts dispute letters, tells users to dispute specific items, or promises score outcomes.
- **Action roadmap, education hub, and progress tracking** (local-only snapshots).
- **Book-a-call** — educational mortgage-readiness lead capture that hands off to Dom via Resend + Klaviyo.

## Architecture

```
src/
  lib/credit.js     Deterministic scoring engine (utilization, paydown optimizer,
                    score model, negative-item summary, roadmap) — pure functions.
  lib/license.js    Gumroad license gate (client side).
  lib/storage.js    Local-only progress snapshots.
  components/        Upload portal + dashboard sections.
api/
  analyze.js        PDF → structured report (Claude, structured outputs).
  coach.js          AI coach chat.
  lead.js           Lead capture → Resend + Klaviyo.
```

Extraction (reading the PDF) is done by Claude server-side; **all scoring math runs in the browser** on the structured data, so the estimates and explanations are precise and repeatable rather than model-guessed. The score is an internally-consistent heuristic for illustrating factors and driving the simulator — not an official FICO score, and not a promise of results.

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
| `GUMROAD_PRODUCT_ID` | `verify-license` | For the paywall — your Gumroad product ID **or** permalink (the code after `gumroad.com/l/…`) |
| `VITE_GUMROAD_URL` | Paywall buy button | For the paywall — your Gumroad checkout URL (build-time) |
| `RESEND_API_KEY` | `lead` | Optional |
| `LEAD_NOTIFY_TO` | `lead` | Optional (defaults to dom@…) |
| `LEAD_FROM` | `lead` | Optional |
| `KLAVIYO_COMPANY_ID`, `KLAVIYO_LIST_ID` | `lead` | Optional |

### Paywall (Gumroad)

The action toolkit (paydown optimizer, simulator, AI coach, progress tracking) is gated behind a one-time Gumroad purchase; the score, factor dashboard, negative-item summary, roadmap, and education stay free.

1. Create a Gumroad **product** → Settings → enable **"Generate a unique license key per sale."**
2. Set **`GUMROAD_PRODUCT_ID`** (server env) to the product's ID **or** its permalink (the code after `gumroad.com/l/…`), and **`VITE_GUMROAD_URL`** (build env) to its checkout URL.
3. Buyers paste their license key into the in-app **Unlock** box; `api/verify-license.js` checks it against Gumroad's license API and unlocks the toolkit on that device.

`VITE_GUMROAD_URL` is read at build time, so set it in Vercel before deploying (or redeploy after adding it).

## Deploy

Import the project into Vercel (framework preset: Vite), set `ANTHROPIC_API_KEY`, and deploy. The `api/` functions run on the Node runtime; `analyze` is allowed up to 60s for multi-page PDFs.

---

Educational information only. Not financial, legal, or credit-repair advice.
