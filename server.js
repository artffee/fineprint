/**
 * FinePrint — minimal real backend.
 *
 *   POST /api/analyze     multipart (file?) + form fields (text, party, notes)
 *                         OR application/json { text, party, notes }
 *                         → { score, level, levelClass, verdict, flags: [...] }
 *
 * Static files in this folder are served at /.
 * Set ANTHROPIC_API_KEY in .env (see .env.example).
 */

import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import "dotenv/config";
import Groq from "groq-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
// Llama 3.3 70B on Groq — 128k context, JSON mode, sub-second responses,
// free tier of 14,400 reqs/day.
const MODEL = process.env.FINEPRINT_MODEL || "llama-3.3-70b-versatile";

if (!process.env.GROQ_API_KEY) {
    console.warn("\n[fineprint] WARNING: GROQ_API_KEY is not set. /api/analyze will return 503.\n");
    console.warn("[fineprint] Get a free key at https://console.groq.com\n");
}

const groq = process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;

/* -------------------- Rate limiter --------------- */
// In-memory sliding-window limiter per IP. On Vercel serverless the state
// resets on each cold start, but instances stay hot long enough that one
// bad actor hitting the same edge region still gets throttled. Good enough
// for MVP; swap to Upstash Redis later if/when needed.
const RL_PER_MIN = Number(process.env.RL_PER_MIN || 10);
const RL_PER_HOUR = Number(process.env.RL_PER_HOUR || 50);
const RL_WHITELIST = (process.env.RL_WHITELIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const ipBuckets = new Map(); // ip -> sorted array of timestamps (last hour)

function clientIp(req) {
    // Vercel + Cloudflare add forwarding headers; trust the leftmost entry.
    const fwd = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim();
    return fwd || req.ip || req.connection?.remoteAddress || "unknown";
}

function rateLimitCheck(ip) {
    if (RL_WHITELIST.includes(ip)) return { allowed: true };

    const now = Date.now();
    const HOUR = 3_600_000;
    const MIN = 60_000;

    const prior = (ipBuckets.get(ip) || []).filter((t) => now - t < HOUR);
    const lastMin = prior.filter((t) => now - t < MIN).length;

    if (lastMin >= RL_PER_MIN) {
        const oldest = prior.find((t) => now - t < MIN);
        return { allowed: false, retry: Math.ceil((MIN - (now - oldest)) / 1000), scope: "minute" };
    }
    if (prior.length >= RL_PER_HOUR) {
        const oldest = prior[0];
        return { allowed: false, retry: Math.ceil((HOUR - (now - oldest)) / 1000), scope: "hour" };
    }

    prior.push(now);
    ipBuckets.set(ip, prior);

    // Periodic GC to keep map from growing unbounded.
    if (ipBuckets.size > 5000) {
        for (const [k, v] of ipBuckets) {
            if (!v.length || now - v[v.length - 1] > HOUR) ipBuckets.delete(k);
        }
    }

    return { allowed: true, remainingMin: RL_PER_MIN - lastMin - 1, remainingHour: RL_PER_HOUR - prior.length };
}

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// File-size cap: 4 MB. Matches Vercel free-tier body limit (~4.5 MB).
// Most real-estate / lease / car PDFs are 1–3 MB. On Railway / Fly / a real
// VPS this can be raised — but parity between local and prod keeps surprises
// out of the demo.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 },
});

/* -------------------- Health -------------------- */
app.get("/api/health", (_req, res) => {
    res.json({
        ok: true,
        model: MODEL,
        hasKey: Boolean(process.env.GROQ_API_KEY),
    });
});

