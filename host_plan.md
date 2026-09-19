# Host plan

The application supports two deployment setups:
1. **Full-Stack Cloud Run (Recommended)**: The entire website (React UI + Hono API) is bundled and served directly on Cloud Run from a single URL with zero CORS configuration.
2. **Split Hosting**: The UI is hosted on GitHub Pages (`https://almantask.github.io/dnd-monster-generator/`) and connects to the Cloud Run API backend.

Repo: `Almantask/dnd-monster-generator`  
Cloud Run URL: `https://bestiary-api-4klhpyohsa-uc.a.run.app`  
GitHub Pages: `https://almantask.github.io/dnd-monster-generator/`  
CORS origin: `https://almantask.github.io` (no `/dnd-monster-generator/` path)

`.env` is only for this machine. Production keys live in GitHub Secrets / Cloud Run environment variables.

---

## 1. Google Cloud credits

Google Cloud credits pay for Cloud Run, Cloud Build, and egress. They do not pay for OpenRouter, and they are not the Gemini AI Studio free tier.

### Do you already have credits?

**Google Developer Program / Google AI Pro / Ultra**

1. Sign in at [developers.google.com/profile/u/me](https://developers.google.com/profile/u/me).
2. Open **My Benefits**.
3. Look for a **Google Cloud credits** card.

If that card is missing, you do not have program credits. Free Standard membership does not include Cloud cash. Credits come from Premium (legacy), Google AI Pro ($10/month), AI Ultra ($40 or $100/month), or a promo / Free Trial grant.

**Google Cloud Console (source of truth once applied)**

1. Open [Billing → Credits](https://console.cloud.google.com/billing).
2. Pick the billing account.
3. Open **Credits** (or **View details** under Credits used on Overview).

You should see remaining value, status (available / used / expired), and end date. If the table is empty, nothing is applied to that billing account yet.

**Free Trial** is a separate $300 for 90 days. Overview shows remaining credit and days left. That is also real Cloud credit; it is just a different offer.

### How to use them

Credits sit on a **billing account**, not on a project. Link the Bestiary project to that account; spend happens automatically.

1. **Apply the grant** (once)
   - Benefits page shows a billing-account dropdown → select the account you will use for this app.
   - Or it shows a promo code → redeem at [console.cloud.google.com/billing/redeem](https://console.cloud.google.com/billing/redeem), paste the code, pick the same billing account.
   - You need the `billing.accounts.redeemPromotion` permission (Billing Account Admin/User). If the dropdown is empty, that role is missing.
2. **Attach the project**
   - Cloud Console → Billing → **My projects** → set the Bestiary GCP project to that billing account.
3. **Deploy as usual**
   - Cloud Run, Cloud Build, and egress draw down the credit first.
   - Eligible Cloud usage is covered until the credit hits $0 or expires (Developer Program credits expire a year after grant; Free Trial is 90 days).

Do not paste a credit code into `.env` or GitHub Secrets.

| Paid by Google Cloud credits | Not paid by those credits |
|---|---|
| Cloud Run (this API, scale-to-zero) | OpenRouter (`OPENROUTER_API_KEY`) |
| Cloud Build / Artifact Registry on deploy | Gemini AI Studio image generation (`GEMINI_API_KEY`, needs AI Studio billing; free tier has 0 image quota) |
| Egress from Cloud Run | Pollinations (free, no key) |

With `--min-instances 0`, idle Cloud Run is essentially $0. Set a **$10 budget alert** on the billing account so a misconfigured paid API cannot overspend.

If Benefits has no credit card and Billing → Credits is empty, start the [Google Cloud Free Trial](https://cloud.google.com/free) ($300 / 90 days) or pay Cloud Run from a normal billing account. The Gemini key still works either way; it is a different free pool.

---

## 2. Google Cloud project

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Attach billing (and credits from section 1).
3. Enable **Cloud Run API**, **Cloud Build API**, and **Artifact Registry API** under [APIs & Services → Library](https://console.cloud.google.com/apis/library).
4. Set a **$10 budget alert** on the billing account.

---

## 3. Deployer service account

Create a service account that GitHub Actions uses to deploy Cloud Run. Do this in Console with the Bestiary project selected. You need Owner or Editor on that project.

### 3.1 Create the service account

1. Open [IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. **Create service account**.
3. **Service account name:** `bestiary-deployer`.  
   Email will look like `bestiary-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com`.
4. **Create and continue**.

### 3.2 Grant the five roles

Under **Grant this service account access to the project**, add each role, then **Add another role**:

| Search for | Role |
|---|---|
| Cloud Run Admin | Cloud Run Admin |
| Service Account User | Service Account User |
| Cloud Build Editor | Cloud Build Editor |
| Storage Admin | Storage Admin |
| Artifact Registry Administrator | Artifact Registry Administrator |

**Continue** → skip “principals who can access this service account” → **Done**.

If you skipped the grant step: **IAM** (not Service Accounts) → **Grant access** → paste the `bestiary-deployer@…` email → add the same five roles → **Save**.

### 3.3 Let it use the default Compute service account

Cloud Run runs as the default Compute Engine SA. The deployer must be allowed to act as that identity.

1. [IAM](https://console.cloud.google.com/iam-admin/iam) → find  
   `YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com`  
   (Project number is on [Home / Dashboard](https://console.cloud.google.com/home/dashboard).)
2. Open that Compute SA under Service Accounts → **Permissions** → **Grant access**.
3. Principal: `bestiary-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com`.
4. Role: **Service Account User**.

Without this, GitHub will authenticate and then fail with a permission error on the runtime service account.

### 3.4 Create the JSON key (`GCP_SA_KEY`)

1. [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) → click `bestiary-deployer`.
2. **Keys** → **Add key** → **Create new key**.
3. Type: **JSON** → **Create**.
4. A `.json` file downloads once. That is the only copy. Do not commit it, do not put it in `.env`.

If **Create new key** is greyed out, the org has blocked user-managed keys. Stop; the next path is Workload Identity Federation, not a JSON file.

### 3.5 Put it in GitHub, then delete the local file

1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `GCP_SA_KEY`.
3. Value: entire contents of the JSON file (from `{` through `}`).
4. Save.
5. Delete the downloaded file from Downloads.

Also add secret `GCP_PROJECT_ID` with the project id from the Console (not the display name).

---

## 4. GitHub secrets and variables

Repo **Settings → Secrets and variables → Actions**.

**Secrets**

| Name | Required | Value |
|---|---|---|
| `GCP_SA_KEY` | yes | Full JSON key from section 3 |
| `GCP_PROJECT_ID` | yes | GCP project id |
| `OPENROUTER_API_KEY` | yes | Same key as local `.env` |
| `GEMINI_API_KEY` | recommended | AI Studio key for portraits |
| `VITE_API_URL` | after first Cloud Run deploy | Cloud Run URL, no trailing slash |
| `GENERATION_PASSPHRASE` | optional | If set, the UI Settings page must use the same passphrase |
| `CLOUDFLARE_ACCOUNT_ID` | recommended | Cloudflare account id (free FLUX portraits via Workers AI) |
| `CLOUDFLARE_API_TOKEN` | recommended | API token from the "Workers AI" template |
| `POLLINATIONS_API_KEY` | no | Secret `sk_` key; unset uses the anonymous legacy endpoint |

**Variable** (not a secret)

| Name | Value |
|---|---|
| `CORS_ORIGIN` | `https://almantask.github.io` |

---

## 5. Deploy the API (Cloud Run)

1. Push to `main`, or **Actions → Cloud Run → Run workflow**.
2. When it succeeds, open the Cloud Run service `bestiary-api` and copy the URL, e.g. `https://bestiary-api-xxxxx.us-central1.run.app`.
3. Put that URL in GitHub secret `VITE_API_URL` (no trailing slash).

The workflow deploys with `--allow-unauthenticated` and `--min-instances 0`. Anyone who has the URL can call it unless you set `GENERATION_PASSPHRASE`. Daily limit is still 20 per IP.

---

## 6. Deploy the UI (GitHub Pages)

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Push to `main` again (or run the **Pages** workflow) so the build picks up `VITE_API_URL`.
3. Open `https://almantask.github.io/dnd-monster-generator/`.

If you skip `VITE_API_URL`, the site still loads. Paste the Cloud Run URL on the in-app **Settings** page; that override is stored in this browser only.

---

## 7. Smoke test

- Settings should show OpenRouter configured, Gemini configured if you set the key, Cloudflare Workers AI configured if you set both Cloudflare secrets, Pollinations as the last fallback.
- Conjure a monster: statblock from Gemini (OpenRouter if Gemini fails), portrait from Gemini with billing, otherwise Cloudflare Workers AI, then Pollinations.
- Data stays in **IndexedDB on that device**. Export JSON/zip if you want a backup.
