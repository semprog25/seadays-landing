# AdSense content recovery progress

Local only. No push, merge, or deploy.

- Branch: `fix/adsense-content-recovery`
- Base: `39352dfd2` (Norwegian Prima vs Celebrity Edge)
- Content commits after the last tracker: `e5fb58338`, `5a88fdfa5`, `7f3e2543b`, plus the stress word bump in the commit that adds this file
- HEAD in this file is the tracker commit itself once committed
- Full `npm run test:ci-channels` is the final checkpoint after this file

## Counts against 113 indexable Appendix B articles

Hygiene passing is not editorial approval. Unread articles stay "Still requiring action".

| Class | Count |
|---|---|
| Rewritten | 11 |
| Targeted correction completed | 8 |
| Already acceptable | 1 |
| Merge proposed | 4 |
| Blocked / owner decision | 0 as a class. Title/slug mismatches below are owner decisions on pages whose bodies were corrected |
| Still requiring action | 89 |

## Corrected this continuation

| Slug | Action | Status |
|---|---|---|
| why-balcony-cabins-sell-out-first | Title and body now match. No sell-out rate | Rewritten. `e5fb58338` |
| aidacosma-vs-msc-seashore-ship-comparison-guide | Seashore has a Yacht Club; a standard cabin is not one | Targeted. `e5fb58338` |
| why-cruise-ship-elevators-are-always-busy | Removed 4,000–6,000 passengers and 15–20 decks | Targeted. `e5fb58338` |
| the-truth-about-cruise-ship-internet-speed-test-results-myths-and-what-to-expect | Vendor and line claims only. 15 Mbps is named as a figure not to believe | Rewritten. `e5fb58338` |
| why-joining-a-roll-call-in-seadays-changes-how-you-book-shore-excursions-on-day-one | Removed $119/$52, 40–120% markup, sample port prices, and ticket-verified claim | Targeted. `5a88fdfa5` |
| trip-cost-analytics-in-seadays-where-cruisers-actually-leak-300800-per-voyage | Body no longer states $300–$800 or $500–$1,200 | Targeted. `5a88fdfa5`. Title, H1, and slug still say $300–$800 |
| top-10-cruise-ships-for-2026-features-reviews-and-experiences | Queen Anne line no longer says transatlantic style | Targeted. `5a88fdfa5`. The other nine picks are still an unsupported ranking |
| i-tried-living-on-a-cruise-ship-for-30-days-heres-what-happened | Diary removed. Checklist from CDC pages | Rewritten. `5a88fdfa5`. Slug and H1 still say a person tried it |
| do-cruises-actually-harm-the-environment-what-the-data-really-says-in-2026 | IMO 2012/2018 shipping totals. No cruise-only share | Rewritten. `5a88fdfa5` |
| the-hidden-stress-of-cruise-travel-and-how-to-avoid-it | Clock and documents. No universal buffer | Rewritten. `7f3e2543b` |
| inside-the-most-expensive-cruise-suites-in-the-world | No world ranking. No tea-service claim. Points at the MSC Seashore page for the current suite list | Targeted. `7f3e2543b`. Live MSC page returned HTTP 401 from this network, so no square footage was copied |

SD-28 holdback left: `why-your-cruise-feels-chaotic-without-a-planning-app` only. It still contains "Framing the Issue". Merge into the stress article only with a real HTTP 301.

Four guides were removed from the holdback set because the template markers are gone: budget-vs-luxury what-to-choose (keeper, read), and three merge candidates that are real pages but duplicates.

## Owner decisions

Do not invent the evidence.

1. Trip-cost URL, title, and H1 still say cruisers leak $300–$800. The body does not. Changing the slug changes the canonical. Needs an owner title and a real 301 if the slug changes.
2. 30-day URL and H1 still say "I tried living on a cruise ship for 30 days." The body says nobody at SeaDays did that. Same slug decision.
3. Do not restore "participants are verified on the same sailing" unless the app checks tickets.
4. Do not restore excursion price examples.
5. Merges, no HTML pseudo-301: chaotic into hidden-stress; `complete-guide-to-budget-cruise-vs-luxury-cruise` into `budget-cruise-vs-luxury-cruise-what-to-choose`; `complete-guide-to-solo-cruise-vs-group-cruise` into the solo keeper already named in SD-30 C10; `cruise-tips-vs-cruise-hacks-what-to-choose` into `cruise-hacks-nobody-talks-about`.
6. Top 10: the other nine ships are still a list without a method.
7. Port and ship backlog stays separate: SD-01 through SD-06, SD-09, SD-35, SD-40, SD-41.