/* -------------------- Analyze ------------------- */
app.post("/api/analyze", upload.single("file"), async (req, res) => {
    // Rate limit first — protects even unconfigured/error paths from abuse.
    const ip = clientIp(req);
    const rl = rateLimitCheck(ip);
    if (!rl.allowed) {
        res.set("Retry-After", String(rl.retry));
        return res.status(429).json({
            error:
                rl.scope === "minute"
                    ? `Too many requests. Try again in ${rl.retry} seconds.`
                    : `Hourly limit reached on this IP. Try again in ${Math.ceil(rl.retry / 60)} minutes.`,
            retryAfter: rl.retry,
        });
    }
    if (typeof rl.remainingMin === "number") {
        res.set("X-RateLimit-Remaining-Minute", String(rl.remainingMin));
        res.set("X-RateLimit-Remaining-Hour", String(rl.remainingHour));
    }

    if (!groq) {
        return res.status(503).json({
            error: "Server is not configured. Set GROQ_API_KEY in .env (free at console.groq.com).",
        });
    }

    try {
        const party = (req.body.party || "buyer").toString().toLowerCase();
        const notes = (req.body.notes || "").toString().slice(0, 500);
        const contractType = normalizeContractType(req.body.contract_type || req.body.contractType);
        let text = (req.body.text || "").toString();

        // Extract PDF text if a file was uploaded
        if (req.file) {
            const buf = req.file.buffer;
            const mime = req.file.mimetype || "";
            if (mime.includes("pdf")) {
                const pdfText = await extractPdfText(buf);
                text = pdfText + (text ? "\n\n" + text : "");
            } else if (mime.includes("text") || mime === "" || mime.includes("plain")) {
                text = buf.toString("utf8") + (text ? "\n\n" + text : "");
            } else {
                return res.status(400).json({
                    error: `Unsupported file type: ${mime}. Upload PDF or paste text.`,
                });
            }
        }

        text = text.trim();
        if (text.length < 200) {
            return res.status(400).json({
                error: "Provide a real-estate contract — at least a few paragraphs of text.",
            });
        }

        // Truncate to keep token cost predictable
        const MAX_CHARS = 80_000;
        const truncated = text.length > MAX_CHARS;
        if (truncated) text = text.slice(0, MAX_CHARS);

        const result = await analyzeWithClaude({ text, party, notes, contractType });
        result.truncated = truncated;
        result.model = MODEL;
        result.contractType = contractType;
        res.json(result);
    } catch (err) {
        console.error("[fineprint] /api/analyze error:", err);
        res.status(500).json({
            error: err?.message || "Analysis failed.",
        });
    }
});

/* -------------------- PDF helper ---------------- */
async function extractPdfText(buffer) {
    // Lazy-import so pdf-parse doesn't run its self-test on cold start
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text || "";
}

