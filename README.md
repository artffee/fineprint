# FinePrint — Contract Reader

Free AI-powered contract reader for real estate, rent and car agreements. Drop in a contract, get a 90-second risk report.

This repo contains both the marketing site and the working analyzer backend.

## Quick start

```bash
# 1. Install
npm install

# 2. Add your Gemini API key (free, no credit card)
#    Get one at https://aistudio.google.com/app/apikey
cp .env.example .env
# Edit .env and set GEMINI_API_KEY

# 3. Run
npm start

# Visit http://localhost:3000
```

## How it works

- **Frontend** — static HTML/CSS/JS in this folder. Open `index.html` directly to see the marketing site without a backend.
- **Backend** — `server.js` is an Express app that serves the static files and exposes `POST /api/analyze`. The endpoint accepts a PDF upload or pasted text, plus a contract type (real-estate / rent / car) and a party perspective, and returns structured JSON.
- **LLM** — Google Gemini 2.0 Flash via the official SDK, with a structured prompt that returns risk score, level, verdict, and flagged clauses. Forced JSON output mode.

If the backend is unreachable (e.g. you opened `index.html` from disk) the analyzer page falls back to a deterministic mock report so the demo still works.

## API

### `GET /api/health`

Returns `{ ok: true, model, hasKey }`.

### `POST /api/analyze`

`multipart/form-data` or `application/json`:

| field           | type   | required               | notes                                       |
|-----------------|--------|------------------------|---------------------------------------------|
| `file`          | file   | one of `file` or `text`| PDF or plain text, max 4 MB                 |
| `text`          | string |                        | Pasted contract text                        |
| `contract_type` | string | recommended            | `real-estate`, `rent`, or `car`             |
| `party`         | string | recommended            | depends on type — buyer/seller/tenant/lessee|
| `notes`         | string | optional               | up to 500 chars                             |

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
  "contractType": "real-estate",
  "model": "gemini-2.0-flash",
  "truncated": false
}
```

Errors return `{ error: "..." }` with a 4xx/5xx status.

## Deploying

The app deploys as either a long-running Node process **or** a single serverless function. See [`DEPLOY.md`](DEPLOY.md) for step-by-step Vercel + Namecheap instructions.

- **Vercel** (recommended, free) — `api/index.js` wraps the Express app for serverless. Static files served from the edge.
- **Render / Railway / Fly.io / Koyeb** — long-running Node process. Set `GEMINI_API_KEY` as a secret, start command `npm start`.

## Tech

- Node 20+
- Express 4
- `@google/generative-ai` (Gemini 2.0 Flash)
- `pdf-parse` for PDF text extraction
- `multer` for upload handling

## License

MIT. Engine prompts, risk taxonomy, and frontend — all open. See [LICENSE](LICENSE).
