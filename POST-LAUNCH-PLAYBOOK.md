# Las Palmas Mexican Restaurant — Post-Launch Triangulation Playbook

**Site:** laspalmasmexicanrest.com (staging: las-palmas-website.pages.dev)
**Locations:** Riverside (Rome), Shorter Ave (Rome), Rockmart, Cartersville
**Deploy-ready:** 2026-06-05 · **DNS cutover target:** July 2026 (Glenn's call)
**Owner:** Chuck Pfahler / LiveWire Media

This playbook covers the cross-property work that makes Google trust the site.
The site alone doesn't move local rankings — consistent NAP, photos, hours,
and menu across GBP + citations + social is what triangulates trust. Work
the phases in order; don't skip.

**Master NAP (byte-for-byte, from config.json — the single source of truth):**

| Location | Address | Phone | Location page |
|---|---|---|---|
| Riverside | 311 Riverside Pkwy NE, Rome, GA 30161 | 706-235-0555 | /riverside/ |
| Shorter | 246 Shorter Ave NW, Rome, GA 30165 | 706-291-9788 | /shorter/ |
| Rockmart | 1422 Chattahoochee Dr, Rockmart, GA 30153 | 678-685-4135 | /rockmart/ |
| Cartersville | 140 Main St Mkt Pl SE, Cartersville, GA 30121 | 770-386-2977 | /cartersville/ |

---

## Phase 0 — Pre-Deployment (final mile, before July cutover)

- [ ] All 12 pages validated with Google Rich Results Test (JSON-LD parse-validated locally; run the live test on staging URLs)
- [ ] PageSpeed mobile 90+ confirmed on every page (run against las-palmas-website.pages.dev)
- [ ] sitemap.xml + robots.txt sanity-checked ✅ (serving on staging)
- [ ] 301 redirects from old GHL URLs mapped in _redirects ✅ (crawled live site 2026-06-05; all verified on staging incl. /armuchee + /dalton → /locations/)
- [ ] Cloudflare account verified (`wrangler whoami` = chuckp@livewiremediapartners.com) ✅
- [ ] **Rockmart geo pin:** schema coordinates are street-level only (Nominatim couldn't resolve #1422). Cross-check against the GBP pin and correct config.json + /rockmart/ schema before launch
- [ ] **Real photos from Glenn:** all hero/story/social imagery is currently his designed SVG art. Per-location photo folders (Hero/Food/Interior/Staff) in the Drive are empty — chase Glenn; photos must be UNIQUE per location, never reused
- [ ] All click-to-call numbers tested on a real phone (all 4 locations)
- [ ] All click-to-load maps tested — confirm each opens the correct listing
- [ ] GitHub: authenticate the LiveWire account (`gh auth login`), push the repo, connect it to the Pages project for CI deploys
- [ ] Decide deferred pages: /chat/ + /feedback/ (need backends), /drinks/ (no data exists — currently 302 → /menu/), Join Our Team form backend (fields built, submit removed)

## Phase 1 — Launch Day (July 2026)

- [ ] Attach laspalmasmexicanrest.com to the Pages project; DNS cutover from GHL
- [ ] Confirm SSL active on the apex domain
- [ ] The pages.dev noindex header is host-scoped — production domain indexes automatically, no code change needed
- [ ] Test every page on mobile + desktop: click-to-call, maps, all 4 ordering links (3× order.online + LiveWire Orders for Cartersville)
- [ ] Verify /tacopete redirect still points at the live VIP portal
- [ ] Google Search Console: verify domain property, submit sitemap.xml
- [ ] Bing Webmaster Tools: import from GSC, submit sitemap
- [ ] Spot-check the 301s from Google's old index (search site:laspalmasmexicanrest.com, click results, confirm redirects)
- [ ] Smoke test from a different network / phone
- [ ] Watch Cloudflare Analytics for 404s for 24–48h; patch _redirects for any missed old URLs

## Phase 2 — Week 1: Google Business Profile per Location

GBP is priority #1 per the Chowly 2026 playbook. Do each location separately.
**Critical: each GBP's Website URL points to its LOCATION PAGE, not the homepage.**

### Riverside — Rome, GA
- [ ] Claim & verify GBP (postcard 5–14 days; don't edit Name/Address/Category during verification)
- [ ] Website URL → https://laspalmasmexicanrest.com/riverside/
- [ ] NAP byte-for-byte: 311 Riverside Pkwy NE, Rome, GA 30161 · 706-235-0555
- [ ] Hours: Mon–Fri 11–10 · Sat 11–10:30 · Sun 11–10 (+ holiday hours)
- [ ] 10+ photos: exterior, interior, food, staff
- [ ] Menu integrated; primary category Mexican Restaurant
- [ ] Launch Google Post announcing the new site + karaoke Thursdays
- [ ] Attributes: dine-in, takeout, delivery, full bar

### Shorter Ave — Rome, GA (the 1997 original)
- [ ] Same block; Website URL → /shorter/ · 246 Shorter Ave NW, Rome, GA 30165 · 706-291-9788
- [ ] Hours: Sun–Thu 11–10 · Fri 11–10:30 · Sat 11–10
- [ ] Lean into "original since 1997" in the GBP description
- [ ] Socials all @laspalmas_shorter — keep NAP consistent there too

### Rockmart, GA
- [ ] Same block; Website URL → /rockmart/ · 1422 Chattahoochee Dr, Rockmart, GA 30153 · 678-685-4135
- [ ] Hours: Sun–Thu 11–10 · Fri–Sat 11–10:30
- [ ] **Fix the geo-pin check from Phase 0 here**
- [ ] Note: Rockmart has its own FB (LasPalmasMexicanCuisineRockmart) + TikTok

### Cartersville, GA
- [ ] Same block; Website URL → /cartersville/ · 140 Main St Mkt Pl SE, Cartersville, GA 30121 · 770-386-2977
- [ ] Hours: Sun–Thu 11–10 · Fri–Sat 11–10:30
- [ ] Ordering is LiveWire Orders (not order.online) — make sure GBP "Order" link matches

## Phase 3 — Week 1–2: Citation Triangulation

Exact NAP match on every property. Even "Street" vs "St." weakens local SEO.
Track in a master NAP doc; fix one property at a time. ×4 locations each:

### Tier 1 (must-do)
- [ ] Yelp — claim, NAP, website = location page URL
- [ ] TripAdvisor
- [ ] Apple Maps (Apple Business Connect)
- [ ] Bing Places
- [ ] Facebook page NAP + website (note: each location has its OWN FB page)
- [ ] Instagram bio (brand account + @laspalmas_shorter)

### Tier 2 (high-value)
- [ ] DoorDash listing NAP (order.online = DoorDash storefront — verify all 3)
- [ ] GrubHub / UberEats listings if present
- [ ] Yellow Pages
- [ ] Rome Floyd Chamber (Riverside + Shorter), Polk County Chamber (Rockmart), Cartersville-Bartow Chamber
- [ ] Foursquare

### Tier 3 (long-tail)
- [ ] Georgia tourism / visitor bureau listings (Rome, Cartersville)
- [ ] NW Georgia food bloggers' "best Mexican" lists
- [ ] Local press: Rome News-Tribune, Daily Tribune News (Cartersville)

## Phase 4 — Week 2–4: Review System Activation

Per Chowly: 76% read reviews, 77% check before reserving, 94% read management
responses, 53% will leave a review if asked after a positive experience.

Per location:
- [ ] QR code on receipts → GBP review page
- [ ] Staff trained on the ask at positive moments ("If you enjoyed your meal…")
- [ ] Email/SMS follow-up template (one-tap review link)
- [ ] Response templates: positive (thank by name, mention dish, invite back) / negative (acknowledge, make right, take offline)
- [ ] Response SLA: 24h ideal, 48h max; assign a named review-response owner
- [ ] Once GBP ratings are live: wire real aggregateRating into each location page's Restaurant schema (deliberately omitted at build — never fabricate)

## Phase 5 — Ongoing Monthly Cadence

- [ ] Google Posts 1–2/week per location (karaoke nights, specials, events)
- [ ] Photo refresh: 5–10 new per location per month
- [ ] Menu changes synced site + GBP within 48h (menu data lives in /menu/index.html + JSON-LD)
- [ ] Specials changes: update BOTH the location page and /specials/ (they must never contradict)
- [ ] Every review answered within SLA
- [ ] Citation audit quarterly (Tier 1+2 NAP re-verify)
- [ ] PageSpeed re-check quarterly
- [ ] Local backlinks: chamber events, Rome/Cartersville press, food bloggers

---

## Notes

- Triangulation thesis: Google trusts a restaurant when the same NAP + hours +
  menu + photos + brand appear consistently across GBP + citations + reviews +
  social. The site is the anchor; the rest are corroboration.
- 39% of multi-location restaurants lack location pages — Las Palmas now has
  four full standalone Restaurant entities with parentOrganization linkage.
- 107% visibility lift cited for hyperlocal location pages.
- Closed locations: Armuchee + Dalton 301 → /locations/. If their old GBP
  listings still exist, mark them permanently closed (do NOT delete — closed
  listings still pass brand signals).
- Source: [Chowly 2026 Restaurant SEO Playbook](https://chowly.com/resources/blogs/how-to-tackle-restaurant-seo-a-guide-to-top-google-rankings-in-2026/)
