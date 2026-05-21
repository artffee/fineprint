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
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL = process.env.FINEPRINT_MODEL || "gemini-2.0-flash";

if (!process.env.GEMINI_API_KEY) {
    console.warn("\n[fineprint] WARNING: GEMINI_API_KEY is not set. /api/analyze will return 503.\n");
    console.warn("[fineprint] Get a free key at https://aistudio.google.com/app/apikey\n");
}

const gemini = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null;

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
        hasKey: Boolean(process.env.GEMINI_API_KEY),
    });
});

/* -------------------- Analyze ------------------- */
app.post("/api/analyze", upload.single("file"), async (req, res) => {
    if (!gemini) {
        return res.status(503).json({
            error: "Server is not configured. Set GEMINI_API_KEY in .env (free at aistudio.google.com/app/apikey).",
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
    },
    "rent": {
        label: "rent",
        domain: "residential leases and rental agreements",
        partyLabels: { tenant: "Tenant", landlord: "Landlord", cosigner: "Co-signer" },
        focus: "lease term and renewal, security deposit (cap, deductions, return window), rent increase rules, late fees, maintenance responsibility, entry notice, subletting, pets, early-termination penalties, eviction process, automatic renewal traps, utilities, joint-and-several liability",
    },
    "car": {
        label: "car",
        domain: "vehicle purchase and lease agreements",
        partyLabels: { buyer: "Buyer", lessee: "Lessee", seller: "Seller" },
        focus: "purchase price, dealer fees and add-ons, trade-in valuation, financing terms (APR, total cost of credit), warranty (express, implied, 'as-is' waiver), lemon-law disclosure, arbitration clauses, mileage limits (lease), excess-wear definition (lease), disposition fee, GAP insurance, title and registration, repossession rights",
    },
};

function normalizeContractType(raw) {
    const v = (raw || "").toString().toLowerCase().trim();
    if (v === "rent" || v === "lease") return "rent";
    if (v === "car" || v === "auto" || v === "vehicle") return "car";
    return "real-estate";
}

/* -------------------- LLM call ------------------- */
// Uses Google Gemini (free tier). System prompt + structured-JSON output mode.
async function analyzeWithClaude({ text, party, notes, contractType }) {
    const ct = CONTRACT_TYPES[contractType] || CONTRACT_TYPES["real-estate"];

    const systemInstruction = `You are FinePrint, an AI contract analyzer specialising in ${ct.domain}. Your job is to read the document and surface clauses that materially affect the named party's interests.

Output a JSON object with EXACTLY this shape:

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

Rules:
- score reflects risk TO THE NAMED PARTY only.
- Map score → level: LOW <=3.5, MEDIUM <=5.5, HIGH <=7.5, CRITICAL >7.5.
- Map level → levelClass: LOW=green, MEDIUM=amber, HIGH=rust, CRITICAL=red.
- Return 3–7 flags. Prioritize by severity. Critical first.
- "quote" must be a real substring of the input. If you cannot find one, omit that flag.
- "plain" must NEVER quote the contract again — explain the consequence in plain English.
- Never claim to provide legal advice. The verdict should suggest action, not give legal counsel.
- If the document does not appear to be a ${ct.domain} contract, return a single flag with sev "critical", title "Wrong contract type", and explain.`;

    const userMsg = `Contract type: ${ct.label.toUpperCase()}
Party: ${party.toUpperCase()}
${notes ? `Notes from user: ${notes}\n` : ""}
Contract text follows between <CONTRACT> tags.

<CONTRACT>
${text}
</CONTRACT>

Respond with the JSON object only.`;

    const model = gemini.getGenerativeModel({
        model: MODEL,
        systemInstruction,
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000,
            // Force JSON response — no markdown fences, no commentary.
            responseMimeType: "application/json",
        },
    });

    const result = await model.generateContent(userMsg);
    const raw = result.response.text().trim();

    // Gemini's responseMimeType="application/json" usually returns clean JSON,
    // but defend in depth: strip optional code fences and salvage the object.
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
            throw new Error("Gemini did not return valid JSON.");
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
