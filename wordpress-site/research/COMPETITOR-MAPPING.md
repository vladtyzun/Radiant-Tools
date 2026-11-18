# Services & Industries IA — competitor mapping vs. Radiant

Research date: 2026-11-18. Sources crawled with Playwright at 1440px; full-page screenshots in
`screenshots/`, raw extracted structure in `raw-*.json`.

| Screenshot | Page |
|---|---|
| `screenshots/www_designme_agency_services.jpg` | DesignMe services hub |
| `screenshots/www_designme_agency_industries.jpg` | DesignMe industries hub |
| `screenshots/www_designme_agency_services_product_design.jpg` | DesignMe service child |
| `screenshots/www_designme_agency_services_website_design.jpg` | DesignMe service child |
| `screenshots/www_designme_agency_industries_fintech.jpg` | DesignMe industry child |
| `screenshots/www_designme_agency_industries_b2b_saas.jpg` | DesignMe industry child |
| `screenshots/clay_global_services.jpg` | Clay services hub |
| `screenshots/clay_global_industries.jpg` | Clay industries hub |
| `screenshots/clay_global_fintech.jpg` | Clay industry child (fintech) |
| `screenshots/www_heyradiant_com.jpg` | Radiant home |
| `screenshots/www_heyradiant_com_work.jpg` | Radiant work |

---

## 1. The two competitors play different games

**DesignMe** runs a programmatic-SEO/AEO machine. 250+ indexed URLs across eight templated
directories: `/services` (15 children), `/industries` (15 children), `/migrations` (9),
`/integrations` (35), `/compare` (17), `/glossary` (45), `/locations` (7), `/tools` (6),
`/insights` (40+). Every leaf page is long (1,400–2,100 words), answer-shaped, and heavily
cross-linked. Service and industry pages are not brochures; they are landing pages engineered to
be cited by search engines and LLMs.

**Clay** runs a prestige/portfolio play. Hubs are deliberately thin (`/services` 560 words,
`/industries` 322 words) and exist mainly as navigation into visual work. The depth sits in the
industry children (`/fintech` ≈ 1,500 words) and in the case studies. Authority comes from logos
(Slack, Snapchat, Sky, Discover, Marqeta) and awards, not from word count.

**What this means for Radiant.** Radiant is a boutique studio, so Clay's logo-wall strategy is
not available and DesignMe's 250-page factory is not affordable. The winning position is
DesignMe's *page template* quality at Clay's *restraint* in page count: one excellent page per
service and per industry, each genuinely useful, each cross-linked.

---

## 2. DesignMe service page — section-by-section anatomy

Measured on `/services/product-design` (2,055 words) and `/services/website-design` (1,891).
Both follow the identical skeleton, which is the strongest evidence it is a deliberate template.

| # | Section | Purpose | Example |
|---|---|---|---|
| 1 | Eyebrow + H1 + lead + 2 CTAs | Name the service and the buyer in one line | "PRODUCT DESIGN" / "Product design **for complex software**" |
| 2 | Client logo strip | Borrowed credibility above the fold | "Worked on products for tech teams like…" |
| 3 | **Depth demo** — "From the whole flow down to one component." | Proves craft by zooming: flow → screen → state → component, on three real products | Interactive stepper |
| 4 | **Process timeline** — "How a product project runs." | Removes risk: 8 weeks, week-by-week, colour-coded "our work vs. your work" | Gantt-style |
| 5 | **Featured case study** | One deep story with named stages | "How we redesigned Ballogy's athlete app" (Audit / Redesign / Rebuild) |
| 6 | Work grid | "A few of our recent product designs." | 4–6 thumbnails |
| 7 | **Engagement models** | Two cards: one-off project vs. monthly retainer | "One project, or a product team every month." |
| 8 | **Problem grid (6 cards)** | Self-diagnosis; every card is a symptom the buyer recognises | "Where products usually lose people": Onboarding, Core flows, Activation, Empty/error states, Shared roles, System drift |
| 9 | Proof / metrics | Numbers attached to named clients | "Product work backed by real proof." |
| 10 | Testimonials | Social proof | |
| 11 | **Cross-sell** | Routes to adjacent services | "What comes after the product work?" |
| 12 | Related insights | Internal links to blog | "LEARN MORE" |
| 13 | **FAQ — 7 to 12 questions** | AEO payload, written as the exact questions buyers type | "What does a product design agency do?", "Are you a UI/UX design agency?", "How do you price product design work?" |
| 14 | Closing CTA | Same on every page | "Tell us what you're building." |

