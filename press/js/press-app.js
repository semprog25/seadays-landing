'use strict';

import {
  copyFromTarget,
  copyToClipboard,
  escapeHtml,
  fetchJson,
  formatFileSize,
  hydrateFileSizes,
  observeReveal,
  triggerDownload,
} from './utils.js';
import { initLightbox, lightboxMarkup } from './lightbox.js';

const HERO_LOGO = '/press/mockups/seadays-hero-logo.png';

/** @type {Record<string, unknown>} */
const state = {};

async function loadData() {
  const [press, logos, screenshots, marketing, videos, pressReleases, awards, media, faq, brandGuides] =
    await Promise.all([
      fetchJson('press'),
      fetchJson('logos'),
      fetchJson('screenshots'),
      fetchJson('marketing'),
      fetchJson('videos'),
      fetchJson('press-releases'),
      fetchJson('awards'),
      fetchJson('media'),
      fetchJson('faq'),
      fetchJson('brand-guides'),
    ]);
  state.press = press;
  state.logos = logos;
  state.screenshots = screenshots;
  state.marketing = marketing;
  state.videos = videos;
  state.pressReleases = pressReleases;
  state.awards = awards;
  state.media = media;
  state.faq = faq;
  state.brandGuides = brandGuides;

  const assetItems = [
    ...(logos.items || []),
    ...(screenshots.items || []),
    ...(marketing.items || []),
  ].filter((item) => item.path);
  await hydrateFileSizes(assetItems);
}

function renderHero() {
  const press = state.press;
  const hero = press.hero;
  const completeKit = press.packages.complete.file;
  return `
    <section class="press-hero press-snap-section reveal" id="top" aria-labelledby="hero-title">
      <div class="press-hero-inner container">
        <img src="${HERO_LOGO}" alt="SeaDays – Cruise Planner App" class="hero-logo" width="320" height="auto" decoding="async" fetchpriority="high">
        <p class="eyebrow">Official Media Center</p>
        <h1 id="hero-title" class="tagline">${escapeHtml(hero.headline)}</h1>
        <p class="subtitle">${escapeHtml(hero.intro)}</p>
        <div class="cta-buttons">
          <button type="button" class="btn-primary" data-download="${escapeHtml(completeKit)}" data-filename="SeaDays-PressKit.zip">Download Complete Press Kit</button>
          <a class="btn-secondary" href="#media-contact">Contact Media</a>
        </div>
      </div>
      <div class="scroll-indicator" role="button" tabindex="0" aria-label="Scroll to About SeaDays" data-scroll-target="#about"></div>
    </section>
  `;
}

