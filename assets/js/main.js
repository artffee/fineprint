/* FinePrint — site interactions */

(function () {
    "use strict";

    /* ---------- Mobile nav ---------- */
    const nav = document.querySelector(".nav");
    const hamburger = document.querySelector(".nav__hamburger");
    if (hamburger && nav) {
        hamburger.addEventListener("click", () => nav.classList.toggle("is-open"));
        document.querySelectorAll(".nav__link").forEach((a) =>
            a.addEventListener("click", () => nav.classList.remove("is-open"))
        );
    }

    /* ---------- Animated terminal on homepage ---------- */
    const term = document.querySelector("[data-terminal]");
    if (term) {
        const SCENES = [
            {
                cmd: "$ fineprint read lease.pdf --party=tenant",
                steps: [
                    "» extracting clauses ............... 38 found",
                    "» benchmarking against state cap ... 2.1s",
                    "» translating ...................... 6.4s",
                ],
                score: "── RISK 7.8 / 10 ── HIGH (tenant)",
                flags: [
                    { c: "crit", t: "● CRITICAL  Deposit = 2.5 months. State cap is 2." },
                    { c: "warn", t: "● HIGH      Late fee compounds daily after grace." },
                    { c: "warn", t: "● HIGH      Forfeits full term on early exit." },
                    { c: "value", t: "● MEDIUM    Entry on 12h notice — likely under your state law." },
                ],
                verdict: "VERDICT  Don't sign before three changes.",
            },
            {
                cmd: "$ fineprint read purchase.pdf --party=buyer",
                steps: [
                    "» extracting clauses ............... 47 found",
                    "» risk-scoring ..................... 4.1s",
                    "» translating ...................... 8.7s",
                ],
                score: "── RISK 7.4 / 10 ── HIGH (buyer)",
                flags: [
                    { c: "crit", t: "● CRITICAL  Earnest money non-refundable after 3 days." },
                    { c: "warn", t: "● HIGH      Inspection period limited to 5 days." },
                    { c: "value", t: "● MEDIUM    HOA docs delivered 2 days pre-close." },
                ],
                verdict: "VERDICT  Negotiate before earnest money lands.",
            },
            {
                cmd: "$ fineprint read auto-purchase.pdf --party=buyer",
                steps: [
                    "» extracting clauses ............... 29 found",
                    "» itemising add-ons ................ 3.0s",
                    "» translating ...................... 5.2s",
                ],
                score: "── RISK 7.2 / 10 ── HIGH (buyer)",
                flags: [
                    { c: "crit", t: "● CRITICAL  Sold AS-IS — no warranty." },
                    { c: "warn", t: "● HIGH      Mandatory binding arbitration." },
                    { c: "warn", t: "● HIGH      $3,847 in bundled add-ons." },
                    { c: "value", t: "● MEDIUM    APR 'subject to lender confirmation'." },
                ],
                verdict: "VERDICT  Don't sign at the desk.",
            },
        ];

        let sceneIdx = 0;
        function buildLines(scene) {
            return [
                { text: scene.cmd, cls: "prompt" },
                ...scene.steps.map((t) => ({ text: t, cls: "label" })),
                { text: "", cls: "" },
                { text: scene.score, cls: "warn" },
                { text: "", cls: "" },
                ...scene.flags.map((f) => ({ text: f.t, cls: f.c })),
                { text: "", cls: "" },
                { text: scene.verdict, cls: "ok" },
                { text: "", cls: "" },
                { text: "$ ▌", cls: "prompt" },
            ];
        }
        let lines = buildLines(SCENES[sceneIdx]);

        const target = term.querySelector(".terminal__body");
        let lineIdx = 0;
        let charIdx = 0;
        let currentEl = null;

        function tick() {
            if (lineIdx >= lines.length) {
                setTimeout(reset, 4000);
                return;
            }
            const line = lines[lineIdx];
            if (charIdx === 0) {
                currentEl = document.createElement("span");
                currentEl.className = "terminal__line " + (line.cls || "");
                target.appendChild(currentEl);
                target.appendChild(document.createElement("br"));
            }
            if (charIdx < line.text.length) {
                currentEl.textContent += line.text.charAt(charIdx);
                charIdx++;
                const delay = line.text.length > 30 ? 8 : 18;
                setTimeout(tick, delay);
            } else {
                lineIdx++;
                charIdx = 0;
                setTimeout(tick, line.text === "" ? 80 : 160);
            }
        }

        function reset() {
            target.innerHTML = "";
            lineIdx = 0;
            charIdx = 0;
            sceneIdx = (sceneIdx + 1) % SCENES.length;
            lines = buildLines(SCENES[sceneIdx]);
            tick();
        }

        tick();
    }

    /* ---------- Party toggle for example report ---------- */
    document.querySelectorAll("[data-party-toggle]").forEach((wrap) => {
        const buttons = wrap.querySelectorAll("button");
        const reports = document.querySelectorAll("[data-party-report]");

        buttons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const party = btn.dataset.party;
                buttons.forEach((b) => b.classList.toggle("is-active", b === btn));
                reports.forEach((r) => {
                    r.classList.toggle("hidden", r.dataset.partyReport !== party);
                });
            });
        });
    });

    /* ---------- Analyzer page: real backend with mock fallback ---------- */
    const analyzer = document.querySelector("[data-analyzer]");
    if (analyzer) {
        const form = analyzer.querySelector("form");
        const drop = analyzer.querySelector("[data-drop]");
        const fileInput = analyzer.querySelector('input[type="file"]');
        const result = analyzer.querySelector("[data-result]");
        const fileLabel = drop.querySelector(".drop__label");

        // Detect if a real backend is reachable
        let backendReady = null; // null=unknown, true=available, false=mock-only
        const isFileProtocol = window.location.protocol === "file:";
        if (isFileProtocol) {
            backendReady = false;
        } else {
            fetch("/api/health")
                .then((r) => (r.ok ? r.json() : null))
                .then((h) => {
                    backendReady = Boolean(h && h.hasKey);
                    if (!backendReady) renderModeBanner("mock");
                })
                .catch(() => {
                    backendReady = false;
                    renderModeBanner("mock");
                });
        }

        function renderModeBanner(mode) {
            const existing = analyzer.querySelector("[data-mode-banner]");
            if (existing) existing.remove();
            const banner = document.createElement("div");
            banner.dataset.modeBanner = "1";
            banner.className = "info info--warn";
            banner.innerHTML =
                mode === "mock"
                    ? "<strong>Demo mode.</strong> Real backend not detected — analysis uses example data. Run <code>npm start</code> with <code>ANTHROPIC_API_KEY</code> set to enable live analysis."
                    : "";
            analyzer.querySelector(".wrap").prepend(banner);
        }

        ["dragenter", "dragover"].forEach((ev) =>
            drop.addEventListener(ev, (e) => {
                e.preventDefault();
                drop.classList.add("is-drag");
            })
        );
        ["dragleave", "drop"].forEach((ev) =>
            drop.addEventListener(ev, (e) => {
                e.preventDefault();
                drop.classList.remove("is-drag");
            })
        );
        drop.addEventListener("drop", (e) => {
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                fileLabel.textContent = e.dataTransfer.files[0].name;
            }
        });
        drop.addEventListener("click", () => fileInput.click());
        drop.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInput.click();
            }
        });
        fileInput.addEventListener("change", () => {
            if (fileInput.files.length) {
                fileLabel.textContent = fileInput.files[0].name;
            }
        });

        // When contract type changes, swap the party options to match
        const typeSelect = form.querySelector('[name="contract_type"]');
        const partySelect = form.querySelector('[name="party"]');
        const partyOptions = {
            "real-estate": [
                { v: "buyer", l: "Buyer" },
                { v: "seller", l: "Seller" },
                { v: "investor", l: "Investor" },
            ],
            "rent": [
                { v: "tenant", l: "Tenant" },
                { v: "landlord", l: "Landlord" },
                { v: "cosigner", l: "Co-signer" },
            ],
            "car": [
                { v: "buyer", l: "Buyer" },
                { v: "lessee", l: "Lessee" },
                { v: "seller", l: "Seller (private sale)" },
            ],
        };
        function syncPartyOptions() {
            if (!typeSelect || !partySelect) return;
            const opts = partyOptions[typeSelect.value] || partyOptions["real-estate"];
            partySelect.innerHTML = opts
                .map((o) => `<option value="${o.v}">${o.l}</option>`)
                .join("");
        }
        if (typeSelect) {
            typeSelect.addEventListener("change", syncPartyOptions);
            // If query string ?type=rent etc., preselect
            const urlType = new URLSearchParams(window.location.search).get("type");
            if (urlType && partyOptions[urlType]) {
                typeSelect.value = urlType;
                syncPartyOptions();
            }
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const contractType = (typeSelect && typeSelect.value) || "real-estate";
            const party = partySelect.value;
            const text = form.querySelector('[name="text"]').value.trim();
            const notes = (form.querySelector('[name="notes"]') || {}).value || "";
            const hasFile = fileInput.files.length > 0;

            if (!hasFile && text.length < 200) {
                result.innerHTML = `
                    <div class="info info--danger">
                        Paste at least a few paragraphs of contract text, or upload a PDF.
                    </div>`;
                return;
            }

            // Render loader
            const useMock = backendReady === false;
            result.innerHTML = `
                <div class="loader">
                    <div class="spinner"></div>
                    <div class="result__empty"><p class="loader__title">Analyzing contract…</p></div>
                    <div class="loader__lines" id="loaderLines"></div>
                </div>`;

            const steps = useMock
                ? [
                      "Extracting clauses",
                      "Categorizing language",
                      "Scoring risk per clause",
                      "Translating to plain English",
                      "Drafting negotiation priorities",
                      "Compiling final report",
                  ]
                : [
                      "Uploading contract",
                      "Extracting clauses",
                      "Calling Claude",
                      "Scoring risk",
                      "Compiling report",
                  ];

            const linesEl = result.querySelector("#loaderLines");
            steps.forEach((s, i) => {
                const el = document.createElement("div");
                el.innerHTML = `<span class="pending">[ ]</span> ${s}…`;
                linesEl.appendChild(el);
                setTimeout(() => {
                    el.innerHTML = `<span class="done">[✓]</span> ${s}`;
                }, 280 + i * 320);
            });

            if (useMock) {
                setTimeout(
                    () => renderReport(mockReport(contractType, party)),
                    280 + steps.length * 320 + 200
                );
                return;
            }

            // Real backend
            try {
                const body = new FormData();
                if (hasFile) body.append("file", fileInput.files[0]);
                body.append("text", text);
                body.append("party", party);
                body.append("notes", notes);
                body.append("contract_type", contractType);

                const res = await fetch("/api/analyze", { method: "POST", body });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: res.statusText }));
                    throw new Error(err.error || `Server returned ${res.status}`);
                }
                const data = await res.json();
                renderReport(data);
            } catch (err) {
                result.innerHTML = `
                    <div class="info info--danger">
                        <strong>Analysis failed.</strong> ${escapeHtml(err.message)}<br/>
                        Falling back to specimen report so you can preview the UI.
                    </div>`;
                setTimeout(() => {
                    result.insertAdjacentHTML(
                        "beforeend",
                        renderReportHtml(mockReport(contractType, party))
                    );
                }, 600);
            }
        });

        function renderReport(data) {
            result.innerHTML = renderReportHtml(data);
        }

        function renderReportHtml(data) {
            const flagsHtml = (data.flags || [])
                .map(
                    (f) => `
                <div class="flag flag--${f.sev}">
                    <div class="flag__head">
                        <span class="badge badge--${f.sev}">${f.sev}</span>
                        <span class="flag__title">${escapeHtml(f.title)}</span>
                    </div>
                    ${f.quote ? `<p class="flag__quote">"${escapeHtml(f.quote)}"</p>` : ""}
                    <p class="flag__plain">${escapeHtml(f.plain)}</p>
                </div>`
                )
                .join("");

            const levelClass = data.levelClass || levelClassFromScore(data.score);
            const scoreColor = {
                green: "var(--green)",
                amber: "var(--amber)",
                rust: "var(--rust)",
                red: "var(--red)",
            }[levelClass];
            const priority = (data.flags || []).filter(
                (f) => f.sev === "critical" || f.sev === "high"
            ).length;

            return `
                <div class="report report--bare">
                    <div class="report__head">
                        <div>
                            <div class="report__meta">FinePrint Analysis · ${new Date().toLocaleDateString()}</div>
                            <div class="report__meta report__meta--gold">Perspective: ${(data.party || "").toUpperCase()}${data.model ? ` · ${escapeHtml(data.model)}` : ""}</div>
                        </div>
                        <button class="btn btn--ghost" type="button" onclick="window.print()">Save PDF</button>
                    </div>

                    <div class="report__score report__score--${levelClass}">
                        <div>
                            <div class="report__score-num" style="color: ${scoreColor};">${Number(data.score).toFixed(1)}</div>
                            <div class="report__score-label">Risk Score · ${escapeHtml(data.level)}</div>
                        </div>
                        <div class="report__meta report__meta--right">${(data.flags || []).length} flags<br/>${priority} priority</div>
                    </div>

                    ${flagsHtml}

                    ${data.verdict ? `
                    <div class="report__verdict">
                        <strong>Verdict</strong>
                        ${escapeHtml(data.verdict)}
                    </div>` : ""}

                    ${data.truncated ? `
                    <div class="info info--warn">
                        Contract was longer than the analysis window — only the first portion was analyzed. For full coverage, split it or use the Pro/Enterprise tier.
                    </div>` : ""}

                    <div class="helper-note">
                        <strong>A sharper read, not a legal opinion</strong>
                        Bring this briefing to a licensed real-estate attorney for any binding decision. FinePrint makes their time more valuable — not optional.
                    </div>
                </div>`;
        }

        function levelClassFromScore(s) {
            if (s == null) return "amber";
            if (s <= 3.5) return "green";
            if (s <= 5.5) return "amber";
            if (s <= 7.5) return "rust";
            return "red";
        }

        function escapeHtml(s) {
            return String(s || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }

        function mockReport(contractType, party) {
            const data = MOCKS[contractType] && MOCKS[contractType][party];
            if (data) return { ...data, party };
            // Fallback to real-estate buyer
            return { ...MOCKS["real-estate"].buyer, party: "buyer" };
        }

        const MOCKS = {
            "real-estate": {
                buyer: {
                    score: 7.4,
                    level: "HIGH",
                    levelClass: "rust",
                    verdict:
                        "Don't sign as-is. There are three clauses tilted heavily against the buyer. Negotiate before earnest money is deposited.",
                    flags: [
                        {
                            sev: "critical",
                            title: "Earnest money becomes non-refundable in 3 days",
                            quote:
                                "Earnest money shall be deemed non-refundable upon expiration of 72 hours from execution…",
                            plain:
                                "If anything goes wrong after 3 days — inspection issues, financing falling through, title problems — you lose your deposit.",
                        },
                        {
                            sev: "high",
                            title: "Inspection period limited to 5 calendar days",
                            quote:
                                "Buyer shall have five (5) calendar days from acceptance to complete all inspections…",
                            plain:
                                "Industry standard is 10–14 days. 5 days makes it nearly impossible to schedule inspectors, review reports, and request repairs.",
                        },
                        {
                            sev: "medium",
                            title: "HOA documents delivered 2 days before closing",
                            quote:
                                "Seller shall provide all HOA-related disclosures no less than 48 hours prior to closing…",
                            plain:
                                "You won't have time to review the HOA bylaws, fees, and special assessments before you're locked in.",
                        },
                    ],
                },
                seller: {
                    score: 3.8,
                    level: "MEDIUM",
                    levelClass: "amber",
                    party: "seller",
                    verdict:
                        "This contract is favorable to you as the seller. One clause is worth a quick fix, but you're in a strong position.",
                    flags: [
                        {
                            sev: "high",
                            title: "Repair credit cap is missing",
                            quote:
                                "Seller agrees to make all repairs requested by buyer following inspection…",
                            plain:
                                "Without a cap, you could be on the hook for unlimited repair costs. Add a $5,000 cap or convert to a credit.",
                        },
                        {
                            sev: "medium",
                            title: "Closing date is flexible at buyer's discretion",
                            quote:
                                "Closing to occur within 45 days, subject to buyer's reasonable adjustment…",
                            plain:
                                "Buyer can drag closing. Set a firm date with per-diem fees if they delay.",
                        },
                        {
                            sev: "medium",
                            title: "Personal property list is undefined",
                            quote:
                                "All personal property of an attached nature shall convey with the sale…",
                            plain:
                                'The phrase "attached nature" is ambiguous. Specify which items convey (e.g., washer, dryer, fridge).',
                        },
                    ],
                },
                investor: {
                    score: 5.6,
                    level: "MEDIUM-HIGH",
                    levelClass: "rust",
                    verdict:
                        "Workable for a long-hold strategy, problematic for a flip. The clauses below cut into your margin.",
                    flags: [
                        {
                            sev: "high",
                            title: "Title insurance paid by buyer",
                            quote: "Buyer shall, at buyer's sole expense, obtain owner's title insurance…",
                            plain: "In this market, seller usually pays. This adds ~$1,500 to your closing costs.",
                        },
                        {
                            sev: "high",
                            title: "Assignment clause is restricted",
                            quote: "This contract may not be assigned without written consent of the seller…",
                            plain: "If your strategy is to wholesale, you cannot assign this contract to another buyer. Negotiate 'and/or assigns' into your name line.",
                        },
                        {
                            sev: "medium",
                            title: "Property as-is clause is broad",
                            quote: "Property is sold AS-IS, with no representations or warranties of any kind…",
                            plain: "Hidden defects discovered post-close are your problem. Get a thorough inspection and price accordingly.",
                        },
                    ],
                },
            },

            "rent": {
                tenant: {
                    score: 7.8,
                    level: "HIGH",
                    levelClass: "rust",
                    verdict:
                        "Don't sign before three changes. The deposit cap, the late-fee structure, and the early-termination clause all need a closer look — and at least two of them are negotiable in your state.",
                    flags: [
                        {
                            sev: "critical",
                            title: "Security deposit is two and a half months",
                            quote: "Tenant shall pay a security deposit equal to two and one-half (2.5) months' rent prior to occupancy…",
                            plain: "Most states cap residential security deposits at one to two months. If yours does, this clause is unenforceable for the excess — and worth refusing in writing now.",
                        },
                        {
                            sev: "high",
                            title: "Late-fee compounds daily after grace",
                            quote: "A late fee of $75 plus $15 per day shall accrue after the fifth day of the month…",
                            plain: "On an $1,800 lease that's effectively a 25% APR if you're a week late. Some courts strike this as a 'penalty' rather than liquidated damages. Negotiate to a flat fee.",
                        },
                        {
                            sev: "high",
                            title: "Early-termination forfeits the full lease",
                            quote: "Tenant breaking the lease for any reason shall forfeit all remaining rent due through the lease term…",
                            plain: "Most jurisdictions require the landlord to 'mitigate damages' — to re-rent the unit in good faith. The clause as written ignores that duty. Ask for a re-let provision capped at two months.",
                        },
                        {
                            sev: "medium",
                            title: "Automatic month-to-month at higher rent",
                            quote: "If Tenant remains in possession past the lease term, rent shall continue on a month-to-month basis at 1.5x the original rate…",
                            plain: "Renewal trap. Either negotiate the multiplier down, or set a calendar alert two months before the lease ends so you can give notice.",
                        },
                        {
                            sev: "medium",
                            title: "Landlord entry on twelve hours' notice",
                            quote: "Landlord may enter the premises for any reasonable purpose upon twelve (12) hours' notice…",
                            plain: "Most state laws require twenty-four to forty-eight hours' notice for non-emergency entry. Check yours — this clause may be unenforceable.",
                        },
                    ],
                },
                landlord: {
                    score: 3.2,
                    level: "LOW",
                    levelClass: "green",
                    verdict:
                        "Tilted in your favour overall. Two small refinements would harden the lease against the most common tenant disputes.",
                    flags: [
                        {
                            sev: "medium",
                            title: "No joint-and-several language for co-tenants",
                            quote: "Tenants A and B agree to pay rent of $2,400 per month…",
                            plain: "If one tenant skips out, you may have to chase them individually. Add an explicit 'jointly and severally liable' clause so either tenant can be pursued for the full amount.",
                        },
                        {
                            sev: "medium",
                            title: "Pet clause is silent on damage liability",
                            quote: "Tenant may keep one (1) domesticated cat or small dog under 30 lbs…",
                            plain: "No mention of pet-deposit, pet-rent, or who pays for pet damage. Add a non-refundable pet deposit or pet-rent line, plus 'any damage caused by pet is tenant's responsibility'.",
                        },
                        {
                            sev: "low",
                            title: "Notice-to-cure period is undefined",
                            quote: "Landlord may terminate this lease upon any material breach…",
                            plain: "Specify the cure window (e.g., 'after 14 days' written notice and failure to cure'). Vague termination clauses lose in court.",
                        },
                    ],
                },
                cosigner: {
                    score: 6.4,
                    level: "HIGH",
                    levelClass: "rust",
                    verdict:
                        "Co-signing this lease exposes you to the full rent for the full term — not just the deposit. Make sure you understand the worst case before you sign.",
                    flags: [
                        {
                            sev: "critical",
                            title: "Liable for full rent through lease term",
                            quote: "Co-signer guarantees payment of all sums due under this lease, including but not limited to rent, late fees, damages, and legal costs…",
                            plain: "If the tenant stops paying month seven, the landlord can come to you for months seven through twelve plus any damages. You're not a 'safety net' — you're the second wallet.",
                        },
                        {
                            sev: "high",
                            title: "Renewals bind you automatically",
                            quote: "This guaranty shall extend to any renewal, extension, or modification of this lease…",
                            plain: "If the tenant renews for another year, your guarantee renews with them — without your signature. Add 'with co-signer's written consent' or limit your guarantee to the initial term only.",
                        },
                        {
                            sev: "medium",
                            title: "No notice obligation to co-signer",
                            quote: "Landlord shall have no duty to notify Co-signer of default…",
                            plain: "You can be on the hook for months of missed rent before you know there's a problem. Add a clause requiring notice within fifteen days of any late payment.",
                        },
                    ],
                },
            },

            "car": {
                buyer: {
                    score: 7.2,
                    level: "HIGH",
                    levelClass: "rust",
                    verdict:
                        "Don't sign on the dealer's desk. There's a binding arbitration clause and a stack of add-ons that double the markup. Walk it back to the line items before you initial.",
                    flags: [
                        {
                            sev: "critical",
                            title: "Vehicle sold 'AS-IS' — no warranty",
                            quote: "Buyer acknowledges that the vehicle is sold AS-IS, with all faults, and that no warranty, express or implied, applies…",
                            plain: "If the engine fails the day after you drive it home, you have no recourse against the dealer. For a used car under a few years old this is a red flag — most dealers offer at least a powertrain warranty.",
                        },
                        {
                            sev: "high",
                            title: "Mandatory binding arbitration",
                            quote: "Any dispute arising out of this contract shall be resolved exclusively through binding arbitration administered by [arbitration body]…",
                            plain: "You give up your right to sue or join a class action. Cross it out before signing — many states allow you to opt out within 30 days, but the easiest move is refusing it on the line.",
                        },
                        {
                            sev: "high",
                            title: "Dealer add-ons are pre-bundled and non-itemised",
                            quote: "Documentation, dealer prep, fabric protection, nitrogen tires, theft etching, and extended warranty totalling $3,847…",
                            plain: "Most of these are pure margin. Nitrogen tires and fabric protection are worth roughly $50 each, not $400. Ask for the dealer to itemise and decline any line you didn't negotiate.",
                        },
                        {
                            sev: "medium",
                            title: "APR is 'subject to lender confirmation'",
                            quote: "The Annual Percentage Rate disclosed herein is preliminary and subject to confirmation by Lender…",
                            plain: "Yo-yo financing — they call you back in a week with a worse rate, and your trade-in is gone. Insist on a final, confirmed APR before you take delivery, or take the deal in writing first and finance separately.",
                        },
                    ],
                },
                lessee: {
                    score: 6.8,
                    level: "HIGH",
                    levelClass: "rust",
                    verdict:
                        "Tilted toward the leasing company. The disposition fee and excess-wear clause together can cost you a couple of thousand at turn-in. Negotiate them now.",
                    flags: [
                        {
                            sev: "high",
                            title: "Mileage cap of 10,000 per year",
                            quote: "Lessee may operate the vehicle a maximum of 10,000 miles per lease year. Excess miles charged at $0.25 per mile…",
                            plain: "Average U.S. driving is 13,500 miles per year. At $0.25 per mile, three years of normal driving costs you about $2,600 at turn-in. Either negotiate to 12k or 15k miles or pre-pay the excess for a discount.",
                        },
                        {
                            sev: "high",
                            title: "Disposition fee on return",
                            quote: "Lessee shall pay a disposition fee of $495 at lease termination, regardless of vehicle condition…",
                            plain: "A flat fee just for handing the car back. Often waivable if you lease another vehicle from the same manufacturer — but only if you ask before signing.",
                        },
                        {
                            sev: "medium",
                            title: "Excess wear is broadly defined",
                            quote: "Excess wear shall include any damage in excess of normal wear and tear, including but not limited to scratches longer than 2 inches, dents, stained interior, and worn tires…",
                            plain: "The definition is generous to the leasing company. Document the vehicle's condition with photos at delivery, and again before turn-in. Consider 'lease-end protection' if it's reasonably priced.",
                        },
                        {
                            sev: "medium",
                            title: "GAP insurance is not included",
                            quote: "Lessee acknowledges that no Guaranteed Asset Protection (GAP) coverage is provided under this lease…",
                            plain: "If the car is totalled, you may owe the difference between the insurance payout and the lease balance — sometimes thousands. Add GAP coverage either through the dealer (often cheap) or via your own insurer.",
                        },
                    ],
                },
                seller: {
                    score: 4.1,
                    level: "MEDIUM",
                    levelClass: "amber",
                    verdict:
                        "A reasonable private-sale agreement. One disclosure gap is worth fixing before you hand over the keys.",
                    flags: [
                        {
                            sev: "high",
                            title: "No 'as-is' acknowledgement signed by buyer",
                            quote: "Vehicle sold by Seller to Buyer for the sum of $14,500…",
                            plain: "Without an explicit 'as-is, no warranty' line that the buyer signs, you can be on the hook if they discover an issue after the sale. Add the clause and a separate signature for it.",
                        },
                        {
                            sev: "medium",
                            title: "Odometer disclosure is missing",
                            quote: "Vehicle: 2018 Honda Accord, VIN: …",
                            plain: "Federal law requires a written odometer disclosure on every private sale. Use your state's title or DMV form — without it the sale can be challenged later.",
                        },
                        {
                            sev: "low",
                            title: "Payment method not specified",
                            quote: "Buyer shall pay the purchase price upon delivery of the vehicle…",
                            plain: "Specify cashier's check or wire transfer only. Personal checks can bounce after the buyer has the car and signed title.",
                        },
                    ],
                },
            },
        };
    }

    /* ---------- Waitlist form ---------- */
    const waitlistForm = document.getElementById("waitlistForm");
    if (waitlistForm) {
        const msg = waitlistForm.querySelector("[data-waitlist-msg]");
        const ENDPOINT = (window.FinePrint_WAITLIST_ENDPOINT || "").trim();

        waitlistForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            msg.classList.remove("is-error");
            msg.textContent = "";

            const email = waitlistForm.email.value.trim();
            const role = waitlistForm.role.value;

            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                msg.classList.add("is-error");
                msg.textContent = "That email doesn't look right.";
                return;
            }

            if (ENDPOINT) {
                try {
                    const res = await fetch(ENDPOINT, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, role, source: "fineprint-waitlist" }),
                    });
                    if (!res.ok) throw new Error("Server returned " + res.status);
                    waitlistForm.reset();
                    msg.textContent = "You're on the list. We'll be in touch.";
                } catch (err) {
                    msg.classList.add("is-error");
                    msg.textContent = "Couldn't reach the server. Email founders@fineprintdoc.com with subject 'waitlist'.";
                }
            } else {
                // No endpoint configured — graceful fallback: open mailto
                const subject = "FinePrint waitlist signup";
                const body = `Email: ${email}\nRole: ${role || "(not provided)"}\n\nPlease add me to the FinePrint Pro early-access list.`;
                window.location.href = `mailto:founders@fineprintdoc.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                msg.textContent = "Opening your email client… if nothing happens, email founders@fineprintdoc.com.";
            }
        });
    }

    /* ---------- Scroll reveal ---------- */
    if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.classList.add("is-in");
                        io.unobserve(e.target);
                    }
                });
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
        );
        document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    } else {
        document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"));
    }

    /* ---------- Year ---------- */
    document.querySelectorAll("[data-year]").forEach((el) => {
        el.textContent = new Date().getFullYear();
    });

    /* ---------- Update mobile hamburger aria-expanded ---------- */
    if (hamburger && nav) {
        const updateAria = () => hamburger.setAttribute("aria-expanded", String(nav.classList.contains("is-open")));
        const observer = new MutationObserver(updateAria);
        observer.observe(nav, { attributes: true, attributeFilter: ["class"] });
        updateAria();
    }

})();