## Advertising

No change to ads.txt, consent, or the AdSense client/slot. Mid-article slots on rewrites use the existing `ca-pub-3084834499411817` / `4330928521`.

## Appendix B classification

| Slug | Class | Note |
|---|---|---|
| best-cruise-health-cost-planning-2026-guide | Rewritten | Sourced rewrite on this branch. |
| budget-cruise-lines-compared-carnival-vs-msc-vs-norwegian | Rewritten | Sourced rewrite on this branch. |
| cruise-health-vs-travel-wellness-what-to-know | Rewritten | Sourced rewrite on this branch. |
| disney-cruise-line-vs-royal-caribbean-best-for-families | Rewritten | Sourced rewrite on this branch. |
| do-cruises-actually-harm-the-environment-what-the-data-really-says-in-2026 | Rewritten | Sourced rewrite on this branch. |
| how-to-use-cruise-packing-list-for-caribbean | Rewritten | Sourced rewrite on this branch. |
| i-tried-living-on-a-cruise-ship-for-30-days-heres-what-happened | Rewritten | Sourced rewrite on this branch. |
| luxury-cruise-cost-guide-mistakes-to-avoid | Rewritten | Sourced rewrite on this branch. |
| the-hidden-stress-of-cruise-travel-and-how-to-avoid-it | Rewritten | Sourced rewrite on this branch. |
| the-truth-about-cruise-ship-internet-speed-test-results-myths-and-what-to-expect | Rewritten | Sourced rewrite on this branch. |
| why-balcony-cabins-sell-out-first | Rewritten | Sourced rewrite on this branch. |
| aidacosma-vs-msc-seashore-ship-comparison-guide | Targeted correction completed | Specific false claim replaced. Rest of page not a full rewrite. |
| cruise-packing-list-what-to-bring-and-what-to-leave-home | Targeted correction completed | Specific false claim replaced. Rest of page not a full rewrite. |
| cvs-celebrity-edge-modern-cruise-ship-comparison | Targeted correction completed | Specific false claim replaced. Rest of page not a full rewrite. |
| inside-the-most-expensive-cruise-suites-in-the-world | Targeted correction completed | Specific false claim replaced. Rest of page not a full rewrite. |
| top-10-cruise-ships-for-2026-features-reviews-and-experiences | Targeted correction completed | Specific false claim replaced. Rest of page not a full rewrite. |
| trip-cost-analytics-in-seadays-where-cruisers-actually-leak-300800-per-voyage | Targeted correction completed | Specific false claim replaced. Rest of page not a full rewrite. |
| why-cruise-ship-elevators-are-always-busy | Targeted correction completed | Passenger-range sentence removed. Not a full rewrite. |
| why-joining-a-roll-call-in-seadays-changes-how-you-book-shore-excursions-on-day-one | Targeted correction completed | Specific false claim replaced. Rest of page not a full rewrite. |
| budget-cruise-vs-luxury-cruise-what-to-choose | Already acceptable | Read this session. Decision guide, no template marker, no invented ranking. |
| complete-guide-to-budget-cruise-vs-luxury-cruise | Merge proposed | Owner must approve a real 301. No HTML stub. |
| complete-guide-to-solo-cruise-vs-group-cruise | Merge proposed | Owner must approve a real 301. No HTML stub. |
| cruise-tips-vs-cruise-hacks-what-to-choose | Merge proposed | Owner must approve a real 301. No HTML stub. |
| why-your-cruise-feels-chaotic-without-a-planning-app | Merge proposed | Owner must approve a real 301. No HTML stub. |
| 12-cruise-ship-secrets-the-crew-wont-tell-you-but-you-should-know | Still requiring action | Indexable body about 393 words. Not expanded without a source. |
| 7-cruise-passenger-mistakes-that-cost-you-time-and-money | Still requiring action | Indexable body about 573 words. Not expanded without a source. |
| 7-days-of-pure-fun-why-a-mediterranean-cruise-is-the-ultimate-feel-good-trip | Still requiring action | Indexable body about 320 words. Not expanded without a source. |
| 7-ways-planning-your-cruise-properly-saves-you-money | Still requiring action | Indexable body about 289 words. Not expanded without a source. |
| aida-cruises-secrets-10-things-regular-guests-know-but-newcomers-dont | Still requiring action | Indexable body about 479 words. Not expanded without a source. |
| alaska-cruise-planning-2026-inside-passage-routes-excursions-and-packing | Still requiring action | Indexable body about 555 words. Not expanded without a source. |
| are-cruises-actually-cheaper-than-hotels-real-cost-breakdown | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| best-adults-only-cruise-lines-and-ships-in-2026 | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| best-cruise-lines-for-families-ranked-royal-caribbean-vs-disney-vs-msc-vs-aida | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| best-cruises-for-families-the-ultimate-guide-for-infants-kids-and-teens | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| best-honeymoon-cruises-and-romantic-sailings-for-2026 | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| best-mediterranean-cruise-ports-what-to-do-in-each-stop | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| can-you-work-remotely-from-a-cruise-ship-a-realistic-2026-guide | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| caribbean-vs-mediterranean-cruise-which-should-you-choose-for-your-first-trip | Still requiring action | Indexable body about 457 words. Not expanded without a source. |
| carnival-cruise-planning-fun-ships-value-fares-and-smart-spending | Still requiring action | Indexable body about 474 words. Not expanded without a source. |
| cruise-budget-planner-the-categories-most-spreadsheets-forget | Still requiring action | Indexable body about 425 words. Not expanded without a source. |
| cruise-cabin-choices-inside-oceanview-or-balconywhich-is-right-for-you | Still requiring action | Indexable body about 540 words. Not expanded without a source. |
| cruise-dress-codes-explained-formal-nights-smart-casual-and-theme-nights | Still requiring action | Indexable body about 533 words. Not expanded without a source. |
| cruise-drink-calculator-when-the-beverage-package-actually-loses-money | Still requiring action | Indexable body about 465 words. Not expanded without a source. |
| cruise-hacks-nobody-talks-about-that-save-you-hundreds | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| cruise-itinerary-planning-how-to-choose-the-perfect-route | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| cruise-packing-list-what-to-assign-before-anyone-buys-a-second-power-strip | Still requiring action | Indexable body about 417 words. Not expanded without a source. |
| cruise-planning-tips-a-90-day-timeline-that-reduces-embarkation-stress | Still requiring action | Indexable body about 454 words. Not expanded without a source. |
| cruise-port-days-how-to-make-the-most-of-your-time-ashore | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| cruise-ship-curiosities-10-weird-and-wonderful-facts | Still requiring action | Indexable body about 499 words. Not expanded without a source. |
| cruise-ship-design-how-do-they-stay-afloat-and-why-theyre-so-big | Still requiring action | Indexable body about 531 words. Not expanded without a source. |
| cruise-ship-entertainment-shows-activities-and-nightlife | Still requiring action | Indexable body about 517 words. Not expanded without a source. |
| cruise-ship-food-what-to-expect-and-how-to-eat-well | Still requiring action | Indexable body about 480 words. Not expanded without a source. |
| cruise-ship-operations-what-happens-behind-the-scenes | Still requiring action | Indexable body about 482 words. Not expanded without a source. |
| cruise-ship-problems-what-can-go-wrong-and-how-often-it-does | Still requiring action | Indexable body about 531 words. Not expanded without a source. |
| cruise-ship-secrets-only-crew-members-know-and-passengers-rarely-hear | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| cruise-travel-hacks-15-tips-to-save-money-and-stress | Still requiring action | Indexable body about 582 words. Not expanded without a source. |
| cruise-travel-myths-debunked-whats-true-and-whats-not | Still requiring action | Indexable body about 521 words. Not expanded without a source. |
| cruise-vs-flying-hotels-which-is-actually-better-in-2026 | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| cruising-alone-is-it-worth-it-or-awkward | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| do-cruise-ships-ever-get-lost | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| do-cruise-ships-ever-run-out-of-food | Still requiring action | Indexable body about 406 words. Not expanded without a source. |
| embarkation-day-timeline-what-actually-happens-from-terminal-to-cabin | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| family-friendly-cruise-ships-which-one-should-you-pick | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| first-time-cruise-mistakes-that-cost-money-and-how-to-avoid-them | Still requiring action | Indexable body about 472 words. Not expanded without a source. |
| first-time-cruise-tips-what-to-know-before-you-go | Still requiring action | Indexable body about 498 words. Not expanded without a source. |
| from-party-ships-to-zen-cruises-finding-your-vibe | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| how-better-planning-reduces-cruise-expenses-instantly | Still requiring action | Indexable body about 253 words. Not expanded without a source. |
| how-cruise-roll-calls-help-you-meet-people-before-embarkation-day | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| how-to-avoid-getting-sick-on-a-cruise-ship | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| how-to-build-a-shared-packing-list-in-seadays-plan-that-ends-duplicate-suitcases-for-good | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| how-to-get-the-best-cruise-cabin-location-on-any-ship | Still requiring action | Indexable body about 435 words. Not expanded without a source. |
| how-to-keep-track-of-all-your-cruises-without-forgetting-the-details | Still requiring action | Indexable body about 226 words. Not expanded without a source. |
| how-to-meet-people-on-a-cruise-without-forcing-friendships-at-the-buffet | Still requiring action | Indexable body about 439 words. Not expanded without a source. |
| how-to-save-money-on-shore-excursions-without-missing-out | Still requiring action | Indexable body about 446 words. Not expanded without a source. |
| how-to-travel-with-kids-on-a-cruise-without-losing-your-mind | Still requiring action | Indexable body about 291 words. Not expanded without a source. |
| is-the-port-of-miami-the-best-cruise-hub-full-review | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| is-unlimited-food-on-cruises-really-unlimited-what-the-buffets-dont-advertise | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| luxury-cruises-comparing-royal-caribbeans-oasis-class-ships | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| luxury-vs-adventure-cruises-which-experience-is-right-for-you | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| luxury-vs-budget-cruises-is-the-price-difference-worth-it-in-2026 | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| missed-the-ship-all-aboard-buffers-that-keep-first-timers-safe | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| msc-cruises-planning-guide-for-european-and-caribbean-sailings | Still requiring action | Indexable body about 488 words. Not expanded without a source. |
| multi-generational-family-cruises-cabins-dining-and-keeping-everyone-happy | Still requiring action | Indexable body about 482 words. Not expanded without a source. |
| norwegian-fjords-cruise-guide-best-season-key-ports-and-scenic-cruising | Still requiring action | Indexable body about 547 words. Not expanded without a source. |
| port-days-vs-sea-days-how-to-balance-exploration-rest-and-onboard-fun | Still requiring action | Indexable body about 457 words. Not expanded without a source. |
| pre-cruise-vs-onboard-spending-where-the-folio-actually-blows-up | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| river-cruises-vs-ocean-cruises-which-is-right-for-you | Still requiring action | Indexable body about 409 words. Not expanded without a source. |
| rome-civitavecchia-cruise-port-how-to-explore-the-eternal-city | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| royal-caribbean-cruise-planning-ships-crowds-and-budget-reality | Still requiring action | Indexable body about 521 words. Not expanded without a source. |
| sea-cloud-cruises-a-deep-dive-into-luxury-tall-ship-voyages | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| sea-day-activities-what-to-do-when-youre-not-in-port | Still requiring action | Indexable body about 448 words. Not expanded without a source. |
| sea-days-why-cruisers-actually-love-days-at-sea | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| small-ship-cruises-why-intimate-voyages-are-rising | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| solo-cruising-in-2026-safety-cabins-dining-and-making-friends-at-sea | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| the-best-cruise-ship-cabins-and-which-ones-to-avoid | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| the-dark-side-of-cruises-what-cruise-lines-dont-tell-you | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| the-future-of-cruise-dining-specialty-boom-flex-dining-and-dietary-needs-at-sea | Still requiring action | Indexable body about 480 words. Not expanded without a source. |
| the-future-of-cruising-ai-smart-ships-floating-cities | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| the-hidden-costs-of-not-using-a-cruise-planning-app | Still requiring action | Indexable body about 386 words. Not expanded without a source. |
| the-most-extreme-cruise-experiences-in-the-world | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| the-most-overrated-cruise-destinations-and-better-alternatives | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| the-psychology-of-cruises-why-people-get-addicted | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| the-real-cost-of-cruise-drink-packages-is-it-worth-it | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| the-rise-of-digital-nomads-on-cruise-ships-hype-reality-and-wifi-economics | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| the-seadays-drink-package-calculator-math-that-tells-you-when-to-skip-the-package-entirely | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| what-a-10000-cruise-actually-gets-you | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| what-happens-if-you-miss-your-cruise-ship | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| what-is-a-sea-day-on-a-cruise | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| what-to-post-in-a-cruise-roll-call-first-besides-hi | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| why-cruise-ship-cabins-sometimes-feel-small | Still requiring action | Indexable body about 402 words. Not expanded without a source. |
| why-cruise-ships-use-horns-when-leaving-port | Still requiring action | Indexable body about 368 words. Not expanded without a source. |
| why-cruises-are-the-best-way-to-travel-europe-right-now | Still requiring action | Not editorially re-read in this programme. Hygiene pass is not approval. |
| why-last-minute-cruise-decisions-cost-more-money | Still requiring action | Indexable body about 503 words. Not expanded without a source. |