/* -------------------- Contract types ------------ */
const CONTRACT_TYPES = {
    "real-estate": {
        label: "real-estate",
        domain: "real estate (purchase agreements, listing agreements, FSBO contracts, lease-to-own)",
        partyLabels: { buyer: "Buyer", seller: "Seller", investor: "Investor" },
        focus: "earnest money, inspection contingency, financing/appraisal, repair credits, closing date, title insurance, HOA delivery timing, assignment, as-is clauses, default and specific performance, environmental disclosures",
        callouts: `Specific patterns to ALWAYS flag if present:
- Earnest-money deposit non-refundable in under 7 days → CRITICAL (industry standard is 10–14 days)
- Inspection contingency window < 7 calendar days → HIGH (10 days is standard)
- "Time is of the essence" with no cure period for either side → HIGH
- HOA / condo / co-op disclosures delivered fewer than 5 business days before closing → MEDIUM-HIGH (most state-mandated disclosure windows are longer)
- Assignment forbidden without written consent + seller approval discretionary → HIGH for investors, MEDIUM for buyers
- Broad as-is sale without inspection contingency → CRITICAL for buyer
- Specific-performance remedy reserved only to one side → HIGH (unbalanced)
- Liquidated damages clauses that allow seller to keep deposit AND sue → HIGH-CRITICAL`,
    },
    "rent": {
        label: "rent",
        domain: "residential leases and rental agreements",
        partyLabels: { tenant: "Tenant", landlord: "Landlord", cosigner: "Co-signer" },
        focus: "lease term and renewal, security deposit (cap, deductions, return window), rent increase rules, late fees, maintenance responsibility, entry notice, subletting, pets, early-termination penalties, eviction process, automatic renewal traps, utilities, joint-and-several liability",
        callouts: `Specific patterns to ALWAYS flag if present:
- Security deposit > 2 months' rent → CRITICAL. Most U.S. states cap residential deposits at 1–2 months; anything above is likely unenforceable above the cap. Say so explicitly.
- Landlord entry notice < 24 hours (e.g. 12-hour notice) → HIGH. Most state statutes require 24–48 hours' notice for non-emergency entry. Likely unenforceable.
- "Landlord shall have no obligation to mitigate damages" → CRITICAL. Most states impose a statutory duty on landlords to mitigate by re-renting. This clause is typically unenforceable. Tell the tenant they have leverage to negotiate a re-let provision.
- Late fees that compound daily after a grace period (e.g. $X/day) → HIGH if the annualised rate exceeds 18%. Many courts strike per-diem late fees as unenforceable penalties.
- Automatic renewal at a multiplier of original rent (e.g. 1.5× holdover rate) → MEDIUM. Often legal but punitive; user needs to know to give notice.
- "No notice required for non-payment eviction" → HIGH. Almost universally unenforceable; statutes require a notice-to-cure period.
- "Waiver of right to jury trial" → MEDIUM-HIGH
- "Tenant pays all landlord's attorney fees in any dispute" → HIGH. Many states require mutual fee-shifting if any is allowed.`,
    },
    "car": {
        label: "car",
        domain: "vehicle purchase and lease agreements",
        partyLabels: { buyer: "Buyer", lessee: "Lessee", seller: "Seller" },
        focus: "purchase price, dealer fees and add-ons, trade-in valuation, financing terms (APR, total cost of credit), warranty (express, implied, 'as-is' waiver), lemon-law disclosure, arbitration clauses, mileage limits (lease), excess-wear definition (lease), disposition fee, GAP insurance, title and registration, repossession rights",
        callouts: `Specific patterns to ALWAYS flag if present:
- Vehicle sold "AS-IS" with all warranty waivers → CRITICAL for late-model used cars (under ~3 years). Note: some states (CT, ME, MA, MN, NJ, NY, RI, WV, WA, DC) prohibit "as-is" sales on used cars and the clause is unenforceable there.
- Mandatory binding arbitration clause → HIGH. Tell the buyer to look for the opt-out window (often 30 days from signing) and how to exercise it. Federal Magnuson-Moss Warranty Act limits arbitration enforceability for warranty disputes.
- APR or finance terms "subject to lender approval" without a hard cap → HIGH. This is the yo-yo financing trap. Tell buyer to demand a final, signed financing agreement before driving off.
- Bundled dealer add-ons not itemised (theft etching, fabric protection, nitrogen tires, extended service contracts) → HIGH. These are usually pure markup; itemise them in the flag's "plain" field with rough fair-value estimates.
- Mileage cap below ~12k/year on a 3-year lease → HIGH. U.S. average driving is ~13,500/year. Calculate the overage cost (excess miles × per-mile fee) and call it out.
- Disposition fee at lease end with no waiver option → MEDIUM. Often negotiable, especially for re-leasing customers.
- Excess wear-and-tear defined as "any" damage rather than "beyond normal" → HIGH. Recommend documenting condition with photos at delivery.
- No GAP insurance disclosed on a leased or financed vehicle → MEDIUM. Tell buyer/lessee they could owe thousands if the car is totaled before the loan/lease is paid down.`,
    },
};

function normalizeContractType(raw) {
    const v = (raw || "").toString().toLowerCase().trim();
    if (v === "rent" || v === "lease") return "rent";
    if (v === "car" || v === "auto" || v === "vehicle") return "car";
    return "real-estate";
}

