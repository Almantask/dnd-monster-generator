# The Bestiary

A D&D 5e monster workshop: conjure or hand-scribe creatures, keep them in your browser, and roll dice from the statblock. The site is a GitHub Pages app. Generation goes through a Cloud Run API so keys never ship in the JavaScript.

## Local development

Needs Node 22+.

```bash
npm install
```

Copy `.env.example` to `.env` and set at least `OPENROUTER_API_KEY` (free OpenRouter account). Then run the API and the UI:

```bash
npm run dev:server
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` to `http://localhost:8080`.

```bash
npm test
npm run typecheck
npm run lint
```

## Deploy

### 1. Cloud Run API

1. Create a GCP project and attach your Google Developer Program credits.
2. Enable Cloud Run and Cloud Build.
3. Create a service account that can deploy Cloud Run; put its JSON key in the GitHub secret `GCP_SA_KEY`.
4. GitHub secrets: `GCP_PROJECT_ID`, `OPENROUTER_API_KEY`. Optional: `POLLINATIONS_API_KEY`, `HF_TOKEN`, `GENERATION_PASSPHRASE`.
5. GitHub variable `CORS_ORIGIN` = your Pages origin, e.g. `https://YOURUSER.github.io`.
6. Push to `main` (or run the **Cloud Run** workflow). Copy the service URL.

Set a **$10 budget alert** on the billing account so a misconfigured paid API cannot overspend. This app only calls free OpenRouter chat models and free image APIs.

### 2. GitHub Pages

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Secret `VITE_API_URL` = the Cloud Run URL with no trailing slash.
3. Push to `main`. The site is at `https://YOURUSER.github.io/dnd-monster-generator/`.
4. If you skip `VITE_API_URL` at build time, paste the Cloud Run URL in the in-app **Settings** page.

## How generation works

- **Statblocks:** OpenRouter `:free` models only (`deepseek/deepseek-v4-flash:free`, `tencent/hy3:free`, then other free fallbacks).
- **Images:** Pollinations FLUX (always free), then Hugging Face `FLUX.1-schnell` if `HF_TOKEN` is set.
- Monsters and images are stored in **IndexedDB** on this device. Export JSON (or a zip) to back them up.

Click ability scores, `+N to hit`, damage dice, hit dice, or recharge text to roll. Results collect in the dice tray at the bottom of the page.