**The meaning layer.** Headings are written as *sentences with a point of view*, not labels.
"Where products usually lose people." outperforms "Common problems" because it asserts expertise.
The FAQ block is the real SEO engine: question headings match search queries verbatim, and the
answers are self-contained paragraphs an LLM can quote.

---

## 3. DesignMe industry page — section-by-section anatomy

Measured on `/industries/fintech` (1,375 words) and `/industries/b2b-saas` (1,458). Again
identical skeletons.

| # | Section | Purpose | Fintech example |
|---|---|---|---|
| 1 | Eyebrow + outcome H1 | Lead with the industry's *decisive* buying criterion | "Fintech design that **earns trust before the first call**" |
| 2 | Metric pair | Two hard numbers, immediately | "$72M raised by N3XT in stealth" / "350k+ Zave.it users in 3 months" |
| 3 | **"<INDUSTRY> DESIGN, IN SHORT" + "Updated October 2026"** | A single quotable paragraph defining the agency in this vertical, plus a 4-field fact table (Clients / Flagship result / Consumer / What we design). This is engineered to be lifted whole by ChatGPT and Perplexity. The date stamp signals freshness. | |
| 4 | **Fit qualifier — "A GOOD FIT IF" / "PROBABLY NOT A FIT IF"** | Two columns. Disqualifying yourself out loud is the single most trust-building block on the page. | Not a fit: "Teams looking for legal or compliance sign-off: we design with your counsel, we do not replace them" |
| 5 | **Thesis + 6 problem cards** — "SOUND FAMILIAR?" | Industry-specific failure modes, each with a one-sentence fix referencing real client work | "People drop out at KYC and document upload." → "We design onboarding that explains why each step exists, saves progress and shows how long is left." |
| 6 | **Stage map** | 3 tabs: Stealth/Seed → Launch/Series A → Growth/Series B+. Tells each buyer which one they are. | |
| 7 | Interactive self-assessment | "Does your fintech website answer the question 'is it safe?'" | |
| 8 | Market thesis | One macro claim with a stat | "Fintech is growing fast. Trust decides who wins it." |
| 9 | **Service cross-links (4 cards)** | "Services that matter most for fintech and payments teams" → Brand identity, Product design, Website design, Next.js development. This is what welds the two directories into one mesh. | |
| 10 | Mid-page CTA | | "Talk to us about your fintech project" |
| 11 | **FAQ — 7 industry questions** | Regulatory and process questions only this vertical asks | "What disclosures does a fintech website need?", "Does the European Accessibility Act apply to fintech?", "Do you sign NDAs and work with products in stealth?" |
| 12 | Closing CTA | | "Tell us what you're building." |

---

## 4. Clay — what to borrow

Clay's `/fintech` (1,506 words) contributes three patterns DesignMe lacks:

1. **"Our Impact"** — a stats band placed before any argument.
2. **"Where We Focus" — 10 named sub-verticals**: Financial Infrastructure, Payroll & HR Tech,
   Wealth Management, Payments, BNPL & Embedded Finance, Lending Platforms, Crypto & DeFi,
   Compliance & RegTech, Insurance & Insurtech, Digital Banking. This single list communicates
   domain depth faster than any paragraph, and it captures long-tail search.
3. **"Why Clay" — 4 credibility cards**: "In Finance Since 2008", "Based in San Francisco",
   "We Know the Hard Parts", "Trusted by Leaders". Tenure, location, hard-won knowledge, logos.

