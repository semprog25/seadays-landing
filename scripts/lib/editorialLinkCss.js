'use strict';

/** Editorial hyperlinks on dark SeaDays surfaces — append last in page bundles to beat legacy inline rules. */
const EDITORIAL_LINK_MARKER = '/* seadays-editorial-links-v2 */';

const EDITORIAL_LINK_CSS = `
${EDITORIAL_LINK_MARKER}
.seo-prose a:not(.directory-btn):not(.seadays-brand-cta),
.seo-details .seo-details-body a,
.seo-cross-list a,
.seo-inline-more a,
.seo-detail .seo-body a,
.seo-detail .seo-faq-item a,
.seo-detail .pg-section .pg-prose a.pg-editorial-link,
.seo-detail .pg-section .pg-prose a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download),
.seo-detail .pg-qa-card a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download),
.seo-detail .pg-call-plan-body a,
.seo-detail .pg-call-plan-card a:not(.pg-booking-cta):not(.pg-btn),
.seo-detail .pg-terminal-card .pg-prose a:not(.pg-booking-cta):not(.pg-btn),
.seo-detail .pg-terminal-card-desc a,
.seo-detail .pg-map-credit a,
.seo-detail .pg-terminal-card-photo figcaption a,
.seo-detail .seo-hero figcaption a,
.article-body a.contextual-link,
.article-body :is(p, li, td, th, figcaption, blockquote, aside:not(.get-seadays-cta)) a[href]:not(.get-seadays-cta-badges a):not([class*="btn"]):not(.pg-booking-cta) {
  color: var(--seadays-editorial-link, #79D8FF);
  font-weight: 650;
  text-decoration: underline;
  text-decoration-color: rgba(121, 216, 255, 0.45);
  text-underline-offset: 3px;
}
.seo-prose a:not(.directory-btn):visited,
.seo-details .seo-details-body a:visited,
.seo-cross-list a:visited,
.seo-inline-more a:visited,
.seo-detail .seo-body a:visited,
.seo-detail .seo-faq-item a:visited,
.seo-detail .pg-section .pg-prose a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download):visited,
.seo-detail .pg-qa-card a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download):visited,
.seo-detail .pg-call-plan-body a:visited,
.seo-detail .pg-map-credit a:visited,
.article-body a.contextual-link:visited,
.article-body :is(p, li, td, th, figcaption, blockquote, aside:not(.get-seadays-cta)) a[href]:not(.get-seadays-cta-badges a):not([class*="btn"]):visited {
  color: var(--seadays-editorial-link-visited, #9ae4ff);
}
.seo-prose a:not(.directory-btn):hover,
.seo-details .seo-details-body a:hover,
.seo-cross-list a:hover,
.seo-inline-more a:hover,
.seo-detail .seo-body a:hover,
.seo-detail .seo-faq-item a:hover,
.seo-detail .pg-section .pg-prose a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download):hover,
.seo-detail .pg-qa-card a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download):hover,
.seo-detail .pg-call-plan-body a:hover,
.seo-detail .pg-map-credit a:hover,
.article-body a.contextual-link:hover,
.article-body :is(p, li, td, th, figcaption, blockquote, aside:not(.get-seadays-cta)) a[href]:not(.get-seadays-cta-badges a):not([class*="btn"]):hover {
  color: var(--seadays-editorial-link-hover, #a8e8ff);
  text-decoration-color: rgba(168, 232, 255, 0.75);
}
.seo-prose a:not(.directory-btn):focus-visible,
.seo-details .seo-details-body a:focus-visible,
.seo-cross-list a:focus-visible,
.seo-inline-more a:focus-visible,
.seo-detail .pg-section .pg-prose a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download):focus-visible,
.seo-detail .pg-qa-card a:not(.pg-booking-cta):not(.pg-btn):not(.guest-reviews-download):focus-visible,
.seo-detail .pg-map-credit a:focus-visible,
.article-body a.contextual-link:focus-visible {
  outline: 2px solid var(--seadays-editorial-link, #79D8FF);
  outline-offset: 3px;
  border-radius: 4px;
}
`;

/** Leaflet CSS loads after page styles; attribution links default to dark teal-blue. */
const LEAFLET_EDITORIAL_LINK_CSS = `
.seo-detail .port-terminal-map.leaflet-container a,
.seo-detail .leaflet-container.port-terminal-map a,
.seo-detail .port-terminal-map .leaflet-control-attribution a {
  color: var(--seadays-editorial-link, #79D8FF);
  font-weight: 650;
  text-decoration: underline;
  text-decoration-color: rgba(121, 216, 255, 0.45);
  text-underline-offset: 3px;
}
.seo-detail .port-terminal-map.leaflet-container a:hover,
.seo-detail .leaflet-container.port-terminal-map a:hover,
.seo-detail .port-terminal-map .leaflet-control-attribution a:hover {
  color: var(--seadays-editorial-link-hover, #a8e8ff);
  text-decoration-color: rgba(168, 232, 255, 0.75);
}
`;

module.exports = {
  EDITORIAL_LINK_CSS,
  EDITORIAL_LINK_MARKER,
  LEAFLET_EDITORIAL_LINK_CSS,
};
