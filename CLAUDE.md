# Las Palmas Mexican Restaurant — laspalmasmexicanrest.com

Static multi-location restaurant site. One repo → one Cloudflare Pages project → one domain.
Replaces the GHL corporate site. 4 active locations + corporate pages.

## Architecture decision (2026-06-04, confirmed with Chuck)

ONE domain with per-location pages (`/riverside/`, `/rockmart/`, `/shorter/`, `/cartersville/`) —
NOT separate sites per location. Per the Chowly 2026 SEO playbook: "Multi-location restaurants
should publish one unique landing page per location." Link equity compounds on one domain;
each GBP listing points at its own location page.

- **Closed locations:** Armuchee + Dalton (May 2026, ownership split). 301 old URLs → /locations/.
  Never publish content for them.
- **Source of truth for NAP/hours/geo/ordering:** `config.json`. All pages, headers, footers,
  and JSON-LD derive from it. Zero variation allowed (NAP consistency is a local SEO trust signal).
- NAP + hours verified against Glenn's JSX defaults 2026-06-04. Rockmart geo is street-level only —
  verify against GBP pin before launch.

## Source material

- Glenn's React prototypes: `~/Las Palmas Website Updates/` (Main Site + per-location folders).
  These ARE the design deliverable — convert element-for-element to static HTML, don't redesign.
- Per-location photo folders (Hero/Food/Interior/Staff) were EMPTY at build start. Chowly rule:
  location photos must be unique per location, never reused. Glenn owes photos via the Drive folder.
- SEO/build standard: Chowly 2026 playbook + `~/Liberty Collective Website/` pipeline docs +
  `~/westfield-collective/` (gold-standard template, 98/100 PageSpeed).

## Backend (Pages Functions + D1, built 2026-06-06)

- `/chat/` + `/feedback/` are LIVE pages with real backends (ported from LPChatV3.6 /
  FeedbackPortalV3; admin/Studio layers still deferred — demo auth only in prototypes).
- `functions/api/`: chat (reply+classifier+CRM log), chat-feedback (thumbs-down flag),
  feedback (D1 insert), feedback-ai (post-submit assistant, v3 JSON contract).
- `_system-prompt.js` is GENERATED from seedTraining() in Glenn's LPChatV3.6.jsx —
  regenerate from the JSX when training data changes, don't hand-edit.
- D1: `las-palmas-site` (binding `DB` via wrangler.toml; schema.sql). Tables:
  feedback_records, chat_threads, chat_messages.
- Model: GPT-5 mini (gpt-5-mini-2025-08-07) on the LAS PALMAS OpenAI key — same key+model
  as LP AI Command (lp-ai-command-center.onrender.com). BILLING RULE: Las Palmas AI usage
  must bill to the Las Palmas key, never ChowdownOS or other client keys.
- Secret: OPENAI_API_KEY via `wrangler pages secret put` (local copy: ~/LPAICommand/.env).
  NEVER in client code or wrangler.toml.
- Local dev: `wrangler pages dev . --d1=DB=las-palmas-site` (the --d1 flag is required;
  wrangler does not auto-load Pages D1 bindings locally) + `.dev.vars` for the key
  (never commit; delete after testing).

## Still deferred (marked [BACKEND REQUIRED] in Glenn's prototypes)

- Location Studio editors / homepage Studio (localStorage-based live editing)
- AI menu search
- Chat + feedback ADMIN panels (training editor, CRM views, ToS editors — passkey
  auth in the prototypes is front-end only; needs real auth first)

## SEO requirements (every page)

- Unique `<title>` 50–60 chars, location-anchored ("Authentic Mexican Food in Rome, GA" style)
- Unique meta description <160 chars, canonical, OG + Twitter card (og-share 1200x630)
- One H1; H2/H3 hierarchy; ~1 keyword per 200 words
- Location pages: standalone `Restaurant` JSON-LD (own NAP/geo/hours/telephone) +
  `parentOrganization` → brand + `BreadcrumbList`; embedded click-to-load map; hyperlocal copy
- Menu: HTML (never PDF), `MenuItem` schema, dietary labels as text, inline order CTAs
- Every phone display wrapped in `tel:` link; 48×48px minimum tap targets
- Images: WebP, descriptive filenames (`riverside-fajitas.webp`), real alt text, exact display size
- Perf: inline critical CSS, preload LCP image + fonts (self-hosted, subsetted), lazy below-fold,
  no external CSS libs/CDNs. Target: 95+ mobile PageSpeed, LCP <2.5s, CLS 0

## Deploy

- GitHub: Chuck's LiveWire account (chuckp@livewiremediapartners.com) — NOT adessocoffee/ChowdownMedia
- Cloudflare: LiveWire account (`wrangler whoami` MUST show chuckp@livewiremediapartners.com before
  any deploy — Chuck also has personal/other accounts)
- Static site, no build command, output dir = root
- **CI: pushes to main auto-deploy** via .github/workflows/deploy.yml (wrangler-action +
  CLOUDFLARE_API_TOKEN repo secret, scoped Account→Pages→Edit, created 2026-06-05).
  Manual deploy fallback: `wrangler pages deploy . --project-name las-palmas-website`
- Pushing needs `gh auth switch -u ChowdownMedia` (then switch back to adessocoffee)
- Deliverables are TWO artifacts: the site + Post-Launch Triangulation Playbook (generated at deploy-ready)

## QA before any push

```bash
grep -r "leadconnectorhq\|gohighlevel\|msgsndr" . --include="*.html"  # GHL leftovers: 0
grep -rE "fonts\.googleapis|gstatic|cdn\." . --include="*.html"       # external CDNs: 0
find . -name "index.html" | wc -l                                     # 14 pages (12 + chat + feedback)
grep -r "<iframe" . --include="*.html" | grep -v 'title='             # must be 0
# localStorage: exactly 1 hit/page is EXPECTED (the inline theme-FOUC script);
# more than that = prototype leftover, investigate.
```

## Redirect map source (2026-06-05 crawl of live GHL site)

Live GHL URLs: /home /menu /catering /employment /events /feedback /gallery
/onlineordering /coming-soon /rockmart-ds + 4 live locations + /armuchee /dalton.
Glenn's prototype nav targets /dailyspecials /tacopete /chat /drinks were 404 on
the live site (never existed). All mapped in `_redirects`; /chat /drinks /feedback
are 302 (flip to real pages when built), /tacopete 302s to laspalmas-vip.pages.dev.
