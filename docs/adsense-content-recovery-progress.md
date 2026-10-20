# AdSense content recovery progress

Local only. No push, merge, or deploy.

- Branch: `fix/adsense-content-recovery`
- Base: `39352dfd2` (`fix/sd28-prima-edge-rewrite`, Norwegian Prima vs Celebrity Edge)
- HEAD: `26af78dd0` (tracker). Content tip before this file: `6a5e28a3a`
- Prior local work kept: `f85a24097` SD-25/26/34, `e557d5463` SD-07, `948a93ecc` SD-28 debris, `39352dfd2` Prima/Edge
- Tests this session: `node scripts/test-blog-production-hygiene.js` PASS after each batch. `npm run test:ci-channels` not re-run (no shared generator behavior change beyond a slug filter on the override applier and holdback removals).
- Browser: Disney comparison and Carnival/MSC/Norwegian comparison on `http://127.0.0.1:8765`, 390x844 and 1440x900. Article columns do not overflow. Pre-existing starfield layer is wider than 390.

## Completed this branch

| SD | Slug | Audit priority | Action | Status | Sources | Files | Verify | Commit | Unresolved |
|---|---|---|---|---|---|---|---|---|---|
| SD-28 | disney-cruise-line-vs-royal-caribbean-best-for-families | P1 template | Sourced rewrite. Oceaneer is 3–10, not 3–12. | FIXED | Disney youth/dining FAQs; RC kids page. Checked 2026-10-20 | override + meta + published HTML + holdback removal | Hygiene PASS. Bold 1.4/100. Canonical/robots unchanged | 503fa7477 | RC’s own pages disagree on teen ages (13–17 vs 12–17). Article says confirm the sailing |
| SD-27 SD-28 | budget-cruise-lines-compared-carnival-vs-msc-vs-norwegian | P1 | Rewrite covers all three lines. MSC Yacht Club is not the base fare | FIXED | Carnival Chef’s Table; NCL dining page + older Freestyle PDF; MSC Yacht Club. 2026-10-20 | override + HTML | Hygiene PASS. MSC named. 624 words | 3891217bf | Standard Carnival/MSC included-dining pages were blocked or third-party. Do not treat Chef’s Table price as the whole dining model |
| SD-27 SD-28 | how-to-use-cruise-packing-list-for-caribbean | P1 | Caribbean list. Alaska mentioned only as the wrong list | FIXED | CDC cruise page; RC prohibited items. 2026-10-20 | override + HTML | Hygiene PASS. 633 words | 3891217bf | Island-specific sunscreen bans not verified |
| SD-28 | cruise-health-vs-travel-wellness-what-to-know | P1 | Split illness response from comfort choices | FIXED | CDC cruise page + Yellow Book. 2026-10-20 | override + HTML | Hygiene PASS. 631 words | 3891217bf | none |
| SD-28 | best-cruise-health-cost-planning-2026-guide | P1 | Costs without invented prices | FIXED | CDC Yellow Book. 2026-10-20 | override + HTML | Hygiene PASS. 648 words | 3891217bf | No line-specific medical fee. Owner must not add one without a source |
| SD-28 SD-30 | luxury-cruise-cost-guide-mistakes-to-avoid | P1 | Fare-name inclusions, Silversea as the worked example | FIXED | Silversea benefits/fares; CDC medical-not-included. 2026-10-20 | override + HTML | Hygiene PASS. 626 words | 3891217bf | Regent/Seabourn not rewritten here |
| SD-29 | cruise-packing-list-what-to-bring-and-what-to-leave-home | P1 advice | Power strip sentence replaced | FIXED | RC prohibited items. 2026-10-20 | override + HTML | Hygiene PASS. Rest of list unchanged | 6a5e28a3a | Rest of list still unsourced (reef-safe, magnetic hooks, Dramamine as default) |

## Still on SD-28 holdback

