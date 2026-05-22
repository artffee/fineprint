/**
 * scripts/build-es.js
 *
 * Generates server-rendered Spanish copies of the marketing pages at /es/*.html
 * by applying the i18n dictionary at build time.
 *
 * Why:
 *   The runtime i18n.js swaps text client-side, which is great for UX but
 *   invisible to Googlebot — Google indexes the English HTML it crawls and
 *   never sees the Spanish version. Real Spanish-language SEO requires
 *   Spanish text to exist in the response body. This script renders that.
 *
 * What it does for each English page:
 *   1. Reads the HTML.
 *   2. For every [data-i18n="key"] element, replaces innerHTML with DICT.es[key].
 *   3. For every [data-i18n-attr="attr:key"] element, replaces the attribute.
 *   4. Updates <html lang="en"> → lang="es".
 *   5. Rewrites <title>, meta description, og/twitter title+desc using per-page
 *      "meta.<page>.title|desc" keys.
 *   6. Updates rel="canonical" → /es/<file>.html.
 *   7. Swaps hreflang alternates so en→/<file>.html and es→/es/<file>.html.
 *   8. Rewrites internal nav/footer links to point at /es/ siblings.
 *   9. Writes the result to /es/<file>.html.
 *
 * Pages without page-level meta keys still get nav+footer+hero translation,
 * which is plenty for indexing.
 */
import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "es");

// Read DICT from i18n.js by extracting the literal object (cheap regex parse —
// the file is hand-controlled so we know its shape).
function loadDict() {
    const src = fs.readFileSync(path.join(ROOT, "assets/js/i18n.js"), "utf8");
    // Find the "const DICT = {" and grab a balanced-brace slice.
    const start = src.indexOf("const DICT = {");
    if (start === -1) throw new Error("DICT not found in i18n.js");
    const open = src.indexOf("{", start);
    let depth = 0;
    let inString = null;
    let escape = false;
    let end = open;
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (escape) { escape = false; continue; }
        if (c === "\\") { escape = true; continue; }
        if (inString) {
            if (c === inString) inString = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") { inString = c; continue; }
        if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) { end = i + 1; break; }
        }
    }
    const literal = src.slice(open, end);
    // eslint-disable-next-line no-new-func
    return new Function("return " + literal)();
}

const DICT = loadDict();
const ES = DICT.es;

// Per-page meta key resolution: filename → { titleKey, descKey }
const META_KEYS = {
    "index.html":         { titleKey: "meta.home.title",    descKey: "meta.home.desc" },
    "app.html":           { titleKey: "meta.app.title",     descKey: "meta.app.desc" },
    "how-it-works.html":  { titleKey: "meta.how.title",     descKey: "meta.how.desc" },
    "pricing.html":       { titleKey: "meta.pricing.title", descKey: "meta.pricing.desc" },
    "about.html":         { titleKey: "meta.about.title",   descKey: "meta.about.desc" },
    "real-estate.html":   { titleKey: "meta.re.title",      descKey: "meta.re.desc" },
    "rent.html":          { titleKey: "meta.rent.title",    descKey: "meta.rent.desc" },
    "car.html":           { titleKey: "meta.car.title",     descKey: "meta.car.desc" },
};

// Pages to translate. Privacy/terms intentionally excluded — legal text usually
// stays in the original language by convention.
const PAGES = Object.keys(META_KEYS);

// Files that are also nice to ship as ES versions but don't need meta translation
const EXTRA_PAGES = ["waitlist.html"];

function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Replace innerHTML of every [data-i18n="key"] with ES[key].
 * Uses a single regex pass because the corpus is small and tags don't nest
 * within data-i18n elements in our markup. */
function applyTextTranslations(html) {
    return html.replace(
        /<([a-zA-Z][a-zA-Z0-9]*)([^>]*?)\sdata-i18n="([^"]+)"([^>]*?)>([\s\S]*?)<\/\1>/g,
        (m, tag, before, key, after, inner) => {
            if (ES[key] != null) {
                return `<${tag}${before} data-i18n="${key}"${after}>${ES[key]}</${tag}>`;
            }
            return m;
        }
    );
}

/* Replace specific attributes on [data-i18n-attr="attr:key, attr:key"]. */
function applyAttrTranslations(html) {
    return html.replace(
        /<([a-zA-Z][a-zA-Z0-9]*)([^>]*?)\sdata-i18n-attr="([^"]+)"([^>]*)>/g,
        (m, tag, before, spec, after) => {
            const pairs = spec.split(",").map((p) => p.trim());
            let updated = before + " data-i18n-attr=\"" + spec + "\"" + after;
            for (const pair of pairs) {
                const [attr, key] = pair.split(":").map((s) => s.trim());
                if (!attr || !key || ES[key] == null) continue;
                const val = escapeAttr(ES[key]);
                // Replace existing attribute value if present
                const re = new RegExp(`\\s${attr}="[^"]*"`, "");
                if (re.test(updated)) {
                    updated = updated.replace(re, ` ${attr}="${val}"`);
                } else {
                    updated = ` ${attr}="${val}"` + updated;
                }
            }
            return `<${tag}${updated}>`;
        }
    );
}

/* Set <html lang="es"> */
function setLang(html) {
    return html.replace(/<html([^>]*?)\slang="[^"]*"([^>]*)>/, '<html$1 lang="es"$2>');
}

