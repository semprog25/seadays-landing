# SeaDays acquisition strategy (no spend launched)

Estimates are conservative and **not guarantees**. Germany first. Expand only after `activated_user` CPA is acceptable.

## ASO — Google Play (live)

**Now:** title `SeaDays: Cruise Trip Planner` · short “Cruise planner in 11 languages — guides, packing, expenses & crew tools.” · 10+ installs · ads + IAP · Teen.

**Issues:** almost no install volume; few/no ratings; full description is feature-led; DE listing still a known gap (`MARKETING_OWNERSHIP` checklist).

**Recommended Play Console edits (manual — not applied here):**

- Keep title. Optional test: `SeaDays: Cruise Planner`.
- Short description stay honest; do not keyword-stuff.
- Full description: lead with outcomes (plan the sailing, know the ship, organize port days) then features.
- Feature graphic: ship + “Plan your cruise in one app”.
- Localization: German first (DE/AT/CH), then EN-GB.
- Store listing experiment: feature-led vs outcome-led screenshots **after** you have enough traffic.

Do not claim live AIS, offline maps, guaranteed booking, fake awards, or inflated download counts.

## ASO — App Store (live)

**Now:** name `SeaDays` · Travel · free · 1.0.90 · 0 ratings · 8 iPhone + 8 iPad screenshots.

**Recommended App Store Connect edits (manual):**

- Name/subtitle: `SeaDays` / `Cruise Planner · 11 Languages` (already used in the ASA pack).
- Custom product pages only when creative actually differs:
  1. Default — Cruise Planner
  2. First-time cruisers
  3. Ship + port guides
  4. Itinerary / packing
- Campaign links: `https://apps.apple.com/app/id6759758357?pt=PROVIDER&ct=CAMPAIGN&mt=8`
- **Blocked:** `pt` provider token is empty until copied from App Store Connect → App Analytics → Campaigns.
- Product Page Optimization and Apple Search Ads need console access + billing.

## Google Ads (do not launch)

Eligible: **Android listing live**, **iOS listing live**. No Google Ads MCP/account was connected here.

Germany-only App campaigns when authorized:

| Campaign | Platform | Intent | Daily test |
|---|---|---|---|
| A | Android | Cruise planner | €10 |
| B | Android | Cruise ports | add after A has 30+ activations |
| C | Android | First-time cruisers | add after A |
| D | iOS | Cruise planner | €5–10 after Android activation is known |

Conversion: Firebase `activated_user` (and `first_open` as a diagnostic, not the bid target).

Asset themes: see `CREATIVE_SPECS.md`. Google App campaigns mix text, image, and video — supply a diverse set; do not optimize for cheap installs.

## Apple Ads (blocked)

Account signup was started (2026-08-03) but billing / $100 credit was not finished. No campaigns created.

After billing: Brand Exact €5/day + Category Exact €5/day (keywords in app-repo `ASA_ASO_LAUNCH_PACK_2026-08-03.md`). Negatives: AIS, live tracking, cruise jobs, dating, cheap tickets.

## Reddit organic (do not automate)

Sitewide: contribute first; keep self-promo well under ~10% of history; disclose when it is your app. **Read live sidebar rules before every post.**

| Community | Stance (verify live) | How to show up |
|---|---|---|
| r/Cruise, r/cruises | Often **no advertising / strict self-promo** | Answer port-day, packing, first-cruise questions. Mention SeaDays only if it genuinely answers the question. Prefer `seadays.app/download/?campaign=organic_reddit` over a store dump. |
| r/travel, r/solotravel, r/familytravel, r/travelhacks, r/AskTravel | Usually anti-spam; links only when asked | Same: answer first. No launch threads unless a weekly self-promo thread exists. |
| r/IMadeThis / similar builder subs | Promo sometimes allowed | Optional founder post with honest “looking for cruisers with a trip booked” — not the first activity on a new account. |

Useful answer topics (no manufactured threads):

- How much time to get back to the ship?
- How do you plan a port day?
- What do first-time cruisers forget?
- How do you organize excursions / itinerary?

Never: mass comments, vote manipulation, bought accounts, or automated posting.

## Reddit Ads (do not launch)

Reddit supports app-install campaigns. Test €10–15/day **after** website `/download/` + store links are live in production:

- A cruise planner · B first-time · C port-day · D ship discovery

Optimize to activated users, not CPC. Kill any ad with high CTR and near-zero activations.

## Budget scenarios (estimates, Germany, 2026)

Assumptions labeled **estimate**: Android CPI €2.50–4.50 · iOS CPI €4–8 · click-to-install 25–40% · install-to-activated 20–30% · Play traffic is currently tiny (10+ installs), so early CPIs can be worse.

| Daily | Clicks (est.) | Installs (est.) | Target CPI | Target CPA (`activated_user`) | Break-even note |
|---|---|---|---|---|---|
| €10 | 40–80 | 3–8 | ≤ €3.50 Android | ≤ €12–18 | Test only. Need ~30 activations before judging. |
| €20 | 80–160 | 6–16 | ≤ €3.50 | ≤ €12–18 | Still test. One platform (Android DE). |
| €50 | 200–400 | 15–40 | ≤ €3.00 | ≤ €10–15 | Growth only if test CPA is at or below target. |
| €100 | 400–800 | 30–80 | ≤ €2.80 | ≤ €8–12 | Scale only with retention + a path to premium. |

Premium LTV is unknown at this volume. Do not scale until 7-day retention and activation rate are measured. Freemium + ads means a free activated user still has value, but **not** enough to justify unbounded CPI.

## Policy

Follow Google Ads / Play promotion, Apple advertising, Reddit ads, and each subreddit’s rules. Never use fake urgency, fake rankings, fake reviews, fake awards, fake download counts, forced installs, misleading notifications, spam comments, or incentivized fake reviews.
