# Deploy FinePrint

The one-shot path: GitHub → Railway → `fineprintdoc.com` via Namecheap DNS. ~15 minutes of clicking plus DNS propagation.

> **Before you start (optional):** the codebase currently references `github.com/fineprintdoc/fineprint` in a few places (READMEs, footer links, JSON-LD). The actual repo is at `github.com/artffee/fineprint`. Run a quick find-and-replace if you want the in-app links to work, or claim the `fineprintdoc` GitHub org and `gh repo transfer artffee/fineprint fineprintdoc/fineprint`.

---

## 1 · Connect Railway to the GitHub repo (~3 min)

1. Open <https://railway.app> and sign up with the **GitHub account that owns the repo** (`artffee`).
2. Click **New Project → Deploy from GitHub repo**.
3. Authorize Railway to read your repos, then pick **`artffee/fineprint`**.
4. Railway auto-detects Node.js, runs `npm install`, then `npm start`. Wait for the first deploy to go green (~90 seconds).

## 2 · Add the Anthropic API key (~1 min)

1. Click the service tile, then **Variables** in the side panel.
2. **+ New Variable**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-…` (from <https://console.anthropic.com>)
3. (Optional) `LEXIS_MODEL` → `claude-sonnet-4-5` if you want to pin it.
4. Railway redeploys automatically on any variable change.

## 3 · Generate the Railway URL and smoke-test (~1 min)

1. **Settings → Networking → Generate Domain**. You get something like
   `fineprint-production-1234.up.railway.app`.
2. In a browser, hit
   `https://fineprint-production-1234.up.railway.app/api/health`. You want:
   ```json
   {"ok": true, "model": "claude-sonnet-4-5", "hasKey": true}
   ```
3. Visit `/app.html`, paste a real contract, hit **Analyze Contract**. You should
   see a live Claude analysis, not the demo banner.

If health says `hasKey: false`, the variable isn't picked up yet — wait for the
redeploy to finish.

## 4 · Add `fineprintdoc.com` as a custom domain in Railway (~1 min)

1. **Settings → Networking → Custom Domains → + Custom Domain**.
2. Enter `fineprintdoc.com`. Railway shows you a CNAME target —
   **copy it** (looks like `xyz123.up.railway.app`).
3. Click **+ Custom Domain** again, enter `www.fineprintdoc.com`,
   same CNAME target.
4. Both show "Pending DNS" — that's expected. Leave this tab open.

## 5 · Point Namecheap DNS at Railway (~5 min + propagation)

1. Open <https://ap.www.namecheap.com> → **Domain List** → **Manage**
   next to `fineprintdoc.com`.
2. Click the **Advanced DNS** tab.
3. **Delete** any default Namecheap records (the "Parking Page" URL Redirect,
   and the default `CNAME Record` for `www` pointing at `parkingpage.namecheap.com`).
4. Click **+ Add New Record** and add the two below:

   | Type             | Host  | Value                              | TTL       |
   |------------------|-------|------------------------------------|-----------|
   | **ALIAS Record** | `@`   | *(the Railway CNAME target)*       | Automatic |
   | **CNAME Record** | `www` | *(the same Railway CNAME target)*  | Automatic |

   Important: use **ALIAS Record** for the apex `@`, **not** `CNAME`.
   DNS standards forbid `CNAME` at the root, and Namecheap will reject it.
   ALIAS achieves the same result.
5. Click the green ✓ to save each row.

## 6 · Wait for DNS + HTTPS (~5–60 min)

1. Test from your terminal:
   ```bash
   dig fineprintdoc.com +short
   dig www.fineprintdoc.com +short
   ```
   You want both to resolve to Railway's address.
2. Once DNS resolves, Railway issues a Let's Encrypt cert automatically.
   The "Pending DNS" badges in Railway → Networking flip to green.
3. Open <https://fineprintdoc.com>. The site should load over HTTPS.

## 7 · Final smoke test

- `https://fineprintdoc.com/` → homepage loads, EN/ES toggle works
- `https://fineprintdoc.com/api/health` → `{ok: true, hasKey: true}`
- `https://www.fineprintdoc.com/` → also works (Railway serves both)
- `/app.html` → real analysis on a real contract

---

## Cost expectations

| Item | Cost |
|---|---|
| Railway (always-on Node service) | ~$5/month after the trial credit |
| Anthropic API | roughly $0.01–0.05 per contract analysis (Sonnet 4.5) |
| Namecheap | only the annual domain registration |

If usage gets meaningful, set a monthly cap in Anthropic console
(**Settings → Billing → Limits**) to avoid surprises.

## Troubleshooting

- **`ERR_CONNECTION_TIMED_OUT` even after waiting**: DNS hasn't propagated yet.
  Try `dig fineprintdoc.com +short` — empty means still propagating. Some ISPs
  cache for up to an hour.
- **`502 Bad Gateway`**: Railway didn't boot. Check
  **Deployments → View Logs** in Railway. Usually an env-var typo or a missing
  dependency.
- **`/api/analyze` returns `503`**: `ANTHROPIC_API_KEY` isn't set on the service.
  Add it in **Variables**, wait for the redeploy.
- **HTTPS warning ("Not secure")**: Railway hasn't issued the cert yet — wait 5
  more minutes after DNS resolved. If it persists past 30 minutes, click
  **Custom Domain → Refresh** in Railway.
- **`www` redirects to apex (or vice versa) and you don't want that**: Railway
  serves both as primaries by default. To redirect one to the other, add a
  redirect rule in **Settings → Networking → Redirects**.

## Alternative hosts (if Railway doesn't suit you)

- **Render** — almost identical flow, slightly slower cold-starts.
- **Fly.io** — needs a `Dockerfile`, more control, similar price.
- **Vercel** — would require splitting the Express endpoint into a serverless
  function (`api/analyze.js`). Worth it only if you want global edge static
  delivery; for this app, Railway is simpler.