Clay's hub pages are a lesson in what *not* to copy: `/industries` at 322 words is a link list
with no argument. It works only because the brand is already famous.

### Service taxonomies compared

| DesignMe (grouped) | Clay | Radiant (current draft) |
|---|---|---|
| **Design**: brand identity, product design, mobile app design, website design, motion design, pitch deck design, AI design agency | Branding | Branding & Visual Identity |
| **Development**: Framer, Webflow, Astro, Next.js, AI MVP cleanup, migrations | Digital Products | Product Design |
| **Growth**: CRO, UX audit, SEO & AEO, AI workflows | Websites | Website Design |
| | Content | No-code Development |
| | Development | Design Systems |
| | Generative AI | Motion Design |
| | | Pitch Decks & Collaterals |

Radiant's seven pillars already map cleanly onto the competitive set. The notable gaps are
**mobile app design**, **CRO / UX audit as a standalone offer**, and an explicit **AI** service —
all three are load-bearing for both competitors in 2026.

### Industry taxonomies compared

| DesignMe (15) | Clay (12) |
|---|---|
| AI, B2B SaaS, Cybersecurity, D2C, Data & Analytics, Fintech, Healthtech, Investment firms, LegalTech, Productivity, Real estate, SaaS, Sports & fitness, Travel, Web3 | Fintech, Crypto & Web3, B2B & Enterprise Software, Technology, Ecommerce & Fashiontech, Electronics, Food & Beverage, Startups & VC, Healthcare & Life Sciences, Telecommunications, Mobility, Logistics |

Overlap both competitors agree on: **Fintech, B2B SaaS/enterprise software, Crypto/Web3,
Healthcare, Ecommerce/D2C**. Fintech is the page both of them invest in most.

---

## 5. Radiant today

| Page | Status | Notes |
|---|---|---|
| Home (6513) | published | 31KB of content; nav "Services" points to `/#services`, "FAQ" to `/#faqs` |
| Work (7630) | published | Thin — heading + post grid of 4 portfolio items |
| Blog (1173) | published | 40 posts, strong SaaS/fintech/design-system topic cluster |
| **Our Services (7363)** | **draft, no slug** | 15KB, 13 Elementor containers, seven service pillars fully written |
| Terms (1017), Privacy (3) | published | |
| Coming Soon (89) | draft | |

**There is no published services page and no industries directory at all.** Navigation resolves
"Services" to an anchor on the homepage. Competitors have 30 indexed service/industry pages
between them; Radiant has zero.

### What the existing Services draft already gives us

Containers 3–9 are seven identical, well-written blocks, each with a name, a "The challenge"
paragraph, six "We deliver" items, and an "Explore <service>" button. **Those buttons are the
tell: the parent page was written expecting child pages that were never built.**

| Pillar | CTA on the draft | Six deliverables |
|---|---|---|
| Product Design | Explore product design | UX audits, product user flows, interface design & micro-interactions, design systems, animated product visualizations, Claude prototypes |
| Website Design | Explore website design | Landing pages, SaaS websites, marketing sites, responsive design, UX writing, product visuals |
| No-code Development | Which platform to choose | Webflow, Framer, WordPress, CMS setup, motion & interactions, analytics integration |
| Design Systems | Explore design systems | Component libraries, design tokens, Figma variables, auto layout, documentation & annotations, system audits |
| Branding & Visual Identity | Explore branding | Logo system, visual identity, brand guidelines, social templates, launch assets, brand design system |
| Motion Design | Explore motion | Product animations, Lottie & SVG, Rive, UI motion, social motion assets |
| Pitch Decks & Collaterals | Sharpen your pitch deck | Investor decks, sales presentations, one-pagers, case study design, data visualization, proposal templates |

### Radiant's style guide, as derived from the live pages

Nothing in the repo documents the brand voice, so these rules are reverse-engineered from the
home page and the Services draft. **Confirm or correct before publishing.**

