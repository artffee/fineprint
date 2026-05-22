/* FinePrint — runtime i18n.
 * Marks: any element with data-i18n="key" → innerHTML is swapped from DICT[lang][key].
 * Base language is English. Spanish is opt-in via the nav toggle or ?lang=es URL param.
 * Choice persists in localStorage; we do NOT auto-detect from the browser locale.
 */
(function () {
    "use strict";

    const SUPPORTED = ["en", "es"];
    const DEFAULT_LANG = "en";
    const STORAGE_KEY = "fineprint.lang";

    const DICT = {
        en: {
            /* Nav */
            "nav.how": "How It Works",
            "nav.realestate": "Real Estate",
            "nav.rent": "Rent",
            "nav.car": "Car",
            "nav.about": "About",
            "nav.analyze": "Analyze Free",
            "nav.pricing": "Pricing",
            "nav.skip": "Skip to content",
            "nav.open_menu": "Open menu",

            /* Hero (homepage) */
            "hero.badge": "FREE · OPEN SOURCE · MIT",
            "hero.title": "Know what<br/>you're signing <span class=\"accent\">before</span><br/>you sign.",
            "hero.sub": "Drop a real-estate, rental, or vehicle contract into FinePrint. In ninety seconds you get a plain-English risk read, the three things worth negotiating, and a verdict you can take to your attorney.",
            "hero.cta_primary": "Analyze a Contract",
            "hero.cta_secondary": "See how it reads",
            "hero.meta_account": "No account",
            "hero.meta_free": "Free, always",
            "hero.meta_speed": "Ninety-second read",

            /* Promise strip */
            "promise.types": "Contract types",
            "promise.time": "Avg. analysis time",
            "promise.cost": "What it costs",
            "promise.license": "License · open source",

            /* Three types section */
            "types.kicker": "What It Reads",
            "types.title": "Three contracts most people<br/><span class=\"italic-accent\">sign without reading.</span>",
            "types.lead": "Different paperwork, same problem: long, dense, and tilted toward whoever drafted it. FinePrint reads each one against the standards for that type of agreement.",
            "types.re_title": "Real estate",
            "types.re_body": "Purchase agreements, FSBO contracts, listing agreements. Earnest money, inspection, financing, title, HOA, closing.",
            "types.re_cta": "Read about real estate",
            "types.rent_title": "Rent &amp; lease",
            "types.rent_body": "Apartment leases, sublets, co-signer guarantees. Deposit caps, late fees, entry rules, early-termination penalties.",
            "types.rent_cta": "Read about rent",
            "types.car_title": "Car",
            "types.car_body": "New and used vehicle purchase, lease agreements, private sales. APR, add-ons, arbitration, mileage caps, GAP, lemon-law.",
            "types.car_cta": "Read about car",

            /* How section */
            "how.kicker": "The Read",
            "how.title": "A second pair of eyes.<br/><span class=\"italic-accent\">In ninety seconds.</span>",
            "how.lead": "FinePrint reads contracts the way a senior attorney in the relevant practice area would — clause by clause, in context, against your side of the table. It surfaces what's worth a closer look so your attorney's time is spent on the questions that matter.",
            "how.step1_t": "Bring the contract",
            "how.step1_p": "PDF, image, or pasted text — real estate, rent, or car.",
            "how.step2_t": "Pick the type and your side",
            "how.step2_p": "Buyer or tenant or lessee — FinePrint reframes the same clause from your perspective.",
            "how.step3_t": "Read the briefing",
            "how.step3_p": "A risk score, the three to seven things worth flagging, and a one-paragraph verdict.",
            "how.step4_t": "Take it to your attorney",
            "how.step4_p": "Bring the report. Ask the sharp questions. Sign — or don't — with eyes open.",

            /* Testimonials */
            "testi.kicker": "The Effect",
            "testi.title": "From \"what does this mean\"<br/>to <span class=\"italic-accent\">\"here's what to ask.\"</span>",

            /* OSS */
            "oss.kicker": "Open Source",
            "oss.title": "Audit every line. <span class=\"italic-accent\">Run your own.</span>",
            "oss.lead": "The engine, the prompts, the risk taxonomies for all three contract types — public on GitHub under MIT license. Self-host if you want sovereignty over the data. Fork if you want to ship your own version. We're not gating clarity behind a paywall, and we don't intend to.",
            "oss.cta_primary": "Read the source",
            "oss.cta_secondary": "How it reads",

            /* Final CTA */
            "cta.kicker": "The Ask",
            "cta.title": "Stop signing things<br/>you <span class=\"italic-accent\">haven't read.</span>",
            "cta.body": "Free. Ninety seconds. No account. Real estate, rent, or car — you'll know more about your contract than ninety-five percent of people do.",
            "cta.primary": "Analyze a Contract",
            "cta.note": "No account · Free · Open source",

            /* Footer */
            "footer.tag": "An AI contract reader for real estate, rent and car agreements. Free, open source, built to help.",
            "footer.disc_strong": "A helper, not a lawyer",
            "footer.disc": "FinePrint is a second pair of eyes — it surfaces what's worth asking about. For binding decisions on your contract, a licensed attorney is still the right call. We make their time more valuable.",
            "footer.reads": "Reads",
            "footer.product": "Product",
            "footer.company": "Company",
            "footer.f_re": "Real estate",
            "footer.f_rent": "Rent &amp; lease",
            "footer.f_car": "Car",
            "footer.f_app": "Analyze Free",
            "footer.f_how": "How It Works",
            "footer.f_pricing": "Pricing",
            "footer.f_about": "About",
            "footer.f_github": "GitHub",
            "footer.f_contact": "Contact",
            "footer.f_privacy": "Privacy",
            "footer.f_terms": "Terms",

            /* Analyzer app */
            "app.kicker": "Free Analyzer",
            "app.title": "Analyze your contract.",
            "app.sub": "Upload a PDF or paste the text. Choose your side of the table. Get a plain-English risk read in ninety seconds. Your contract is processed and discarded — we don't store it.",
            "app.section1": "One · Your Contract",
            "app.drop_label": "Drop a PDF — or click",
            "app.drop_hint": "PDF, DOCX, TXT, or image · up to 25 MB",
            "app.divider": "or paste below",
            "app.text_label": "Contract text",
            "app.text_ph": "Paste the full contract text. Even partial sections work — FinePrint will read what you give it.",
            "app.section2": "Two · What kind of contract",
            "app.type_label": "Contract type",
            "app.type_re": "Real estate (purchase / FSBO)",
            "app.type_rent": "Rent / lease agreement",
            "app.type_car": "Car (purchase or lease)",
            "app.party_label": "Read from the side of",
            "app.notes_label": "Anything specific to look for? (optional)",
            "app.notes_ph": "e.g. deposit terms, late fees, mileage cap",
            "app.submit": "Analyze Contract",
            "app.foot": "Free · Stateless · Open source",
            "app.empty_title": "Your report will appear here.",
            "app.empty_1": "Upload a PDF, or paste the text",
            "app.empty_2": "Pick your side",
            "app.empty_3": "Click <em>Analyze Contract</em>",
            "app.empty_4": "Read the briefing",
            "app.privacy_strong": "What happens to my contract?",
            "app.privacy_body": "Nothing, after it's read. The file is sent to the analyzer, processed in memory, and the response is returned to you. We don't keep a copy. For full sovereignty, self-host the open-source engine.",
            "app.helper_strong": "A helper, not a lawyer",
            "app.helper_body": "FinePrint is a sharper read of your contract. It surfaces what's worth asking about — not a legal opinion. For binding decisions on your deal, please bring this to a licensed attorney in your jurisdiction. We make their time more valuable.",

            /* Page-level metadata — used by the SSR build to translate
               <title>, <meta description>, og/twitter tags per page.
               Keys follow the pattern: meta.<page>.<title|desc>. */
            "meta.home.title": "FinePrint — Free AI Contract Reader for Real Estate, Rent & Car",
            "meta.home.desc": "Upload any real-estate, lease, or vehicle contract. Get a plain-English risk read in ninety seconds. Free. No account. Open-source. EN/ES.",
            "meta.app.title": "Analyze Free · FinePrint — AI Contract Reader",
            "meta.app.desc": "Upload a real-estate, rent, or car contract. Get a plain-English risk read in 90 seconds. Free, no account.",
            "meta.how.title": "How FinePrint Reads a Contract",
            "meta.how.desc": "Six stages: ingest, extract, score, translate, prioritize, deliver. Forty-plus clauses tracked per contract type.",
            "meta.pricing.title": "Pricing — Free, Always · FinePrint",
            "meta.pricing.desc": "FinePrint is free for unlimited contract analysis. No tiers, no upsells, no subscription. Open source under MIT.",
            "meta.about.title": "About — The Team Behind FinePrint",
            "meta.about.desc": "We build tools that make real estate, rent, and car paperwork transparent. The story behind FinePrint.",
            "meta.re.title": "Real Estate Contract Review — AI-Powered · FinePrint",
            "meta.re.desc": "Purchase agreements, FSBO, listing agreements. Earnest money, inspection, financing, title — flagged in plain English. Free.",
            "meta.rent.title": "Lease & Rental Agreement Review · FinePrint",
            "meta.rent.desc": "Apartment leases, sublets, co-signer guarantees. Deposit caps, late fees, entry rules. Free AI read.",
            "meta.car.title": "Car Purchase & Lease Contract Review · FinePrint",
            "meta.car.desc": "Vehicle purchase, lease, private-sale. APR traps, dealer add-ons, arbitration, mileage caps. Free AI read.",

            /* Lang toggle */
            "lang.en": "EN",
            "lang.es": "ES",
        },

        es: {
            /* Nav */
            "nav.how": "Cómo Funciona",
            "nav.realestate": "Inmuebles",
            "nav.rent": "Alquiler",
            "nav.car": "Auto",
            "nav.about": "Nosotros",
            "nav.analyze": "Analizar Gratis",
            "nav.pricing": "Precios",
            "nav.skip": "Saltar al contenido",
            "nav.open_menu": "Abrir menú",

            /* Hero (homepage) */
            "hero.badge": "GRATIS · CÓDIGO ABIERTO · MIT",
            "hero.title": "Sabé qué estás<br/>firmando <span class=\"accent\">antes</span><br/>de firmarlo.",
            "hero.sub": "Subí un contrato inmobiliario, de alquiler o de vehículo a FinePrint. En noventa segundos obtenés una lectura de riesgo en español claro, las tres cosas que vale la pena negociar, y un veredicto que podés llevarle a tu abogado.",
            "hero.cta_primary": "Analizar un Contrato",
            "hero.cta_secondary": "Ver cómo lee",
            "hero.meta_account": "Sin cuenta",
            "hero.meta_free": "Gratis, siempre",
            "hero.meta_speed": "Lectura en 90 segundos",

            /* Promise */
            "promise.types": "Tipos de contrato",
            "promise.time": "Tiempo promedio",
            "promise.cost": "Cuánto cuesta",
            "promise.license": "Licencia · código abierto",

            /* Types */
            "types.kicker": "Qué Lee",
            "types.title": "Tres contratos que la mayoría<br/><span class=\"italic-accent\">firma sin leer.</span>",
            "types.lead": "Papeles distintos, mismo problema: largos, densos, y redactados a favor de quien los escribió. FinePrint lee cada uno contra los estándares de su tipo.",
            "types.re_title": "Inmuebles",
            "types.re_body": "Contratos de compraventa, ventas particulares (FSBO), contratos de listado. Seña, inspección, financiación, título, consorcio, escrituración.",
            "types.re_cta": "Leer sobre inmuebles",
            "types.rent_title": "Alquiler",
            "types.rent_body": "Contratos de alquiler, sublocaciones, garantías de cosigner. Depósitos, intereses por mora, reglas de entrada, penalizaciones por rescisión.",
            "types.rent_cta": "Leer sobre alquiler",
            "types.car_title": "Auto",
            "types.car_body": "Compra de vehículos nuevos y usados, contratos de leasing, ventas particulares. APR, extras, arbitraje, límites de kilometraje, GAP, ley lemon.",
            "types.car_cta": "Leer sobre autos",

            /* How */
            "how.kicker": "La Lectura",
            "how.title": "Un segundo par de ojos.<br/><span class=\"italic-accent\">En noventa segundos.</span>",
            "how.lead": "FinePrint lee los contratos como lo haría un abogado experimentado en el área — cláusula por cláusula, en contexto, desde tu lado de la mesa. Te muestra lo que vale la pena revisar, así el tiempo de tu abogado se dedica a las preguntas que importan.",
            "how.step1_t": "Subí el contrato",
            "how.step1_p": "PDF, imagen, o texto pegado — inmueble, alquiler o auto.",
            "how.step2_t": "Elegí el tipo y tu lado",
            "how.step2_p": "Comprador, inquilino o leasing — FinePrint replantea la misma cláusula desde tu perspectiva.",
            "how.step3_t": "Leé el resumen",
            "how.step3_p": "Un puntaje de riesgo, las tres a siete cosas que vale la pena señalar, y un veredicto en un párrafo.",
            "how.step4_t": "Llevalo a tu abogado",
            "how.step4_p": "Llevá el informe. Hacé las preguntas correctas. Firmá — o no — con los ojos abiertos.",

            /* Testimonials */
            "testi.kicker": "El Efecto",
            "testi.title": "De «qué significa esto»<br/>a <span class=\"italic-accent\">«esto es lo que tengo que preguntar».</span>",

            /* OSS */
            "oss.kicker": "Código Abierto",
            "oss.title": "Auditá cada línea. <span class=\"italic-accent\">Corré tu propia copia.</span>",
            "oss.lead": "El motor, los prompts, las taxonomías de riesgo para los tres tipos de contrato — públicos en GitHub bajo licencia MIT. Auto-hospedalo si querés soberanía sobre los datos. Forkealo si querés sacar tu propia versión. No vamos a esconder la claridad detrás de un paywall.",
            "oss.cta_primary": "Leer el código",
            "oss.cta_secondary": "Cómo lee",

            /* Final CTA */
            "cta.kicker": "El Pedido",
            "cta.title": "Dejá de firmar cosas<br/>que <span class=\"italic-accent\">no leíste.</span>",
            "cta.body": "Gratis. Noventa segundos. Sin cuenta. Inmueble, alquiler o auto — vas a saber más sobre tu contrato que el noventa y cinco por ciento de la gente.",
            "cta.primary": "Analizar un Contrato",
            "cta.note": "Sin cuenta · Gratis · Código abierto",

            /* Footer */
            "footer.tag": "Un lector de contratos con IA para inmuebles, alquileres y autos. Gratis, código abierto, hecho para ayudar.",
            "footer.disc_strong": "Una ayuda, no un abogado",
            "footer.disc": "FinePrint es un segundo par de ojos — te muestra lo que vale la pena preguntar. Para decisiones vinculantes sobre tu contrato, un abogado matriculado sigue siendo lo correcto. Nosotros hacemos que su tiempo valga más.",
            "footer.reads": "Lee",
            "footer.product": "Producto",
            "footer.company": "Empresa",
            "footer.f_re": "Inmuebles",
            "footer.f_rent": "Alquiler",
            "footer.f_car": "Auto",
            "footer.f_app": "Analizar Gratis",
            "footer.f_how": "Cómo Funciona",
            "footer.f_pricing": "Precios",
            "footer.f_about": "Nosotros",
            "footer.f_github": "GitHub",
            "footer.f_contact": "Contacto",
            "footer.f_privacy": "Privacidad",
            "footer.f_terms": "Términos",

            /* App */
            "app.kicker": "Analizador Gratis",
            "app.title": "Analizá tu contrato.",
            "app.sub": "Subí un PDF o pegá el texto. Elegí tu lado de la mesa. Conseguí una lectura de riesgo en español claro en noventa segundos. Tu contrato se procesa y se descarta — no lo guardamos.",
            "app.section1": "Uno · Tu Contrato",
            "app.drop_label": "Arrastrá un PDF — o tocá",
            "app.drop_hint": "PDF, DOCX, TXT o imagen · hasta 25 MB",
            "app.divider": "o pegá abajo",
            "app.text_label": "Texto del contrato",
            "app.text_ph": "Pegá el texto completo. Incluso secciones parciales funcionan — FinePrint lee lo que le des.",
            "app.section2": "Dos · Qué tipo de contrato",
            "app.type_label": "Tipo de contrato",
            "app.type_re": "Inmuebles (compraventa / FSBO)",
            "app.type_rent": "Alquiler / locación",
            "app.type_car": "Auto (compra o leasing)",
            "app.party_label": "Leer desde el lado de",
            "app.notes_label": "¿Algo específico que mirar? (opcional)",
            "app.notes_ph": "p. ej. depósito, intereses por mora, kilometraje",
            "app.submit": "Analizar Contrato",
            "app.foot": "Gratis · Sin estado · Código abierto",
            "app.empty_title": "Tu informe va a aparecer acá.",
            "app.empty_1": "Subí un PDF, o pegá el texto",
            "app.empty_2": "Elegí tu lado",
            "app.empty_3": "Tocá <em>Analizar Contrato</em>",
            "app.empty_4": "Leé el resumen",
            "app.privacy_strong": "¿Qué pasa con mi contrato?",
            "app.privacy_body": "Nada, después de leerlo. El archivo se envía al analizador, se procesa en memoria, y la respuesta se devuelve a vos. No guardamos copia. Para soberanía total, auto-hospedá el motor de código abierto.",
            "app.helper_strong": "Una ayuda, no un abogado",
            "app.helper_body": "FinePrint es una lectura más afilada de tu contrato. Te muestra lo que vale la pena preguntar — no es una opinión legal. Para decisiones vinculantes, llevá esto a un abogado matriculado en tu jurisdicción. Hacemos que su tiempo valga más.",

            /* Page-level metadata (Spanish) */
            "meta.home.title": "FinePrint — Lector de Contratos con IA Gratis para Inmuebles, Alquiler y Auto",
            "meta.home.desc": "Subí cualquier contrato inmobiliario, de alquiler o de vehículo. Conseguí una lectura de riesgo en español claro en noventa segundos. Gratis. Sin cuenta. Código abierto.",
            "meta.app.title": "Analizar Gratis · FinePrint — Lector de Contratos con IA",
            "meta.app.desc": "Subí un contrato de inmueble, alquiler o auto. Obtené una lectura de riesgo en español claro en 90 segundos. Gratis, sin cuenta.",
            "meta.how.title": "Cómo FinePrint Lee un Contrato",
            "meta.how.desc": "Seis etapas: ingesta, extracción, puntuación, traducción, priorización, entrega. Más de cuarenta cláusulas analizadas por tipo de contrato.",
            "meta.pricing.title": "Precios — Gratis, Siempre · FinePrint",
            "meta.pricing.desc": "FinePrint es gratis para análisis ilimitados. Sin niveles, sin upsells, sin suscripción. Código abierto bajo licencia MIT.",
            "meta.about.title": "Sobre Nosotros — El Equipo Detrás de FinePrint",
            "meta.about.desc": "Construimos herramientas que hacen los papeles inmobiliarios, de alquiler y de auto transparentes. La historia detrás de FinePrint.",
            "meta.re.title": "Revisión de Contratos Inmobiliarios con IA · FinePrint",
            "meta.re.desc": "Contratos de compraventa, FSBO, contratos de listado. Seña, inspección, financiación, título — señalados en español claro. Gratis.",
            "meta.rent.title": "Revisión de Contratos de Alquiler · FinePrint",
            "meta.rent.desc": "Contratos de alquiler, sublocaciones, garantías. Topes de depósito, intereses por mora, reglas de entrada. Lectura de IA gratis.",
            "meta.car.title": "Revisión de Contratos de Auto y Leasing · FinePrint",
            "meta.car.desc": "Compra de vehículo, leasing, venta particular. APR, extras del concesionario, arbitraje, límites de kilometraje. Lectura de IA gratis.",

            "lang.en": "EN",
            "lang.es": "ES",
        },
    };

    function resolveLang() {
        // Source of truth in this order:
        //   1. URL path:  /es/...  → Spanish.  Anything else → English.
        //   2. ?lang=es URL param  (legacy + sharing)
        //   3. localStorage        (remembers user's last toggle)
        //   4. Default English (we do NOT auto-detect from navigator.language)
        const pathname = window.location.pathname || "/";
        if (pathname.startsWith("/es/") || pathname === "/es") return "es";

        try {
            const url = new URL(window.location.href);
            const q = url.searchParams.get("lang");
            if (q && SUPPORTED.includes(q)) return q;
        } catch (_) {}
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && SUPPORTED.includes(stored)) return stored;
        } catch (_) {}
        return DEFAULT_LANG;
    }

    function urlForLang(lang) {
        // Build the equivalent URL in the requested language.
        const u = new URL(window.location.href);
        // Strip any ?lang= param — path now carries the language.
        u.searchParams.delete("lang");

        const onSpanishPath = u.pathname.startsWith("/es/") || u.pathname === "/es";
        if (lang === "es" && !onSpanishPath) {
            u.pathname = "/es" + (u.pathname.startsWith("/") ? u.pathname : "/" + u.pathname);
            if (u.pathname === "/es/") u.pathname = "/es/";
        } else if (lang === "en" && onSpanishPath) {
            u.pathname = u.pathname.replace(/^\/es(\/|$)/, "/");
            if (u.pathname === "//") u.pathname = "/";
        }
        return u.toString();
    }

    function apply(lang) {
        const dict = DICT[lang] || DICT[DEFAULT_LANG];

        document.documentElement.setAttribute("lang", lang);

        // Swap text content for [data-i18n]
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            if (dict[key] != null) el.innerHTML = dict[key];
        });

        // Attribute swaps: [data-i18n-attr="attribute:key, attribute:key"]
        document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
            const spec = el.getAttribute("data-i18n-attr");
            spec.split(",").forEach((pair) => {
                const [attr, key] = pair.split(":").map((s) => s.trim());
                if (attr && dict[key] != null) el.setAttribute(attr, dict[key]);
            });
        });

        // Lang toggle visual state
        document.querySelectorAll("[data-lang-btn]").forEach((b) => {
            b.classList.toggle("is-active", b.getAttribute("data-lang-btn") === lang);
        });
    }

    function setLang(lang, persist = true) {
        if (!SUPPORTED.includes(lang)) return;
        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
        }
        // The Spanish pages are prerendered at /es/* — navigate to the
        // equivalent URL so Google gets real Spanish HTML and the user sees
        // a full Spanish page (not just runtime-swapped text).
        const target = urlForLang(lang);
        if (target !== window.location.href) {
            window.location.href = target;
            return;
        }
        // Already on the right URL: still apply runtime swap as a safety net
        // (covers strings that aren't in the prerendered HTML, e.g. dynamic
        // analyzer output).
        apply(lang);
    }

    window.fineprintSetLang = setLang;
    window.fineprintGetLang = resolveLang;

    document.addEventListener("DOMContentLoaded", () => {
        apply(resolveLang());

        // Wire toggle clicks
        document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
            btn.addEventListener("click", () => setLang(btn.getAttribute("data-lang-btn")));
        });
    });
})();