/* -------------------- LLM call ------------------- */
// Uses Groq (Llama 3.3 70B). OpenAI-compatible chat completion with forced
// JSON output mode (response_format: json_object).
async function analyzeWithClaude({ text, party, notes, contractType }) {
    const ct = CONTRACT_TYPES[contractType] || CONTRACT_TYPES["real-estate"];

    const systemPrompt = `You are FinePrint, an AI contract analyzer specialising in ${ct.domain}. Your job is to read the document and surface clauses that materially affect the named party's interests.

You MUST respond with a JSON object having EXACTLY this shape:

{
  "score": number (1.0 to 10.0, one decimal, overall risk to the named party),
  "level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "levelClass": "green" | "amber" | "rust" | "red",
  "verdict": string (1-3 sentences, plain English, what the party should do),
  "flags": [
    {
      "sev": "critical" | "high" | "medium" | "low",
      "title": short title (max ~60 chars),
      "quote": short verbatim quote from the contract (max ~200 chars, exact text),
      "plain": plain-English explanation of why this matters to the named party (1-3 sentences)
    }
  ]
}

Focus areas for ${ct.domain}: ${ct.focus}.

${ct.callouts}

Rules:
- score reflects risk TO THE NAMED PARTY only.
- Map score → level: LOW <=3.5, MEDIUM <=5.5, HIGH <=7.5, CRITICAL >7.5.
- Map level → levelClass: LOW=green, MEDIUM=amber, HIGH=rust, CRITICAL=red.
- Return 3–7 flags. Prioritize by severity. Critical first.
- "quote" must be a real substring of the input. If you cannot find one, omit that flag.
- "plain" must NEVER quote the contract again — explain the consequence in plain English.
- When a clause is likely UNENFORCEABLE under typical state law (e.g. mandatory mitigation duty, deposit caps, minimum entry-notice periods), flag it as CRITICAL or HIGH and say so in plain English so the user knows they have leverage.
- Never claim to provide legal advice. The verdict should suggest action, not give legal counsel.
- If the document does not appear to be a ${ct.domain} contract, return a single flag with sev "critical", title "Wrong contract type", and explain.
- Respond ONLY with the JSON object. No commentary, no markdown, no code fences.`;

    const userMsg = `Contract type: ${ct.label.toUpperCase()}
Party: ${party.toUpperCase()}
${notes ? `Notes from user: ${notes}\n` : ""}
Contract text follows between <CONTRACT> tags.

<CONTRACT>
${text}
</CONTRACT>

Respond with the JSON object only.`;

    const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        // Force JSON response — Groq's Llama 3.3 supports OpenAI-style JSON mode.
        response_format: { type: "json_object" },
    });

    const raw = (completion.choices?.[0]?.message?.content || "").trim();

    // Defend in depth: strip optional code fences and salvage the JSON object.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (e) {
        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");
        if (first !== -1 && last !== -1) {
            parsed = JSON.parse(cleaned.slice(first, last + 1));
        } else {
            throw new Error("Groq did not return valid JSON.");
        }
    }

    return normalize(parsed, party);
}

function normalize(obj, party) {
    const out = {
        score: Number(obj.score) || 5.0,
        level: (obj.level || "MEDIUM").toString().toUpperCase(),
        levelClass: (obj.levelClass || "amber").toString().toLowerCase(),
        verdict: (obj.verdict || "").toString().trim(),
        flags: Array.isArray(obj.flags) ? obj.flags : [],
        party,
    };
    out.flags = out.flags.slice(0, 7).map((f) => ({
        sev: (f.sev || "medium").toString().toLowerCase(),
        title: (f.title || "Untitled").toString().slice(0, 200),
        quote: (f.quote || "").toString().slice(0, 500),
        plain: (f.plain || "").toString().slice(0, 800),
    }));
    return out;
}

/* -------------------- Static -------------------- */
app.use(express.static(__dirname, { extensions: ["html"] }));

// Friendly 404 → home
app.use((req, res) => {
    if (req.method === "GET" && req.accepts("html")) {
        return readFile(path.join(__dirname, "index.html"), "utf8")
            .then((html) => res.status(404).send(html))
            .catch(() => res.status(404).send("Not found"));
    }
    res.status(404).json({ error: "Not found" });
});

// Export the app so Vercel (api/index.js) can wrap it as a serverless function.
// Only call listen() when this file is executed directly (`node server.js` or
// `npm start`), not when it's imported as a module by the serverless wrapper.
const isDirectRun =
    import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
    process.argv[1]?.endsWith("server.js");

if (isDirectRun) {
    app.listen(PORT, () => {
        console.log(`\nFinePrint running at  http://localhost:${PORT}\n`);
    });
}

export default app;