function renderAbout() {
  const about = state.press.about;
  const variants = [
    { key: 'short', label: 'Short (50 words)', text: about.short },
    { key: 'medium', label: 'Medium (150 words)', text: about.medium },
    { key: 'long', label: 'Long (500 words)', text: about.long },
  ];
  return `
    <section class="press-section press-snap-section press-snap-section--compact reveal" id="about" aria-labelledby="about-title">
      <div class="container">
        <h2 id="about-title" class="section-title">About SeaDays</h2>
        <p class="section-subtitle">Official descriptions for press, partners, and media kits. Pick a length and copy.</p>
        <div class="about-grid">
          ${variants
            .map(
              (variant) => `
            <article class="site-card about-card">
              <div class="about-card-header">
                <h3>${escapeHtml(variant.label)}</h3>
                <button type="button" class="btn-ghost btn-copy about-copy-btn" data-copy="${escapeHtml(variant.text)}">Copy</button>
              </div>
              <div class="about-card-body">
                <p class="about-text">${escapeHtml(variant.text)}</p>
              </div>
            </article>
          `
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderFactSheet() {
  const facts = state.press.factSheet;
  const platformHtml = (facts.platforms || [])
    .map((platform) => {
      const status =
        platform.status === 'available'
          ? ''
          : `<span class="badge">${escapeHtml(platform.status || 'Coming Soon')}</span>`;
      const inner = platform.url
        ? `<a href="${escapeHtml(platform.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(platform.name)}</a>`
        : escapeHtml(platform.name);
      return `<span class="fact-platform">${inner}${status}</span>`;
    })
    .join('');
  const cards = [
    { label: 'App Name', value: facts.appName },
    { label: 'Category', value: facts.category },
    { label: 'Platforms', valueHtml: platformHtml },
    { label: 'Website', valueHtml: `<a href="${escapeHtml(facts.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(facts.website)}</a>` },
    { label: 'Company', value: facts.company },
    { label: 'Languages Supported', value: (facts.languages || []).join(', ') },
    { label: 'Offline Support', value: facts.offlineSupport ? 'Yes' : 'No' },
    { label: 'Current Version', value: facts.currentVersion },
    { label: 'Release Date', value: facts.releaseDate },
    { label: 'Country', value: facts.country },
    { label: 'Industry', value: facts.industry },
  ];
  return `
    <section class="press-section press-snap-section reveal" id="fact-sheet" aria-labelledby="facts-title">
      <div class="container">
        <h2 id="facts-title" class="section-title">Company Fact Sheet</h2>
        <p class="section-subtitle">Key facts at a glance for journalists and analysts.</p>
        <div class="fact-grid">
          ${cards
            .map(
              (card) => `
            <div class="site-card fact-card">
              <span class="fact-label">${escapeHtml(card.label)}</span>
              <div class="fact-value">${card.valueHtml || escapeHtml(card.value || '')}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderAssetCard(item) {
  const preview =
    item.preview ||
    (item.previewSwatches
      ? `<div class="swatch-preview">${item.previewSwatches
          .map((color) => `<span style="background:${escapeHtml(color)}"></span>`)
          .join('')}</div>`
      : `<div class="asset-fallback" aria-hidden="true">PDF</div>`);
  const isImage = item.preview && !item.previewSwatches;
  const previewHtml = isImage
    ? `<img src="${escapeHtml(item.preview)}" alt="" class="asset-preview-img" loading="lazy" decoding="async" width="320" height="180">`
    : typeof preview === 'string' && preview.startsWith('<')
      ? preview
      : `<img src="${escapeHtml(item.preview || '/press/logos/seadays-logo.svg')}" alt="" class="asset-preview-img" loading="lazy" decoding="async" width="320" height="180">`;

  return `
    <article class="site-card asset-card reveal">
      <div class="asset-preview">${previewHtml}</div>
      <div class="asset-meta">
        <h3>${escapeHtml(item.title)}</h3>
        <dl class="asset-details">
          <div><dt>Filename</dt><dd>${escapeHtml(item.filename)}</dd></div>
          <div><dt>Resolution</dt><dd>${escapeHtml(item.resolution || '—')}</dd></div>
          <div><dt>Size</dt><dd>${formatFileSize(item.fileSize)}</dd></div>
        </dl>
        <button type="button" class="btn-primary btn-block" data-download="${escapeHtml(item.path)}" data-filename="${escapeHtml(item.filename)}">Download</button>
      </div>
    </article>
  `;
}

function renderBrandAssets() {
  const items = state.logos.items || [];
  return `
    <section class="press-section press-snap-section reveal" id="brand-assets" aria-labelledby="assets-title">
      <div class="container">
        <h2 id="assets-title" class="section-title">Downloadable Brand Assets</h2>
        <p class="section-subtitle">Official logos and app icons for press, partners, and editorial use.</p>
        <div class="asset-grid">
          ${items.map((item) => renderAssetCard(item)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderGuideSection(section) {
  const parts = [`<h4>${escapeHtml(section.heading)}</h4>`];
  if (section.paragraphs?.length) {
    parts.push(section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join(''));
  }
  if (section.list?.length) {
    parts.push(`<ul>${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
  }
  if (section.colors?.length) {
    parts.push(
      `<div class="guide-color-list">${section.colors
        .map(
          (color) => `
        <div class="color-chip">
          <span class="color-swatch" style="background:${escapeHtml(color.hex)}"></span>
          <div><strong>${escapeHtml(color.name)}</strong><span>${escapeHtml(color.hex)}</span><p>${escapeHtml(color.usage)}</p></div>
        </div>
      `
        )
        .join('')}</div>`
    );
  }
  return `<div class="copy-guide-section">${parts.join('')}</div>`;
}