| SD | Slug | Priority | Action | Status | Notes |
|---|---|---|---|---|---|
| SD-28 SD-30 | the-hidden-stress-of-cruise-travel-and-how-to-avoid-it | P1 | Rewrite the keeper | TODO | Audit: 32 inbound links. Do not 301 yet |
| SD-28 SD-30 | why-your-cruise-feels-chaotic-without-a-planning-app | P1 | Merge into hidden-stress after real HTTP 301 | MERGE PROPOSED | ~96% overlap. GitHub Pages HTML stubs are not 301s |
| SD-28 SD-30 | budget-cruise-vs-luxury-cruise-what-to-choose | P1 | Review; likely keeper for cluster C1 | TODO | Opening already rewritten earlier. Marker scan was clean. Still holdback until a pass confirms it |
| SD-28 SD-30 | complete-guide-to-budget-cruise-vs-luxury-cruise | P1 | Merge into the what-to-choose post | MERGE PROPOSED | Needs owner 301 |
| SD-28 SD-30 | complete-guide-to-solo-cruise-vs-group-cruise | P1 | Merge into cruising-alone | MERGE PROPOSED | SD-30 C10 |
| SD-28 SD-30 | cruise-tips-vs-cruise-hacks-what-to-choose | P1 | Merge into cruise-hacks-nobody-talks-about | MERGE PROPOSED | SD-30 C6 |

## SD-27 still open

| Slug | Status | Next |
|---|---|---|
| why-balcony-cabins-sell-out-first | TODO | Body is still the midship article. Rewrite to the title or merge into the cabin-location guide. No slug change |
| the-truth-about-cruise-ship-internet-speed-test-results-myths-and-what-to-expect | TODO | Remove unsourced Mbps example or cite a measurement |
| do-cruises-actually-harm-the-environment-what-the-data-really-says-in-2026 | BLOCKED | Needs a real dataset (IMO, CLIA, or a government inventory). Do not invent tonnes |
| inside-the-most-expensive-cruise-suites-in-the-world | TODO | Name suites only from line pages with a date. Drop prices you cannot cite |

## SD-29 still open

| Slug | Status | Next |
|---|---|---|
| aidacosma-vs-msc-seashore-ship-comparison-guide | TODO | Yacht Club line is wrong if Seashore has Yacht Club. Confirm on MSC ship page, then one sentence |
| i-tried-living-on-a-cruise-ship-for-30-days-heres-what-happened | OWNER DECISION | Reframe as a guide unless someone at SeaDays did the 30 days |
| why-joining-a-roll-call-in-seadays-changes-how-you-book-shore-excursions-on-day-one | OWNER DECISION | $119 vs $52 and “verified on the same sailing” need app facts |
| trip-cost-analytics-in-seadays-where-cruisers-actually-leak-300800-per-voyage | OWNER DECISION | $300–800 claim |
| why-cruise-ship-elevators-are-always-busy | TODO | Drop or source “4,000 to 6,000 passengers” |
| top-10-cruise-ships-for-2026-features-reviews-and-experiences | TODO | Queen Anne “transatlantic style” pick is unsupported |

## SD-30 clusters (do not redirect)

Record only. Keeper suggestions from the Oct 19 audit. No HTML redirect stubs.

- C1 budget vs luxury: keeper `budget-cruise-vs-luxury-cruise-what-to-choose`
- C2 drinks: keeper `the-seadays-drink-package-calculator-math-that-tells-you-when-to-skip-the-package-entirely`
- C3 missed ship: keeper `what-happens-if-you-miss-your-cruise-ship`
- C4 sea days: keeper `what-is-a-sea-day-on-a-cruise`
- C8 planning-saves-money: four short posts, no keeper chosen
- C11 cabins: keeper should be the location guide after the balcony title is fixed

## Port and ship (not rewritten this session)

Shared publish gate already noindexes pages that fail it (`57b01a834` and later). Do not bulk-publish ports.

Still open from the master list, local tree not re-audited page by page:

- SD-01 placeholder intros, SD-02 repeated tips, SD-03 doubled country, SD-04 cut-off sentences, SD-05 Wikipedia markup
- SD-06 indexable ships: disambiguation text, German marketing, “cruise today!”
- SD-35 duplicate ports need real 301s
- SD-40 wrong specs, SD-41 noindexed wrong-subject ships stay noindexed
- SD-09 Celebrity Solstice index/sitemap only after a sourced page exists

## Next session

1. Rewrite `why-balcony-cabins-sell-out-first` to the title, or fold the midship material into `how-to-get-the-best-cruise-cabin-location-on-any-ship` and leave a note. No 301.
2. Fix Seashore Yacht Club sentence and the elevator passenger range (omit if unsourced).
3. Leave environment, 30-day diary, and SeaDays dollar claims blocked for the owner.
4. Then one shared port-template pass for SD-02/SD-03/SD-04 only if a single generator change is proven. No mass port rewrite.
