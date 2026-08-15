# The Bestiary

A D&D 5e monster workshop: conjure or hand-scribe creatures, keep them in your browser, and roll dice from the statblock. The site is a GitHub Pages app. Generation goes through a Cloud Run API so keys never ship in the JavaScript.

## Local development

Needs Node 22+.

```bash
npm install
```

Copy `.env.example` to `.env` and set at least `OPENROUTER_API_KEY` (free OpenRouter account). For portraits, set `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey) (Gemini 2.5 Flash Image, about 500 free requests/day, no credit card). Pollinations is the no-key fallback. `.env` is gitignored; the API loads it on startup without overriding variables already set in the shell or Cloud Run. Then run the API and the UI:

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

See [host_plan.md](host_plan.md) for Cloud credits, the deployer service account, GitHub secrets, Cloud Run, and GitHub Pages.

## How generation works

- **Statblocks:** OpenRouter `:free` models only (`deepseek/deepseek-v4-flash:free`, `tencent/hy3:free`, then other free fallbacks).
- **Images:** Gemini 2.5 Flash Image first (AI Studio key, ~500/day free). If that fails or the key is missing, Pollinations FLUX (no key). Hugging Face `FLUX.1-schnell` last if `HF_TOKEN` is set.
- Monsters and images are stored in **IndexedDB** on this device. Export JSON (or a zip) to back them up.

Click ability scores, `+N to hit`, damage dice, hit dice, or recharge text to roll. Results collect in the dice tray at the bottom of the page.