/* Update <title> and meta tags using per-page meta keys. */
function applyMeta(html, file) {
    const meta = META_KEYS[file];
    if (!meta) return html;

    const title = ES[meta.titleKey];
    const desc = ES[meta.descKey];

    if (title) {
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
        html = html.replace(
            /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
            `$1${escapeAttr(title)}$2`
        );
        html = html.replace(
            /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
            `$1${escapeAttr(title)}$2`
        );
    }

    if (desc) {
        html = html.replace(
            /(<meta\s+name="description"\s+content=")[^"]*(")/,
            `$1${escapeAttr(desc)}$2`
        );
        html = html.replace(
            /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
            `$1${escapeAttr(desc)}$2`
        );
        html = html.replace(
            /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
            `$1${escapeAttr(desc)}$2`
        );
    }

    // og:locale → es_ES
    html = html.replace(
        /(<meta\s+property="og:locale"\s+content=")en_US(")/,
        '$1es_ES$2'
    );
    html = html.replace(
        /(<meta\s+property="og:locale:alternate"\s+content=")es_ES(")/,
        '$1en_US$2'
    );

    return html;
}

/* Rewrite the canonical and hreflang alternates so /es/ pages are
 * self-referentially canonical and clearly mark the EN sibling. */
function applyCanonicalAndHreflang(html, file) {
    const base = "https://fineprintdoc.com";
    const enPath = "/" + (file === "index.html" ? "" : file);
    const esPath = "/es/" + (file === "index.html" ? "" : file);

    html = html.replace(
        /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
        `$1${base}${esPath}$2`
    );
    html = html.replace(
        /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
        `$1${base}${esPath}$2`
    );

    // Rewrite hreflang block: en → /, es → /es/, x-default → /
    html = html.replace(
        /(<link\s+rel="alternate"\s+hreflang="en"\s+href=")[^"]*(")/,
        `$1${base}${enPath}$2`
    );
    html = html.replace(
        /(<link\s+rel="alternate"\s+hreflang="es"\s+href=")[^"]*(")/,
        `$1${base}${esPath}$2`
    );
    html = html.replace(
        /(<link\s+rel="alternate"\s+hreflang="x-default"\s+href=")[^"]*(")/,
        `$1${base}${enPath}$2`
    );

    return html;
}

/* Rewrite internal links inside Spanish pages so navigation stays in Spanish:
 *   href="how-it-works.html"   → href="/es/how-it-works.html"
 *   href="/app.html"           → href="/es/app.html"
 *   href="https://...", "#...", "mailto:..." → unchanged.
 * Also handle clean-URL hrefs like href="how-it-works" → "/es/how-it-works". */
function rewriteInternalLinks(html) {
    const INTERNAL_FILES = new Set([
        "index.html", "app.html", "how-it-works.html", "pricing.html",
        "about.html", "real-estate.html", "rent.html", "car.html",
        "waitlist.html", "privacy.html", "terms.html",
    ]);

    return html.replace(/href="([^"]+)"/g, (m, raw) => {
        if (!raw) return m;
        if (raw.startsWith("http://") || raw.startsWith("https://")) return m;
        if (raw.startsWith("mailto:") || raw.startsWith("tel:")) return m;
        if (raw.startsWith("#")) return m;
        if (raw.startsWith("/es/")) return m;

        // Strip query/hash for matching, but keep them on output
        const [pathPart, ...rest] = raw.split(/([?#])/);
        const tail = rest.join("");

        // Normalise leading slash
        const clean = pathPart.replace(/^\.\//, "").replace(/^\//, "");

        // privacy/terms intentionally not localized — link to the English versions
        if (clean === "privacy.html" || clean === "terms.html") return m;

        // Generated assets and known files
        if (clean.startsWith("assets/")) return m;
        if (clean.startsWith("api/")) return m;
        if (clean === "favicon.svg" || clean === "og-image.svg" || clean === "og-image.png") return m;
        if (clean === "robots.txt" || clean === "sitemap.xml") return m;
        if (clean === "r.html" || clean === "r") return m;

        // For known marketing pages, prefix with /es/
        const withoutHtml = clean.replace(/\.html$/, "");
        const withHtml = withoutHtml + ".html";
        if (INTERNAL_FILES.has(withHtml) || INTERNAL_FILES.has(clean)) {
            return `href="/es/${clean.endsWith("/") ? "" : clean.replace(/^\//, "")}${tail}"`;
        }

        return m;
    });
}

/* Run everything for a single page. */
function buildPage(file) {
    const src = path.join(ROOT, file);
    if (!fs.existsSync(src)) {
        console.warn(`[build-es] skipping (not found): ${file}`);
        return;
    }

    let html = fs.readFileSync(src, "utf8");
    html = setLang(html);
    html = applyTextTranslations(html);
    html = applyAttrTranslations(html);
    html = applyMeta(html, file);
    html = applyCanonicalAndHreflang(html, file);
    html = rewriteInternalLinks(html);

    const out = path.join(OUT_DIR, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    console.log(`[build-es] wrote ${path.relative(ROOT, out)}`);
}

/* Main */
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of [...PAGES, ...EXTRA_PAGES]) buildPage(f);

console.log(`\n[build-es] done. ${PAGES.length + EXTRA_PAGES.length} Spanish pages generated under /es/.`);
