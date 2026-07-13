'use strict';

import {
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
  const [press, logos, screenshots, marketing, videos, pressReleases, awards, media, faq] =
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
    <section class="press-hero reveal" id="top" aria-labelledby="hero-title">
      <div class="press-hero-inner container">
        <img src="${HERO_LOGO}" alt="SeaDays – Cruise Planner App" class="hero-logo" width="360" height="auto" decoding="async" fetchpriority="high">
        <p class="eyebrow">Official Media Center</p>
        <h1 id="hero-title" class="tagline">${escapeHtml(hero.headline)}</h1>
        <p class="subtitle">${escapeHtml(hero.intro)}</p>
        <div class="cta-buttons">
          <button type="button" class="btn-primary" data-download="${escapeHtml(completeKit)}" data-filename="SeaDays-PressKit.zip">Download Complete Press Kit</button>
          <a class="btn-secondary" href="#media-contact">Contact Media</a>
        </div>
      </div>
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
    <section class="press-section reveal" id="about" aria-labelledby="about-title">
      <div class="container">
        <h2 id="about-title" class="section-title">About SeaDays</h2>
        <p class="section-subtitle">Official descriptions for press, partners, and media kits.</p>
        <div class="about-grid">
          ${variants
            .map(
              (variant) => `
            <article class="site-card about-card">
              <div class="about-card-header">
                <h3>${escapeHtml(variant.label)}</h3>
                <button type="button" class="btn-ghost btn-copy" data-copy="${escapeHtml(variant.text)}">Copy</button>
              </div>
              <p class="about-text">${escapeHtml(variant.text)}</p>
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
    <section class="press-section reveal" id="fact-sheet" aria-labelledby="facts-title">
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
    <section class="press-section reveal" id="brand-assets" aria-labelledby="assets-title">
      <div class="container">
        <h2 id="assets-title" class="section-title">Downloadable Brand Assets</h2>
        <p class="section-subtitle">Official logos, icons, and brand documentation.</p>
        <div class="asset-grid">
          ${items.map((item) => renderAssetCard(item)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderGalleryItem(item, zipPath) {
  return `
    <article class="site-card gallery-card reveal">
      <button type="button" class="gallery-thumb" data-lightbox data-lightbox-src="${escapeHtml(item.preview)}" data-lightbox-alt="${escapeHtml(item.alt || item.title)}" data-lightbox-download="${escapeHtml(item.path)}" data-lightbox-filename="${escapeHtml(item.filename)}" aria-label="Enlarge ${escapeHtml(item.title)}">
        <img src="${escapeHtml(item.thumbnail || item.preview)}" alt="${escapeHtml(item.alt || item.title)}" loading="lazy" decoding="async" width="400" height="300">
        <span class="gallery-badge">${escapeHtml(item.layout || item.category || 'asset')}</span>
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
    <section class="press-section reveal" id="screenshots" aria-labelledby="screenshots-title">
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
    <section class="press-section reveal" id="marketing" aria-labelledby="marketing-title">
      <div class="container">
        <div class="row-heading">
          <div>
            <h2 id="marketing-title" class="section-title">Marketing Images</h2>
            <p class="section-subtitle">Mockups, lifestyle graphics, banners, and social assets.</p>
          </div>
          <button type="button" class="btn-secondary" data-download="${escapeHtml(data.zip)}" data-filename="SeaDays-Marketing.zip">Download all ZIP</button>
        </div>
        <div class="gallery-grid">
          ${items.map((item) => renderGalleryItem(item, data.zip)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderVideos() {
  const items = state.videos.items || [];
  return `
    <section class="press-section reveal" id="videos" aria-labelledby="videos-title">
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
                    <img src="${escapeHtml(video.poster)}" alt="" loading="lazy" decoding="async">
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
    <section class="press-section reveal" id="press-releases" aria-labelledby="releases-title">
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
              <div class="release-actions">
                ${release.readOnlineUrl ? `<a class="btn-ghost" href="${escapeHtml(release.readOnlineUrl)}" target="_blank" rel="noopener noreferrer">Read online</a>` : ''}
                ${release.pdfPath ? `<button type="button" class="btn-primary" data-download="${escapeHtml(release.pdfPath)}" data-filename="SeaDays-Press-Release.pdf">Download PDF</button>` : ''}
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
    <section class="press-section reveal" id="media-contact" aria-labelledby="contact-title">
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
    <section class="press-section reveal" id="awards" aria-labelledby="awards-title">
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
    <section class="press-section reveal" id="media-coverage" aria-labelledby="coverage-title">
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
    <section class="press-section reveal" id="faq" aria-labelledby="faq-title">
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

function renderBrandGuidelines() {
  const guide = state.press.brandGuidelines;
  return `
    <section class="press-section reveal" id="brand-guidelines" aria-labelledby="guidelines-title">
      <div class="container">
        <h2 id="guidelines-title" class="section-title">Brand Usage Guidelines</h2>
        <p class="section-subtitle">Please follow these rules when using SeaDays brand assets.</p>
        <div class="guidelines-grid">
          <article class="site-card">
            <h3>Minimum logo spacing</h3>
            <p>${escapeHtml(guide.logoSpacing)}</p>
          </article>
          <article class="site-card">
            <h3>Allowed logo versions</h3>
            <ul>${(guide.allowedVersions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </article>
          <article class="site-card">
            <h3>Logo misuse examples</h3>
            <ul class="misuse-list">${(guide.misuseExamples || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </article>
          <article class="site-card">
            <h3>Primary colors</h3>
            <div class="color-list">
              ${(guide.primaryColors || [])
                .map(
                  (color) => `
                <div class="color-chip">
                  <span class="color-swatch" style="background:${escapeHtml(color.hex)}"></span>
                  <div><strong>${escapeHtml(color.name)}</strong><span>${escapeHtml(color.hex)}</span><p>${escapeHtml(color.usage)}</p></div>
                </div>
              `
                )
                .join('')}
            </div>
          </article>
          <article class="site-card">
            <h3>Secondary colors</h3>
            <div class="color-list">
              ${(guide.secondaryColors || [])
                .map(
                  (color) => `
                <div class="color-chip">
                  <span class="color-swatch" style="background:${escapeHtml(color.hex)}"></span>
                  <div><strong>${escapeHtml(color.name)}</strong><span>${escapeHtml(color.hex)}</span><p>${escapeHtml(color.usage)}</p></div>
                </div>
              `
                )
                .join('')}
            </div>
          </article>
          <article class="site-card">
            <h3>Typography</h3>
            <p><strong>Primary:</strong> ${escapeHtml(guide.typography.primary)}</p>
            <p><strong>Headings:</strong> ${escapeHtml(guide.typography.headings)}</p>
            <p><strong>Body:</strong> ${escapeHtml(guide.typography.body)}</p>
          </article>
          <article class="site-card">
            <h3>Screenshots & marketing images</h3>
            <p>${escapeHtml(guide.screenshotRules)}</p>
            <p>${escapeHtml(guide.marketingImageRules)}</p>
          </article>
          <article class="site-card legal-card">
            <h3>Trademark & copyright</h3>
            <p>${escapeHtml(guide.trademark)}</p>
            <p>${escapeHtml(guide.copyright)}</p>
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderLegal() {
  const legal = state.press.legal;
  return `
    <section class="press-section press-legal reveal" id="legal" aria-labelledby="legal-title">
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
    <footer>
      <div class="container">
        <div class="footer-content">
          <div class="footer-section">
            <h4>Product</h4>
            <ul>
              <li><a href="https://seadays.app/#cruise-planning-tools">Features</a></li>
              <li><a href="https://seadays.app/#community">Community</a></li>
              <li><a href="https://seadays.app/blog/">Blog</a></li>
              <li><a href="https://seadays.app/#home">Download</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Company</h4>
            <ul>
              <li><a href="https://seadays.app/about.html">About Us</a></li>
              <li><a href="https://seadays.app/press/">Press</a></li>
              <li><a href="https://seadays.app/help.html">Help Center</a></li>
              <li><a href="https://seadays.app/contact.html">Contact</a></li>
              <li><a href="https://seadays.app/faq.html">FAQ</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Legal</h4>
            <ul>
              <li><a href="https://seadays.app/privacy.html">Privacy Policy</a></li>
              <li><a href="https://seadays.app/terms.html">Terms of Service</a></li>
              <li><a href="https://seadays.app/cookies.html">Cookie Policy</a></li>
              <li><a href="https://seadays.app/gdpr.html">GDPR</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Connect</h4>
            <ul>
              <li><a href="#">Twitter</a></li>
              <li><a href="https://www.instagram.com/seadaysapp/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
              <li><a href="#">Facebook</a></li>
              <li><a href="https://www.tiktok.com/@seadaysapp" target="_blank" rel="noopener noreferrer">TikTok</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <p>made with love from the port city of Hamburg <span aria-hidden="true">⚓</span></p>
          <p>© ${new Date().getFullYear()} SeaDays. All rights reserved.</p>
          <a href="https://seadays.app/" style="position:absolute; left:-9999px;">SeaDays Cruise Planner</a>
        </div>
      </div>
    </footer>
  `;
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
        triggerDownload(url, filename);
      }
      return;
    }

    const copyBtn = target.closest('[data-copy]');
    if (copyBtn instanceof HTMLButtonElement) {
      const text = copyBtn.dataset.copy;
      if (text) copyToClipboard(text, copyBtn);
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
    renderScreenshots(),
    renderMarketing(),
    renderVideos(),
    renderPressReleases(),
    renderContact(),
    renderAwards(),
    renderMediaCoverage(),
    renderFaq(),
    renderBrandGuidelines(),
    renderLegal(),
    renderFooter(),
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
    observeReveal('.reveal');
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unknown error');
  }
}

init();
