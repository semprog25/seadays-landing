# CMS reconciliation dry run

Generated: 2026-10-21T07:52:34.487Z

Read only. No Supabase write, no CMS approval, no publish.

## Generator precedence

1. `GET /portside-articles?forWebsite=1` returns summaries where `isDraft !== true` and `showOnWebsite !== false`.
2. `GET /portside-articles/:id` loads the stored article. Saves go through `POST /portside-articles` as the article author (`requirePortsidePublisher`). Website visibility is `PUT /portside-articles/:id/visibility` and requires a CMS admin.
3. `data/blog-body-overrides/<slug>.html` replaces the body at generation time.
4. `data/blog-body-overrides/meta.json` `title` and `description`, and `data/blog-article-corrections.json` `titleBySourceSlug`, replace the visible title and excerpt. The folder slug and canonical stay.
5. A later generator run without those files would put the CMS title, excerpt, and body back.

App feed copies are the same Portside records (`portside:article:<id>` in `kv_store_51d3ca8d`). Changing a published article changes the app feed. Drafts (`isDraft: true`) stay off the website feed. Do not flip `isDraft` or `showOnWebsite` from this tool.

## Summary

- Public feed rows: **119**
- Local override slugs: **61**
- Not in public feed: **2**
- Title stale vs CMS: **15**
- Excerpt stale vs CMS: **61**
- Body stale vs CMS (fingerprint): **61**
- Safe to reconcile via author POST (in feed): **59**
- Blocked / unresolved mapping: **2**

Machine-readable manifest: `data/cms-reconciliation-manifest.json`

## Safe CMS update procedure (future, not executed here)

See `docs/cms-sync-procedure.md`. Requires fresh `GET /portside-articles/:id` immediately before any `POST`, field-level diff, and author session matching stored `authorId`. The Portside POST handler merges `{ ...existingArticle, ...articleIncoming }` with **no version/ETag guard** — treat concurrent CMS edits as a blocker until manually reconciled.

## Full manifest

