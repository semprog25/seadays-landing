# CMS reconciliation dry run

Read only. No Supabase write, no CMS approval, no publish.

## Generator precedence

1. `GET /portside-articles?forWebsite=1` returns summaries where `isDraft !== true` and `showOnWebsite !== false`.
2. `GET /portside-articles/:id` loads the stored article. Saves go through `POST /portside-articles` as the article author (`requirePortsidePublisher`). Website visibility is `PUT /portside-articles/:id/visibility` and requires a CMS admin.
3. `data/blog-body-overrides/<slug>.html` replaces the body at generation time.
4. `data/blog-body-overrides/meta.json` `title` and `description`, and `data/blog-article-corrections.json` `titleBySourceSlug`, replace the visible title and excerpt. The folder slug and canonical stay.
5. A later generator run without those files would put the CMS title, excerpt, and body back.

App feed copies are the same Portside records (`portside:article:<id>` in `kv_store_51d3ca8d`). Changing a published article changes the app feed. Drafts (`isDraft: true`) stay off the website feed. Do not flip `isDraft` or `showOnWebsite` from this tool.

Public feed rows: 119.

| Slug | CMS id | CMS title differs | Excerpt differs | Body override | isDraft | showOnWebsite |
|---|---|---|---|---|---|---|
| 7-ways-planning-your-cruise-properly-saves-you-money | blog_post_5b6b6d38-f0d1-4e3e-b578-f48615de6fcc | no | yes | yes | false | true |
| aidacosma-vs-msc-seashore-ship-comparison-guide | blog_post_c5e64ecb-8283-462c-b006-701905d837b9 | no | yes | yes | false | true |
| best-cruise-health-cost-planning-2026-guide | blog_post_abbf541c-af7f-459b-9de1-11f6d62cae3d | no | yes | yes | false | true |
| best-honeymoon-cruises-and-romantic-sailings-for-2026 | blog_post_94c0f84c-e4c5-4081-9d5a-3e7a8e9a2ac8 | no | yes | yes | false | true |
| budget-cruise-lines-compared-carnival-vs-msc-vs-norwegian | blog_post_e9c5c502-795d-4bef-806e-56a78507b7a2 | no | yes | yes | false | true |
| cruise-health-vs-travel-wellness-what-to-know | blog_post_75b24977-53ac-46eb-bf94-6b11f0be9ca1 | no | yes | yes | false | true |
| cruise-itinerary-planning-how-to-choose-the-perfect-route | blog_post_d9adca90-34f2-49c5-a6aa-a3ff3912f23d | no | yes | yes | false | true |
| cruise-packing-list-what-to-bring-and-what-to-leave-home | blog_post_c39d3b32-1df0-4d0c-855e-72d7bd999a8a | no | yes | yes | false | true |
| cvs-celebrity-edge-modern-cruise-ship-comparison | blog_post_274db296-21bd-4c2f-8ce7-da79e4a85d00 | yes | yes | yes | false | true |
| disney-cruise-line-vs-royal-caribbean-best-for-families | blog_post_4143c22e-1521-43a8-acaa-a04d8e22ffd3 | no | yes | yes | false | true |
| do-cruise-ships-ever-run-out-of-food | article_1774051833407_brvr8vdds | no | yes | yes | false | true |
| do-cruises-actually-harm-the-environment-what-the-data-really-says-in-2026 | blog_post_d3a39914-4b5b-46b4-8b35-460cd248f25e | no | yes | yes | false | true |
| how-better-planning-reduces-cruise-expenses-instantly | blog_post_9e242fbf-2548-4bb9-ac5e-d6d4b589dcdd | no | yes | yes | false | true |
| how-to-get-the-best-cruise-cabin-location-on-any-ship | blog_post_7a6d4862-5c3d-4dd8-9033-dc9caceee2f0 | no | yes | yes | false | true |
| how-to-save-money-on-shore-excursions-without-missing-out | blog_post_cefd3fab-0f60-406b-926c-93ee9b839ba5 | no | yes | yes | false | true |
| how-to-travel-with-kids-on-a-cruise-without-losing-your-mind | NOT IN FEED | | | yes | | |
| how-to-use-cruise-packing-list-for-caribbean | blog_post_05266665-f9a6-4583-b896-d2822320ffed | no | yes | yes | false | true |
| i-tried-living-on-a-cruise-ship-for-30-days-heres-what-happened | blog_post_f5899ee7-282d-43ca-8cfa-0f02691e99ea | yes | yes | yes | false | true |
| inside-the-most-expensive-cruise-suites-in-the-world | blog_post_e8ed460d-d40c-43c8-9997-a0b0730705d7 | no | yes | yes | false | true |
| luxury-cruise-cost-guide-mistakes-to-avoid | blog_post_b3d489ce-8b36-4ab7-baa7-5e53f8f1fca2 | no | yes | yes | false | true |
| river-cruises-vs-ocean-cruises-which-is-right-for-you | blog_post_525e6a16-5e6b-4c68-8e5c-cd0600323539 | no | yes | yes | false | true |
| the-best-cruise-ship-cabins-and-which-ones-to-avoid | article_1773618144306_8ghhuw9dw | no | yes | yes | false | true |
| the-hidden-costs-of-not-using-a-cruise-planning-app | blog_post_4844deaf-9186-460a-a270-de28bc912a41 | no | yes | yes | false | true |
| the-hidden-stress-of-cruise-travel-and-how-to-avoid-it | blog_post_1fee2f1b-75f5-4163-813d-bb93d0317fc3 | no | yes | yes | false | true |
| the-real-cost-of-cruise-drink-packages-is-it-worth-it | article_1773787438317_9q22xxpuj | no | yes | yes | false | true |
| the-truth-about-cruise-ship-internet-speed-test-results-myths-and-what-to-expect | blog_post_b9539dc0-eed3-4934-b3e6-286c61490c26 | no | yes | yes | false | true |
| top-10-cruise-ships-for-2026-features-reviews-and-experiences | blog_post_4d945469-a644-49a3-b56d-0d058f451471 | yes | yes | yes | false | true |
| trip-cost-analytics-in-seadays-where-cruisers-actually-leak-300800-per-voyage | blog_post_815c8d22-087c-46e0-a8df-52b1b44a37b9 | yes | yes | yes | false | true |
| what-is-a-sea-day-on-a-cruise | article_1773448398584_gr58c3wl9 | no | yes | yes | false | true |
| why-balcony-cabins-sell-out-first | blog_post_42cbbeda-6d6c-41ea-8eb8-75557bd9caa0 | no | yes | yes | false | true |
| why-cruise-ship-elevators-are-always-busy | blog_post_bf5f7176-2002-4da1-a18e-990e35fe951d | no | yes | yes | false | true |
| why-joining-a-roll-call-in-seadays-changes-how-you-book-shore-excursions-on-day-one | blog_post_0b29f57e-d318-46d5-950c-885341d5fb48 | no | yes | yes | false | true |
| why-last-minute-cruise-decisions-cost-more-money | blog_post_f959e78a-2bb6-4b6c-bc71-c2e0409b305d | no | yes | yes | false | true |
| why-your-cruise-feels-chaotic-without-a-planning-app | NOT IN FEED | | | yes | | |

Override slugs missing from the public feed: 2.

To update the CMS, an author session must `POST /make-server-51d3ca8d/portside-articles` with the existing `id`, the same `authorId`, `isDraft: false`, and `showOnWebsite` left as it is. Put the local title in `title`, the local description in `excerpt`, and the override HTML in `content`. Then run the website generator. This dry run does not do that.