function renderGuideCard(guide) {
  if (!guide) return '';
  const targetId = `copy-guide-${guide.id}`;
  return `
    <article class="site-card copy-guide-card copy-guide-card--scroll">
      <div class="copy-guide-header">
        <div>
          <h3>${escapeHtml(guide.title)}</h3>
          <p class="copy-guide-description">${escapeHtml(guide.description)}</p>
        </div>
        <button type="button" class="btn-ghost btn-copy" data-copy-target="${escapeHtml(targetId)}">Copy</button>
      </div>
      <div class="copy-guide-body copy-guide-scroll" id="${escapeHtml(targetId)}">
        ${(guide.sections || []).map((section) => renderGuideSection(section)).join('')}
      </div>
    </article>
  `;
}

function renderBrandGuides() {
  const items = state.brandGuides.items || [];
  const guidelines = items.find((guide) => guide.id === 'brand-guidelines');
  const colors = items.find((guide) => guide.id === 'color-palette');
  const typography = items.find((guide) => guide.id === 'typography-guide');
  return `
    <section class="press-section press-snap-section reveal" id="brand-guides" aria-labelledby="guides-title">
      <div class="container">
        <h2 id="guides-title" class="section-title">Brand Guides</h2>
        <p class="section-subtitle">Copy official SeaDays brand guidance directly into articles, decks, and partner materials.</p>
        <div class="copy-guide-duo">
          ${renderGuideCard(guidelines)}
          ${renderGuideCard(colors)}
        </div>
        <div class="copy-guide-single">
          ${renderGuideCard(typography)}
        </div>
      </div>
    </section>
  `;
}

function galleryThumbClass(layout) {
  if (layout === 'banner-wide' || layout === 'feature') return 'gallery-thumb--wide';
  if (layout === 'banner-story') return 'gallery-thumb--story';
  if (layout === 'logo') return 'gallery-thumb--logo';
  return 'gallery-thumb--wide';
}

function galleryCardClass(layout) {
  if (layout === 'banner-wide' || layout === 'logo') return 'gallery-card--wide';
  if (layout === 'banner-story') return 'gallery-card--story';
  return '';
}

function galleryBadgeLabel(item) {
  const layout = item.layout || item.category || 'asset';
  if (layout === 'banner-wide') return 'Wide banner';
  if (layout === 'banner-story') return 'Story banner';
  if (layout === 'feature') return 'Feature';
  if (layout === 'logo') return 'Logo';
  return layout;
}

function renderGalleryItem(item, zipPath) {
  const layout = item.layout || item.category;
  const thumbClass = galleryThumbClass(layout);
  const cardClass = galleryCardClass(layout);
  return `
    <article class="site-card gallery-card reveal${cardClass ? ` ${cardClass}` : ''}">
      <button type="button" class="gallery-thumb ${thumbClass}" data-lightbox data-lightbox-src="${escapeHtml(item.preview)}" data-lightbox-alt="${escapeHtml(item.alt || item.title)}" data-lightbox-download="${escapeHtml(item.path)}" data-lightbox-filename="${escapeHtml(item.filename)}" aria-label="Enlarge ${escapeHtml(item.title)}">
        <img src="${escapeHtml(item.thumbnail || item.preview)}" alt="${escapeHtml(item.alt || item.title)}" loading="lazy" decoding="async">
        <span class="gallery-badge">${escapeHtml(galleryBadgeLabel(item))}</span>
      </button>
      <div class="gallery-meta">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${formatFileSize(item.fileSize)} · ${escapeHtml(item.resolution || '')}</p>
        <button type="button" class="btn-ghost" data-download="${escapeHtml(item.path)}" data-filename="${escapeHtml(item.filename)}">Download</button>
      </div>
    </article>
  `;
}

