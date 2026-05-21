# Deploy FinePrint

The one-shot path: GitHub → **Vercel** (free) → `fineprintdoc.com` via Namecheap DNS. About 10 minutes of clicking plus DNS propagation.

> **Costs.** Vercel hosting is free for this size. The **Gemini API** is also
> free for the first **1,500 contract analyses per day** (Google AI Studio
> free tier, 15 requests/minute). Beyond that you can either upgrade to
> pay-as-you-go (~$0.0001–0.001 per analysis) or stay on free with the daily
> cap. **No credit card needed** for the free tier.

> **Before you start (optional):** the codebase still references
> `github.com/fineprintdoc/fineprint` in a few places (README footers, JSON-LD).
> The real repo is `github.com/artffee/fineprint`. Either find-and-replace, or
> create the `fineprintdoc` GitHub org and
> `gh repo transfer artffee/fineprint fineprintdoc/fineprint`.

---

## 1 · Connect Vercel to the GitHub repo (~3 min)

1. Open <https://vercel.com> and **Sign up with GitHub** using the account that
   owns the repo (`artffee`).
2. From the dashboard click **Add New → Project**.
3. Find **`artffee/fineprint`** in the list and click **Import**.
4. On the configuration screen:
   - **Framework Preset**: *Other* (Vercel will detect the `vercel.json`).
   - **Root Directory**: leave as `./`.
   - **Build Command**: leave empty (no build step — `npm install` is enough).
   - **Output Directory**: leave default.
5. Expand **Environment Variables** and add:
   - Name: `GEMINI_API_KEY`
   - Value: `AIza…` (from <https://aistudio.google.com/app/apikey>)
6. Click **Deploy**. First deploy takes ~60 seconds.

## 2 · Smoke-test the Vercel URL (~30 sec)

Vercel gives you a preview URL like `fineprint-xyz.vercel.app`.

1. Open `https://fineprint-xyz.vercel.app/api/health`. You want:
   ```json
   {"ok": true, "model": "gemini-2.0-flash", "hasKey": true}
   ```
2. Hit the homepage. Hit `/app.html`, paste a real contract, click
   **Analyze Contract**. You should see a live Gemini analysis (not the
   demo-mode banner).

If health says `hasKey: false`, the env var isn't on production yet —
Vercel → **Project → Settings → Environment Variables**, confirm it's set
for **Production**, then **Deployments → ⋯ → Redeploy**.

## 3 · Add `fineprintdoc.com` as a custom domain in Vercel (~1 min)

1. **Project → Settings → Domains → Add**.
2. Type `fineprintdoc.com`, click **Add**.
3. Type `www.fineprintdoc.com`, click **Add**.
4. Vercel shows the **DNS records you need to add at your registrar** — copy
   them. You'll see something like:

   | Type  | Name | Value                  |
   |-------|------|------------------------|
   | A     | `@`  | `76.76.21.21`          |
   | CNAME | `www`| `cname.vercel-dns.com` |

   (The exact A-record IP may differ; use whatever Vercel shows you.)
5. **Leave this tab open** — you'll need these values for the next step.

## 4 · Configure DNS at Namecheap (~5 min + propagation)

1. Open <https://ap.www.namecheap.com> → **Domain List** → **Manage**
   next to `fineprintdoc.com`.
2. Click the **Advanced DNS** tab.
3. **Delete** any default Namecheap records (the "Parking Page" URL Redirect
   under *Redirect Domain*, and any default `CNAME Record` for `www` pointing
   at `parkingpage.namecheap.com`).
4. Click **+ Add New Record** and add exactly what Vercel told you. Typical:

   | Type             | Host  | Value                  | TTL       |
   |------------------|-------|------------------------|-----------|
   | **A Record**     | `@`   | `76.76.21.21`          | Automatic |
   | **CNAME Record** | `www` | `cname.vercel-dns.com` | Automatic |

   *Important:* use **A Record** for the apex `@` — Vercel gives you a real
   IP for the root because DNS standards forbid `CNAME` at the apex.
5. Click the green ✓ to save each row.
6. Back in Vercel → Domains, the badges will flip from "Invalid Configuration"
   to a green check once the DNS resolves. Usually 5–30 minutes; sometimes up
   to an hour for stubborn ISP caches.

## 5 · Wait for HTTPS (~5–15 min after DNS resolves)

Vercel issues a Let's Encrypt cert automatically once DNS points at it. When
the green checks appear in **Domains**, `https://fineprintdoc.com` works.

## 6 · Final smoke test

- `https://fineprintdoc.com/` → homepage loads, EN/ES toggle works
- `https://fineprintdoc.com/api/health` → `{ok: true, hasKey: true}`
- `https://www.fineprintdoc.com/` → also loads (Vercel handles both)
- `/app.html` → real Gemini analysis on a real contract

---

## Cost expectations

| Item | Cost |
|---|---|
| **Vercel** (Hobby tier) | **$0**. 100 GB bandwidth/mo, 100 GB-h functions/mo. Way past what this site will use early. |
| **Gemini API** | Free tier: 1,500 reads/day at 15 req/min. Pay-as-you-go beyond that is ~$0.0001–0.001 per analysis. No credit card needed for free tier. |
| **Namecheap** | Annual domain registration only. |

Free tier auto-caps at 1,500 requests/day, so there's nothing to set up. If
you ever upgrade to pay-as-you-go, set a project quota in
**Google AI Studio → API keys → your key → Quotas**.

## Vercel free-tier limits worth knowing

- **Request body limit**: 4.5 MB. We already cap uploads at 4 MB in
  `server.js` to match. Most real-estate / lease / car PDFs are 1–3 MB.
- **Function timeout**: 10 seconds on Hobby (we've set 30s in `vercel.json`,
  Vercel caps to 10s for free anyway). PDFs that take too long will time out —
  if that happens, paste the text instead.
- **No persistent storage**. We don't store contracts anyway, so this is fine.

## Troubleshooting

- **`ERR_CONNECTION_TIMED_OUT`**: DNS still propagating. Test with
  `dig fineprintdoc.com +short` — empty means not resolved yet.
- **Vercel says "Invalid Configuration"**: DNS records aren't right. Re-check
  the A-record points to the IP Vercel showed you. Stray Namecheap defaults
  (URL Redirect) often interfere — delete them.
- **`/api/analyze` returns `503`**: `GEMINI_API_KEY` is missing from the
  Production environment in Vercel. Add it under
  **Settings → Environment Variables**, then redeploy.
- **`/api/analyze` returns `413` or `FUNCTION_PAYLOAD_TOO_LARGE`**: the PDF
  is over 4.5 MB. Paste the text instead, or split the PDF.
- **`/api/analyze` returns `504` (timeout)**: PDF parsing + Gemini took longer
  than 10 seconds. Same workaround: paste text instead of uploading the PDF.

## Alternative free hosts (if Vercel doesn't suit you)

- **Cloudflare Pages + Workers** — better edge performance, but Workers don't
  run Node and would need a rewrite (no `pdf-parse`).
- **Render free tier** — works as-is, but the service sleeps after 15 minutes
  of inactivity. First request after sleep waits 30–60 s. Bad UX for users.
- **Koyeb free tier** — one always-on instance, no spin-down, works with our
  Express app as-is. Less mature than Vercel.

## Running locally (unchanged)

Local development still works the same — Vercel-aware refactor is purely
additive:

```bash
cp .env.example .env       # add GEMINI_API_KEY
npm install
npm start                   # http://localhost:3000
```