- **Headline form.** Two lines, declarative, full stop included. A claim, not a label.
  "Product design is a revenue function." / "Strategy, design, and animation. Partnering from day one."
- **Thesis.** Design is a business tool; every artefact must move activation, retention or
  conversion. Revenue language, never "beautiful".
- **Second person.** "Your product has users, but they're not converting." The reader is the subject.
- **Problem first, capability second.** Every pillar opens with "The challenge", then "We deliver".
- **Sentence rhythm.** Short declaratives next to one longer explanatory sentence. Em dashes for
  the turn in the argument.
- **Speed as a differentiator.** "Senior-level delivery in days, not months", "every 48 hours",
  "Three steps. No surprises."
- **Audience named explicitly.** Founders, product leaders, startups launching, SaaS teams
  scaling, companies seeking growth.
- **No jargon inflation.** Plain words for complex things. No "synergy", no "world-class".

### Elementor patterns available to clone (so new pages inherit the design system)

Pages are Elementor + UiCore + Element Pack. `_elementor_data` is readable and writable over the
REST API, so new pages can be assembled from the existing section patterns rather than typed as
raw HTML, which keeps the fonts, colour globals and spacing intact.

| Pattern | Source | Reused for |
|---|---|---|
| Hero (H1 + lead H2) | 7363 container 0 | Every new page's hero |
| Section intro (eyebrow + heading + lead) | 7363 container 2 | "In short" blocks |
| Challenge + deliver + fancy-list + button | 7363 containers 3–9 | Problem and scope sections |
| Testimonial + counters | 7363 container 10 | Proof sections |
| Three audience cards | 7363 container 11 | Fit / "who it's for" |
| Three-step process | 7363 container 12 | Process sections |
| Check-icon list, button, logo grid | 6513 (home) | Fact lists and CTAs |

---

## 6. Recommended IA for Radiant

```
/services                     (publish the existing draft 7363, slug "services")
  /services/product-design
  /services/website-design
  /services/no-code-development
  /services/design-systems
  /services/branding-visual-identity
  /services/motion-design
  /services/pitch-deck-design
/industries                   (new hub)
  /industries/fintech         ← 2 real case studies (Hawala, Walletbase)
  /industries/saas            ← strongest blog cluster
  /industries/real-estate-proptech  ← 2 real case studies (Lumen, Red Cottage)
  /industries/ai              ← where both competitors are investing hardest
  /industries/healthtech      ← aspirational, placeholders
  /industries/web3-crypto     ← aspirational, adjacent to Walletbase
```

Seven service children match the seven "Explore…" buttons already on the parent. Six industries:
two backed by real case studies, one by the content library, three aspirational and clearly
marked with placeholders.

### Page template adopted for Radiant (merging both competitors into Radiant's voice)

**Service child page**
1. Hero — eyebrow, two-line H1, lead, CTA
2. "<Service>, in short" — quotable definition paragraph + 4-field fact list *(AEO; from DesignMe)*
3. The challenge — the pillar's paragraph from the parent, expanded
4. What you get — the six deliverables, each with one explanatory line
5. Who it's for / not for — fit qualifier *(from DesignMe; highest trust-per-pixel block)*
6. How it runs — three steps, with a duration
7. Proof — testimonial + metric counters `[PLACEHOLDER]`
8. Related services — cross-links *(from DesignMe)*
9. FAQ — 6–8 verbatim buyer questions *(the SEO engine)*
10. Closing CTA

**Industry child page**
1. Hero — outcome-led H1 on this industry's decisive criterion
2. "<Industry> design, in short" + fact list + "Updated <month year>"
3. Sound familiar? — 6 industry-specific failure modes with fixes
4. Where we focus — named sub-verticals *(from Clay)*
5. What teams need by stage — seed / growth / scale
6. Services that matter most here — cross-links to the service children
7. Proof — case study + metrics `[PLACEHOLDER]`
8. FAQ — 6–8 industry-specific questions
9. Closing CTA