function renderScreenshots() {
  const data = state.screenshots;
  const items = data.items || [];
  return `
    <section class="press-section press-snap-section reveal" id="screenshots" aria-labelledby="screenshots-title">
      <div class="container">
        <div class="row-heading">
          <div>
            <h2 id="screenshots-title" class="section-title">Screenshots</h2>
            <p class="section-subtitle">High-resolution app screenshots for reviews and editorial coverage.</p>
          </div>
          <button type="button" class="btn-secondary" data-download="${escapeHtml(data.zip)}" data-filename="SeaDays-Screenshots.zip">Download all ZIP</button>
        </div>
        <div class="gallery-grid">
          ${items.map((item) => renderGalleryItem(item, data.zip)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderMarketing() {
  const data = state.marketing;
  const items = data.items || [];
  return `
    <section class="press-section press-snap-section reveal" id="marketing" aria-labelledby="marketing-title">
      <div class="container">
        <div class="row-heading">
          <div>
            <h2 id="marketing-title" class="section-title">Marketing Images</h2>
            <p class="section-subtitle">Mockups, lifestyle graphics, banners, and social assets.</p>
          </div>
          <button type="button" class="btn-secondary" data-download="${escapeHtml(data.zip)}" data-filename="SeaDays-Marketing.zip">Download all ZIP</button>
        </div>
        <div class="gallery-grid gallery-grid--marketing">
          ${items.map((item) => renderGalleryItem(item, data.zip)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderVideos() {
  const items = state.videos.items || [];
  return `
    <section class="press-section press-snap-section reveal" id="videos" aria-labelledby="videos-title">
      <div class="container">
        <h2 id="videos-title" class="section-title">Videos</h2>
        <p class="section-subtitle">Promotional videos for editorial and social coverage.</p>
        <div class="video-grid">
          ${items
            .map((video) => {
              if (video.embedUrl) {
                return `
                  <article class="site-card video-card">
                    <div class="video-embed">
                      <iframe src="${escapeHtml(video.embedUrl)}" title="${escapeHtml(video.title)}" loading="lazy" allowfullscreen></iframe>
                    </div>
                    <h3>${escapeHtml(video.title)}</h3>
                    <p>${escapeHtml(video.description)}</p>
                    ${video.path ? `<button type="button" class="btn-ghost" data-download="${escapeHtml(video.path)}" data-filename="${escapeHtml(video.filename || 'seadays-video.mp4')}">Download original</button>` : ''}
                  </article>
                `;
              }
              return `
                <article class="site-card video-card">
                  <div class="video-poster">
                    <img src="${escapeHtml(video.poster)}" alt="${escapeHtml(video.title)} preview" loading="lazy" decoding="async">
                    ${video.comingSoon ? '<span class="video-soon">Coming soon</span>' : ''}
                  </div>
                  <h3>${escapeHtml(video.title)}</h3>
                  <p>${escapeHtml(video.description)}</p>
                </article>
              `;
            })
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderPressReleases() {
  const items = state.pressReleases.items || [];
  return `
    <section class="press-section press-snap-section reveal" id="press-releases" aria-labelledby="releases-title">
      <div class="container">
        <h2 id="releases-title" class="section-title">Latest Press Releases</h2>
        <p class="section-subtitle">Official announcements from SeaDays.</p>
        <div class="release-stack">
          ${items
            .map(
              (release) => `
            <article class="site-card release-card">
              <time datetime="${escapeHtml(release.date)}">${escapeHtml(new Date(release.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}</time>
              <h3>${escapeHtml(release.title)}</h3>
              <p>${escapeHtml(release.summary)}</p>
              ${release.copyText ? `<pre class="release-copy-source" id="press-release-${escapeHtml(release.id)}">${escapeHtml(release.copyText)}</pre>` : ''}
              <div class="release-actions">
                ${release.readOnlineUrl ? `<a class="btn-ghost" href="${escapeHtml(release.readOnlineUrl)}" target="_blank" rel="noopener noreferrer">Read online</a>` : ''}
                ${release.copyText ? `<button type="button" class="btn-ghost btn-copy" data-copy-target="press-release-${escapeHtml(release.id)}">Copy press release</button>` : ''}
              </div>
            </article>
          `
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderContact() {
  const contact = state.press.contact;
  return `
    <section class="press-section press-snap-section reveal" id="media-contact" aria-labelledby="contact-title">
      <div class="container">
        <h2 id="contact-title" class="section-title">Media Contact</h2>
        <p class="section-subtitle">Reach our team for interviews, assets, and partnership inquiries.</p>
        <div class="contact-grid">
          <div class="site-card contact-card">
            <span class="contact-label">Media Email</span>
            <a href="mailto:${escapeHtml(contact.mediaEmail)}">${escapeHtml(contact.mediaEmail)}</a>
            <button type="button" class="btn-ghost btn-copy" data-copy="${escapeHtml(contact.mediaEmail)}">Copy</button>
          </div>
          <div class="site-card contact-card">
            <span class="contact-label">Website</span>
            <a href="${escapeHtml(contact.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(contact.website)}</a>
            <button type="button" class="btn-ghost btn-copy" data-copy="${escapeHtml(contact.website)}">Copy</button>
          </div>
          ${(contact.social || [])
            .map(
              (social) => `
            <div class="site-card contact-card">
              <span class="contact-label">${escapeHtml(social.name)}</span>
              <a href="${escapeHtml(social.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(social.label)}</a>
              <button type="button" class="btn-ghost btn-copy" data-copy="${escapeHtml(social.url)}">Copy</button>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderAwards() {
  const items = state.awards.items || [];
  return `
    <section class="press-section press-snap-section reveal" id="awards" aria-labelledby="awards-title">
      <div class="container">
        <h2 id="awards-title" class="section-title">Awards & Recognition</h2>
        ${
          items.length
            ? `<div class="award-grid">${items
                .map(
                  (award) => `
              <article class="site-card award-card">
                <span class="award-year">${escapeHtml(award.year || '')}</span>
                <h3>${escapeHtml(award.title)}</h3>
                <p>${escapeHtml(award.organization || '')}</p>
              </article>
            `
                )
                .join('')}</div>`
            : '<p class="empty-state">Awards and recognition will be listed here as SeaDays grows.</p>'
        }
      </div>
    </section>
  `;
}

function renderMediaCoverage() {
  const items = state.media.items || [];
  return `
    <section class="press-section press-snap-section reveal" id="media-coverage" aria-labelledby="coverage-title">
      <div class="container">
        <h2 id="coverage-title" class="section-title">Recent News & Media Coverage</h2>
        ${
          items.length
            ? `<div class="media-grid">${items
                .map((entry) => {
                  const typeLabel = escapeHtml(entry.type || 'article');
                  return `
                <article class="site-card media-card">
                  <span class="media-type">${typeLabel}</span>
                  <h3>${entry.url ? `<a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.title)}</a>` : escapeHtml(entry.title)}</h3>
                  <p>${escapeHtml(entry.publication || '')}</p>
                  ${entry.date ? `<time datetime="${escapeHtml(entry.date)}">${escapeHtml(new Date(entry.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))}</time>` : ''}
                </article>
              `;
                })
                .join('')}</div>`
            : '<p class="empty-state">No media coverage yet.</p>'
        }
      </div>
    </section>
  `;
}

function renderFaq() {
  const items = state.faq.items || [];
  return `
    <section class="press-section press-snap-section reveal" id="faq" aria-labelledby="faq-title">
      <div class="container">
        <h2 id="faq-title" class="section-title">Frequently Asked Questions</h2>
        <div class="faq-list">
          ${items
            .map(
              (item, index) => `
            <details class="faq-item site-card" ${index === 0 ? 'open' : ''}>
              <summary>${escapeHtml(item.question)}</summary>
              <p>${escapeHtml(item.answer)}</p>
            </details>
          `
            )
            .join('')}
        </div>
      </div>
    </section>
  `;
}

function renderLegal() {
  const legal = state.press.legal;
  return `
    <section class="press-section press-snap-section press-legal reveal" id="legal" aria-labelledby="legal-title">
      <div class="container">
        <h2 id="legal-title" class="visually-hidden">Legal</h2>
        <div class="site-card legal-banner">
          <p>${escapeHtml(legal.disclaimer)}</p>
          <p>${escapeHtml(legal.trademarkNotice)}</p>
          <p>© ${new Date().getFullYear()} SeaDays. All rights reserved.</p>
        </div>
      </div>
    </section>
  `;
}

function renderFooter() {
  return `
<!-- seadays-site-shell:footer -->
        <footer>
            <div class="container">
                <div class="footer-shell">
                    <div class="footer-brand">
                        <a class="footer-brand-logo" href="/" aria-label="SeaDays home">
                            <img src="/press/logos/seadays-logo-dark.png" alt="SeaDays" width="180" height="40" decoding="async">
                        </a>
                        <p class="footer-brand-desc">SeaDays is a cruise planning and community app for smarter voyages.</p>
                        <p class="footer-brand-meta">made with love from the port city of <span class="footer-hamburg">Hamburg <span aria-hidden="true">⚓</span></span></p>
                        <ul class="footer-social">
                            <li><a href="https://www.instagram.com/seadaysapp/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
                            <li><a href="https://www.tiktok.com/@seadaysapp" target="_blank" rel="noopener noreferrer">TikTok</a></li>
                        </ul>
                    </div>

                    <div class="footer-content">
                        <div class="footer-section">
                            <h4>Explore</h4>
                            <ul>
                                <li><a href="/ships/">Ships</a></li>
                                <li><a href="/ports/">Ports</a></li>
                                <li><a href="/blog/">Blog</a></li>
                                <li><a href="/press/">Press</a></li>
                                <li><a href="/#blog">SeaStories</a></li>
                            </ul>
                        </div>
                        <div class="footer-section">
                            <h4>Plan</h4>
                            <ul>
                                <li><a href="/cruise-planner/">Cruise Planner</a></li>
                                <li><a href="/cruise-roll-calls/">Roll Calls</a></li>
                                <li><a href="/cruise-community/">Cruise Community</a></li>
                                <li><a href="/#cruise-passport">Cruise Passport</a></li>
                                <li><a href="/download/?utm_source=seadays_web&amp;utm_medium=footer&amp;utm_campaign=organic_web">Get SeaDays</a></li>
                            </ul>
                        </div>
                        <div class="footer-section">
                            <h4>SeaDays</h4>
                            <ul>
                                <li><a href="/about.html">About</a></li>
                                <li><a href="/help.html">Help</a></li>
                                <li><a href="/faq.html">FAQ</a></li>
                                <li><a href="/contact.html">Contact</a></li>
                            </ul>
                        </div>
                        <div class="footer-section">
                            <h4>Sustainability</h4>
                            <ul>
                                <li><a href="/co2/">CO₂ Contribution</a></li>
                            </ul>
                        </div>
                        <div class="footer-section footer-section--legal">
                            <h4>Legal</h4>
                            <ul>
                                <li><a href="/privacy.html">Privacy</a></li>
                                <li><a href="/security.html">Security</a></li>
                                <li><a href="/terms.html">Terms</a></li>
                                <li><a href="/cookies.html">Cookie Policy</a></li>
                                <li><a href="/gdpr.html">GDPR</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="footer-mobile-brand">
                    <a class="footer-logo-mobile" href="/" aria-label="SeaDays home">
                        <img src="/press/logos/seadays-logo-dark.png" alt="SeaDays" width="160" height="36" decoding="async">
                    </a>
                    <p class="footer-brand-desc">SeaDays is a cruise planning and community app for smarter voyages.</p>
                    <p class="footer-brand-meta">made with love from the port city of <span class="footer-hamburg">Hamburg <span aria-hidden="true">⚓</span></span></p>
                </div>

                <div class="footer-bottom">
                    <p>© 2026 SeaDays. All rights reserved.</p>
                    <a href="https://seadays.app/" style="position:absolute; left:-9999px;">SeaDays Cruise Planner</a>
                </div>
            </div>
        </footer>
        <!-- seadays-site-shell:footer-end seadays-site-shell -->
  `;
}

function bindScrollTargets() {
  document.querySelectorAll('[data-scroll-target]').forEach((element) => {
    if (!(element instanceof HTMLElement)) return;
    const scrollToTarget = () => {
      const selector = element.dataset.scrollTarget;
      if (!selector) return;
      document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
    };
    element.addEventListener('click', scrollToTarget);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        scrollToTarget();
      }
    });
  });
}

function bindInteractions() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const downloadBtn = target.closest('[data-download]');
    if (downloadBtn instanceof HTMLElement) {
      const url = downloadBtn.dataset.download;
      const filename = downloadBtn.dataset.filename || 'seadays-download';
      if (url) {
        event.preventDefault();
        void triggerDownload(url, filename);
      }
      return;
    }

    const copyBtn = target.closest('[data-copy]');
    if (copyBtn instanceof HTMLButtonElement) {
      event.stopPropagation();
      const text = copyBtn.dataset.copy;
      if (text) copyToClipboard(text, copyBtn);
      return;
    }

    const copyTargetBtn = target.closest('[data-copy-target]');
    if (copyTargetBtn instanceof HTMLButtonElement) {
      event.stopPropagation();
      const targetId = copyTargetBtn.dataset.copyTarget;
      if (targetId) copyFromTarget(targetId, copyTargetBtn);
    }
  });
}

