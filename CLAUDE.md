# FLUX Gold Tracker

## How to start

- **Folder:** `D:\flux-gold-tracker` (restored 2026-11-16 by cloning GitHub after the external drive crashed). Open a terminal there and run `claude`.
- **Source of truth:** https://github.com/zulfiqaralimir/flux-gold-tracker (branch `main`; also `api-version`, `master`). Commit and push often so a drive failure can't lose work again.
- **Run locally:** static site plus Vercel serverless functions, so use `vercel dev` (needs the Vercel CLI and `vercel login`). Open `index.html` directly only for front-end-only checks. The `/api/*` routes won't work that way.
- **Inputs:** API keys in `.env.local` (not in git). Copy `env.example` and fill in `NEWS_API_KEY`, `METALS_DEV_API_KEY`, `DASHBOARD_PASSWORD`, `AUTH_SECRET`. The same variables must exist in the Vercel project settings.
- **Outputs:** the deployed site on Vercel. Pages: `index.html`, `login.html`. Private `/dashboard` is served by `api/dashboard.js` from `api/_private/dashboard.html`.
- **Pakistan gold page:** `/pakistan-gold` (`pk-gold.html`, API `api/pk-gold.js`, maths `js/pk-gold-calc.js`). Tests: `node --test test/pk-gold-calc.test.js`. Needs no key (Yahoo GC=F futures, delayed); optional `GOLD_API_KEY` switches gold to GoldAPI.io spot. Local sarafa rates are entered by the user, never invented.
- **Pending:**
  - Recreate `.env.local` (old keys were on the crashed drive; get them from Vercel env settings or re-issue).
  - Run `vercel link` to reconnect this folder to the Vercel project.
  - Confirm `main` matches what is deployed.

## Layout

- `api/` serverless functions: `news`, `metals`, `market-heat`, `market-heat-asset`, `auth`, `dashboard`, `logout`.
- `vercel.json` rewrites `/dashboard` and `/logout` to the API functions.
- See `README.md` and `DEPLOYMENT_GUIDE.md` for details.