| Slug | CMS id | authorId | isDraft | showOnWebsite | Fields differ | Safe reconcile | CMS title | Local title |
|---|---|---|---|---|---|---|---|---|
| 12-cruise-ship-secrets-the-crew-wont-tell-you-but-you-should-know | article_1773699946772_g65l764f8 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | 12 Cruise Ship Secrets the Crew Won't Tell You (But You Should Know) | Passenger tips that show up every cruise week |
| 7-cruise-passenger-mistakes-that-cost-you-time-and-money | article_1773790701536_jle3nd9ej | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | 7 Cruise Passenger Mistakes That Cost You Time and Money | (unchanged on website generator) |
| 7-ways-planning-your-cruise-properly-saves-you-money | blog_post_5b6b6d38-f0d1-4e3e-b578-f48615de6fcc | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | 7 Ways Planning Your Cruise Properly Saves You Money | (unchanged on website generator) |
| aida-cruises-secrets-10-things-regular-guests-know-but-newcomers-dont | draft_1767372497539_f1ms9gtyn | user_8534457c-973a-42d6-942c-8ee5a27689e9 | false | true | excerpt, content | yes | AIDA Cruises Secrets: 10 Things Regular Guests Know (But Newcomers Don’t) | (unchanged on website generator) |
| aidacosma-vs-msc-seashore-ship-comparison-guide | blog_post_c5e64ecb-8283-462c-b006-701905d837b9 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | AIDAcosma vs. MSC Seashore: Ship Comparison Guide | (unchanged on website generator) |
| are-cruises-actually-cheaper-than-hotels-real-cost-breakdown | blog_post_ef03117c-d2c7-4955-9761-683f1b9475d8 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Are Cruises Actually Cheaper Than Hotels? Real Cost Breakdown | (unchanged on website generator) |
| best-adults-only-cruise-lines-and-ships-in-2026 | blog_post_880b00c4-f2a8-4d5e-8f61-8577677c324a | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | Best Adults-Only Cruise Lines and Ships in 2026 | Adults-only ships to compare in 2026 |
| best-cruise-health-cost-planning-2026-guide | blog_post_abbf541c-af7f-459b-9de1-11f6d62cae3d | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Best Cruise Health Cost Planning (2026 Guide) | (unchanged on website generator) |
| best-cruise-lines-for-families-ranked-royal-caribbean-vs-disney-vs-msc-vs-aida | article_1774909072089_hkxzxj5xb | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | Best Cruise Lines for Families Ranked: Royal Caribbean vs Disney vs MSC vs AIDA | Royal Caribbean, Disney, MSC, and AIDA for families |
| best-honeymoon-cruises-and-romantic-sailings-for-2026 | blog_post_94c0f84c-e4c5-4081-9d5a-3e7a8e9a2ac8 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Best Honeymoon Cruises and Romantic Sailings for 2026 | (unchanged on website generator) |
| budget-cruise-lines-compared-carnival-vs-msc-vs-norwegian | blog_post_e9c5c502-795d-4bef-806e-56a78507b7a2 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Budget Cruise Lines Compared: Carnival vs MSC vs Norwegian | (unchanged on website generator) |
| cruise-cabin-choices-inside-oceanview-or-balconywhich-is-right-for-you | blog_post_cb3ef715-e132-4add-99d1-f93e62ddc869 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Cruise Cabin Choices: Inside, Oceanview, or Balcony—Which Is Right for You? | (unchanged on website generator) |
| cruise-health-vs-travel-wellness-what-to-know | blog_post_75b24977-53ac-46eb-bf94-6b11f0be9ca1 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Cruise Health Vs Travel Wellness: What to Know | (unchanged on website generator) |
| cruise-itinerary-planning-how-to-choose-the-perfect-route | blog_post_d9adca90-34f2-49c5-a6aa-a3ff3912f23d | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Cruise Itinerary Planning: How to Choose the Perfect Route | (unchanged on website generator) |
| cruise-packing-list-what-to-bring-and-what-to-leave-home | blog_post_c39d3b32-1df0-4d0c-855e-72d7bd999a8a | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Cruise Packing List: What to Bring (And What to Leave Home) | (unchanged on website generator) |
| cruise-planning-tips-a-90-day-timeline-that-reduces-embarkation-stress | blog_post_404112b0-a819-42c9-bb3e-cb104b5188a3 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Cruise Planning Tips: A 90-Day Timeline That Reduces Embarkation Stress | (unchanged on website generator) |
| cruise-port-days-how-to-make-the-most-of-your-time-ashore | blog_post_06d52643-f971-444c-9d2c-a1657b2340f1 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Cruise Port Days: How to Make the Most of Your Time Ashore | (unchanged on website generator) |
| cruise-ship-curiosities-10-weird-and-wonderful-facts | blog_post_b90d282e-22cf-4ce6-aba9-1c57aaf9c6ee | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Cruise Ship Curiosities: 10 Weird and Wonderful Facts | (unchanged on website generator) |
| cruise-ship-secrets-only-crew-members-know-and-passengers-rarely-hear | blog_post_1fb0288e-f09a-4127-af46-d574df08b411 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | Cruise Ship Secrets Only Crew Members Know (And Passengers Rarely Hear) | How a cruise ship runs from the working side |
| cruise-travel-hacks-15-tips-to-save-money-and-stress | blog_post_5b5b896d-ed5f-4592-b0ef-93225eb799b7 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Cruise Travel Hacks: 15 Tips to Save Money and Stress | (unchanged on website generator) |
| cruise-vs-flying-hotels-which-is-actually-better-in-2026 | blog_post_b2e8ae97-7a22-4696-ba3f-40f353e52321 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Cruise vs Flying + Hotels: Which Is Actually Better in 2026? | (unchanged on website generator) |
| cvs-celebrity-edge-modern-cruise-ship-comparison | blog_post_274db296-21bd-4c2f-8ce7-da79e4a85d00 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | cvs Celebrity Edge: Modern Cruise Ship Comparison | Norwegian Prima vs Celebrity Edge: Modern Cruise Ship Comparison |
| disney-cruise-line-vs-royal-caribbean-best-for-families | blog_post_4143c22e-1521-43a8-acaa-a04d8e22ffd3 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Disney Cruise Line vs Royal Caribbean: Best for Families | (unchanged on website generator) |
| do-cruise-ships-ever-run-out-of-food | article_1774051833407_brvr8vdds | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Do Cruise Ships Ever Run Out of Food? | (unchanged on website generator) |
| do-cruises-actually-harm-the-environment-what-the-data-really-says-in-2026 | blog_post_d3a39914-4b5b-46b4-8b35-460cd248f25e | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Do Cruises Actually Harm the Environment? What the Data Really Says in 2026 | (unchanged on website generator) |
| embarkation-day-timeline-what-actually-happens-from-terminal-to-cabin | blog_post_f8105925-33ee-427b-8177-17f553af126d | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Embarkation Day Timeline: What Actually Happens From Terminal to Cabin | (unchanged on website generator) |
| how-better-planning-reduces-cruise-expenses-instantly | blog_post_9e242fbf-2548-4bb9-ac5e-d6d4b589dcdd | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | How Better Planning Reduces Cruise Expenses Instantly | (unchanged on website generator) |
| how-to-build-a-shared-packing-list-in-seadays-plan-that-ends-duplicate-suitcases-for-good | blog_post_1fc2d348-8660-49dc-8ca6-76a0e5e99c9e | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | How to Build a Shared Packing List in SeaDays Plan That Ends Duplicate Suitcases for Good | (unchanged on website generator) |
| how-to-get-the-best-cruise-cabin-location-on-any-ship | blog_post_7a6d4862-5c3d-4dd8-9033-dc9caceee2f0 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | How to Get the Best Cruise Cabin Location on Any Ship | (unchanged on website generator) |
| how-to-keep-track-of-all-your-cruises-without-forgetting-the-details | article_1773434546694_ktqo9t6n9 | user_2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | How to Keep Track of All Your Cruises (Without Forgetting the Details) | What to write down after a cruise |
| how-to-save-money-on-shore-excursions-without-missing-out | blog_post_cefd3fab-0f60-406b-926c-93ee9b839ba5 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | How to Save Money on Shore Excursions Without Missing Out | (unchanged on website generator) |
| how-to-travel-with-kids-on-a-cruise-without-losing-your-mind | NOT IN FEED | — | — | — | excerpt, content | no (Not in forWebsite feed; resolve visibility/draft before CMS sync) |  |  |
| how-to-use-cruise-packing-list-for-caribbean | blog_post_05266665-f9a6-4583-b896-d2822320ffed | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | How to Use Cruise Packing List For Caribbean | (unchanged on website generator) |
| i-tried-living-on-a-cruise-ship-for-30-days-heres-what-happened | blog_post_f5899ee7-282d-43ca-8cfa-0f02691e99ea | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | I Tried Living on a Cruise Ship for 30 Days – Here’s What Happened | Living on a Cruise Ship for 30 Days: What to Know Before You Book |
| inside-the-most-expensive-cruise-suites-in-the-world | blog_post_e8ed460d-d40c-43c8-9997-a0b0730705d7 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Inside the Most Expensive Cruise Suites in the World | (unchanged on website generator) |
| is-the-port-of-miami-the-best-cruise-hub-full-review | blog_post_3bad45e6-3a1b-46cd-ba4c-39fc2ae8c5a1 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | Is the Port of Miami the Best Cruise Hub? Full Review | PortMiami as a cruise hub |
| luxury-cruise-cost-guide-mistakes-to-avoid | blog_post_b3d489ce-8b36-4ab7-baa7-5e53f8f1fca2 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Luxury Cruise Cost Guide Mistakes to Avoid | (unchanged on website generator) |
| luxury-vs-budget-cruises-is-the-price-difference-worth-it-in-2026 | blog_post_13a2b409-75e7-4bbe-b80c-5651bd9af761 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Luxury vs Budget Cruises: Is the Price Difference Worth It in 2026? | (unchanged on website generator) |
| missed-the-ship-all-aboard-buffers-that-keep-first-timers-safe | blog_post_fcb84f07-3b74-4691-bc4d-07706b8614b4 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Missed the Ship? All-Aboard Buffers That Keep First-Timers Safe | (unchanged on website generator) |
| pre-cruise-vs-onboard-spending-where-the-folio-actually-blows-up | blog_post_7ca24c8e-97d6-4dcb-bed8-15bc8bd24e1d | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Pre-Cruise vs Onboard Spending: Where the Folio Actually Blows Up | (unchanged on website generator) |
| river-cruises-vs-ocean-cruises-which-is-right-for-you | blog_post_525e6a16-5e6b-4c68-8e5c-cd0600323539 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | River Cruises vs Ocean Cruises: Which Is Right for You | (unchanged on website generator) |
| rome-civitavecchia-cruise-port-how-to-explore-the-eternal-city | blog_post_acf8bd1b-8521-4a16-83fa-040c1813097a | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Rome (Civitavecchia) Cruise Port: How to Explore the Eternal City | (unchanged on website generator) |
| sea-days-why-cruisers-actually-love-days-at-sea | article_1773789679934_7k1v2i3k9 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Sea Days: Why Cruisers Actually Love Days at Sea | (unchanged on website generator) |
| the-best-cruise-ship-cabins-and-which-ones-to-avoid | article_1773618144306_8ghhuw9dw | user_2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | The Best Cruise Ship Cabins (And Which Ones to Avoid) | Cruise cabin types and the complaints that repeat |
| the-hidden-costs-of-not-using-a-cruise-planning-app | blog_post_4844deaf-9186-460a-a270-de28bc912a41 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | The Hidden Costs of Not Using a Cruise Planning App | (unchanged on website generator) |
| the-hidden-stress-of-cruise-travel-and-how-to-avoid-it | blog_post_1fee2f1b-75f5-4163-813d-bb93d0317fc3 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | The Hidden Stress of Cruise Travel (And How to Avoid It) | (unchanged on website generator) |
| the-most-overrated-cruise-destinations-and-better-alternatives | blog_post_31d5efa3-a7be-4322-9f85-98bdac96ec26 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | The Most Overrated Cruise Destinations (And Better Alternatives) | Popular cruise ports that disappoint some passengers |
| the-real-cost-of-cruise-drink-packages-is-it-worth-it | article_1773787438317_9q22xxpuj | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | The Real Cost of Cruise Drink Packages: Is It Worth It? | (unchanged on website generator) |
| the-seadays-drink-package-calculator-math-that-tells-you-when-to-skip-the-package-entirely | blog_post_d5d568ad-6bb1-429e-8b9c-1d558fd4b396 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | The SeaDays Drink Package Calculator Math That Tells You When to Skip the Package Entirely | The SeaDays Drink Package Calculator: When the Package Costs More |
| the-truth-about-cruise-ship-internet-speed-test-results-myths-and-what-to-expect | blog_post_b9539dc0-eed3-4934-b3e6-286c61490c26 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | The Truth About Cruise Ship Internet: Speed Test Results, Myths, and What to Expect | (unchanged on website generator) |
| top-10-cruise-ships-for-2026-features-reviews-and-experiences | blog_post_4d945469-a644-49a3-b56d-0d058f451471 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | Top 10 Cruise Ships for 2026: Features, Reviews, and Experiences | 10 Cruise Ships to Consider in 2026: Features and Experiences Compared |
| trip-cost-analytics-in-seadays-where-cruisers-actually-leak-300800-per-voyage | blog_post_815c8d22-087c-46e0-a8df-52b1b44a37b9 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | Trip Cost Analytics in SeaDays: Where Cruisers Actually Leak $300–$800 Per Voyage | Cruise Spending Analytics: Where Your Money Goes on Board |
| what-a-10000-cruise-actually-gets-you | blog_post_343a0ae4-7358-46b4-afca-edf81e54613f | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | What a $10,000 Cruise Actually Gets You | (unchanged on website generator) |
| what-is-a-sea-day-on-a-cruise | article_1773448398584_gr58c3wl9 | user_2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | What Is a Sea Day on a Cruise? | (unchanged on website generator) |
| why-balcony-cabins-sell-out-first | blog_post_42cbbeda-6d6c-41ea-8eb8-75557bd9caa0 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Why Balcony Cabins Sell Out First | (unchanged on website generator) |
| why-cruise-ship-cabins-sometimes-feel-small | blog_post_2c1c34d9-cecd-4f0f-97d6-7781db598397 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Why Cruise Ship Cabins Sometimes Feel Small | (unchanged on website generator) |
| why-cruise-ship-elevators-are-always-busy | blog_post_bf5f7176-2002-4da1-a18e-990e35fe951d | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Why Cruise Ship Elevators Are Always Busy | (unchanged on website generator) |
| why-cruises-are-the-best-way-to-travel-europe-right-now | blog_post_c129ca72-85ba-4f5f-835d-cf4f69316b0b | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | title, excerpt, content | yes | Why Cruises Are the Best Way to Travel Europe Right Now | When a cruise is a practical way to see Europe |
| why-joining-a-roll-call-in-seadays-changes-how-you-book-shore-excursions-on-day-one | blog_post_0b29f57e-d318-46d5-950c-885341d5fb48 | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Why Joining a Roll Call in SeaDays Changes How You Book Shore Excursions on Day One | (unchanged on website generator) |
| why-last-minute-cruise-decisions-cost-more-money | blog_post_f959e78a-2bb6-4b6c-bc71-c2e0409b305d | 2467d3a1-ff2f-4773-88a9-20b2d0027b0d | false | true | excerpt, content | yes | Why Last-Minute Cruise Decisions Cost More Money | (unchanged on website generator) |
| why-your-cruise-feels-chaotic-without-a-planning-app | NOT IN FEED | — | — | — | title, excerpt, content | no (Not in forWebsite feed; resolve visibility/draft before CMS sync) |  | Why Your Cruise Feels Chaotic Without a Planning App |

Excerpt and body fingerprints: `data/cms-reconciliation-manifest.json` per article (`cmsExcerpt`, `localExcerpt`, `*BodyFingerprint`).

To update the CMS later: author session `POST /make-server-51d3ca8d/portside-articles` with `userId` matching normalized publisher id, existing `article.id`, preserved `authorId`, and only intended fields changed after a fresh GET diff. Then run the website generator. This dry run does not do that.