function injectStructuredData() {
  const press = state.press;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://seadays.app/press/#webpage',
        url: 'https://seadays.app/press/',
        name: press.meta.title,
        description: press.meta.description,
        isPartOf: { '@id': 'https://seadays.app/#website' },
        breadcrumb: { '@id': 'https://seadays.app/press/#breadcrumb' },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': 'https://seadays.app/press/#breadcrumb',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://seadays.app/' },
          { '@type': 'ListItem', position: 2, name: 'Press Kit', item: 'https://seadays.app/press/' },
        ],
      },
      {
        '@type': 'Organization',
        '@id': 'https://seadays.app/#organization',
        name: 'SeaDays',
        url: 'https://seadays.app',
        logo: 'https://seadays.app/press/logos/seadays-logo.svg',
        sameAs: (press.contact.social || []).map((item) => item.url),
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'media relations',
          email: press.contact.mediaEmail,
          url: 'https://seadays.app/press/',
        },
      },
      {
        '@type': 'MobileApplication',
        name: 'SeaDays',
        applicationCategory: 'TravelApplication',
        operatingSystem: 'Android, iOS',
        softwareVersion: press.factSheet.currentVersion,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        image: 'https://seadays.app/press/icons/seadays-app-icon-1024.png',
      },
    ],
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

function renderPage() {
  const root = document.getElementById('press-app');
  if (!root) return;
  root.innerHTML = [
    renderHero(),
    renderAbout(),
    renderFactSheet(),
    renderBrandAssets(),
    renderBrandGuides(),
    renderScreenshots(),
    renderMarketing(),
    renderVideos(),
    renderPressReleases(),
    renderContact(),
    renderAwards(),
    renderMediaCoverage(),
    renderFaq(),
    renderLegal(),
    lightboxMarkup(),
  ].join('');
}

function showError(message) {
  const root = document.getElementById('press-app');
  if (!root) return;
  root.innerHTML = `<div class="container press-error"><h1>Unable to load press kit</h1><p>${escapeHtml(message)}</p></div>`;
}

async function init() {
  try {
    await loadData();
    renderPage();
    injectStructuredData();
    initLightbox();
    bindInteractions();
    bindScrollTargets();
    observeReveal('.reveal');
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unknown error');
  }
}

init();
