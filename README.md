# FinePrint — Contract Reader

Free AI-powered real estate contract analyzer. Drop in a contract, get a 90-second risk report.

This repo contains both the marketing site and the working analyzer backend.

## Quick start

```bash
# 1. Install
npm install

# 2. Add your Anthropic API key
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY

# 3. Run
npm start

# Visit http://localhost:3000
```

## How it works

- **Frontend** — static HTML/CSS/JS in this folder. Open `index.html` directly to see the marketing site without a backend.
- **Backend** — `server.js` is an Express app that serves the static files and exposes `POST /api/analyze`. The analyzer endpoint accepts a PDF upload or pasted text plus a "party" perspective (buyer/seller/investor), and returns structured JSON.
- **LLM** — Claude Sonnet 4.5 via the Anthropic SDK with a structured prompt that returns risk score, level, verdict, and flagged clauses.

If the backend is unreachable (e.g. you opened `index.html` from disk), the analyzer page falls back to a deterministic mock report so the demo still works.

## API

### `GET /api/health`

Returns `{ ok: true, model, hasKey }`.

### `POST /api/analyze`

`multipart/form-data` or `application/json`:

| field | type | required | notes |
|-------|------|----------|-------|
| `file` | file | one of `file` or `text` | PDF or plain text |
| `text` | string | | Pasted contract text |
| `party` | string | recommended | `buyer`, `seller`, or `investor` |
| `notes` | string | optional | up to 500 chars |

Response (`200`):

```json
{
  "score": 7.4,
  "level": "HIGH",
  "levelClass": "rust",
  "verdict": "Don't sign as-is...",
  "flags": [
    {
      "sev": "critical",
      "title": "Earnest money non-refundable in 72h",
      "quote": "Earnest money shall be deemed non-refundable...",
      "plain": "If anything goes wrong after 3 days..."
    }
  ],
  "party": "buyer",
  "model": "claude-sonnet-4-5",
  "truncated": false
}
```

Errors return `{ error: "..." }` with a 4xx/5xx status.

## Deploying

The app is a single Node process. It works on any platform that runs Node 20+:

- **Render / Railway / Fly.io** — set `ANTHROPIC_API_KEY` as a secret, start command `npm start`.
- **Vercel / Netlify** — split the static files into the CDN and deploy `server.js` as a function. The frontend already uses a relative `/api/analyze` URL.

## Tech

- Node 20+
- Express 4
- Anthropic SDK
- `pdf-parse` for PDF text extraction
- `multer` for upload handling

## License

MIT. Engine prompts, risk taxonomy, and frontend — all open. See [LICENSE](LICENSE).
