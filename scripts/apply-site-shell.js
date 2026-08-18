#!/usr/bin/env node
/**
 * Apply the canonical homepage site shell (header + footer) across public pages.
 * Source of truth: scripts/lib/siteShell.js
 *
 * Usage:
 *   node scripts/apply-site-shell.js
 *   node scripts/apply-site-shell.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  getSiteShellCss,
  getSiteHeaderHtml,
  getSiteFooterHtml,
  replaceSiteHeaderInHtml,
  replaceSiteFooterInHtml,
  ensureSiteShellCssLink,
  stripSiteShellMarkers,
} = require('./lib/siteShell');

const ROOT = path.join(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'docs',
  'data',
  'scripts',
  'auth',
  'downloads',
  'logos',
  'marketing',
  'mockups',
  'screenshots',
  'icons',
  'css',
  'js',
]);

/** Feature SEO landings use <header class="header"> for the H1 block — not site chrome. */
const FEATURE_LANDING_DIRS = new Set([
  'cruise-planner',
  'cruise-roll-calls',
  'cruise-community',
  'cruise-budget-planner',
  'cruise-drink-calculator',
]);

const STATIC_SHELL_PAGES = [
  'about.html',
  'contact.html',
  'help.html',
  'faq.html',
  'privacy.html',
  'terms.html',
  'cookies.html',
  'gdpr.html',
  'community.html',
];

function walkHtmlFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      walkHtmlFiles(full, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function isFeatureLandingPage(filePath) {
  const rel = path.relative(ROOT, filePath).split(path.sep);
  return rel.length >= 2 && FEATURE_LANDING_DIRS.has(rel[0]) && rel[1] === 'index.html';
}

function isSiteChromeHeader(html) {
  return /<header\s+class="header"[^>]*>\s*(?:<a[^>]*class="header-brand"[^>]*>[\s\S]*?<\/a>\s*)?<nav\s+class="header-nav"/i.test(
    html
  );
}

function writeCss() {
  const cssPath = path.join(ROOT, 'assets', 'css', 'site-shell.css');
  const css = getSiteShellCss();
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(cssPath), { recursive: true });
    fs.writeFileSync(cssPath, css);
  }
  return cssPath;
}

function applyToGeneratedChromePage(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;

  if (!isSiteChromeHeader(html) && !/<footer\b/i.test(html) && !/seadays-site-shell:/.test(html)) {
    return { changed: false, reason: 'no-site-chrome' };
  }

  html = ensureSiteShellCssLink(html);

  if (isSiteChromeHeader(html) || /seadays-site-shell:header/.test(html)) {
    html = replaceSiteHeaderInHtml(html, { page: 'default' });
  }

  if (/<footer\b/i.test(html) || /seadays-site-shell:footer/.test(html)) {
    html = replaceSiteFooterInHtml(html);
  }

  // Ensure header exists when footer was standardized but header missing
  if (!/seadays-site-shell:header/.test(html) && !isSiteChromeHeader(html)) {
    if (/<div class="content-layer"[^>]*>/i.test(html)) {
      html = html.replace(
        /<div class="content-layer"[^>]*>/i,
        (m) => `${m}\n${getSiteHeaderHtml({ page: 'default' })}\n`
      );
    }
  }

  if (html === before) return { changed: false, reason: 'unchanged' };
  if (!DRY_RUN) fs.writeFileSync(filePath, html);
  return { changed: true };
}

function applyHomepage() {
  const filePath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;

  if (/seadays-site-shell:header/.test(html)) {
    html = replaceSiteHeaderInHtml(html, { page: 'home' });
  } else {
    html = html.replace(
      /<!-- Header ---->[\s\S]*?<header class="header">[\s\S]*?<\/header>/,
      `<!-- Header ---->\n${getSiteHeaderHtml({ page: 'home' })}`
    );
  }

  if (/seadays-site-shell:footer/.test(html)) {
    html = replaceSiteFooterInHtml(html);
  } else {
    html = html.replace(
      /<!-- Footer -->\s*<footer>[\s\S]*?<\/footer>/,
      `<!-- Footer -->\n${getSiteFooterHtml()}`
    );
  }

  // Subtle Press & Media section before footer (idempotent)
  if (!/id="press-media"/.test(html)) {
    const pressSection = `
        <!-- Press & Media (subtle homepage entry) -->
        <section id="press-media" class="fullpage-section" aria-labelledby="press-media-title">
            <div class="container" style="text-align:center; max-width:720px;">
                <h2 id="press-media-title" class="section-title">Press &amp; Media</h2>
                <p class="section-subtitle">Logos, screenshots, and brand assets for journalists, partners, and creators.</p>
                <div class="community-cta-wrap">
                    <a href="/press/" class="btn-secondary" aria-label="View SeaDays press kit">View Press</a>
                </div>
            </div>
        </section>
`;
    html = html.replace(
      /(\s*)(<!-- Footer -->)/,
      `$1${pressSection}\n$1$2`
    );
  }

  if (html === before) return { changed: false };
  if (!DRY_RUN) fs.writeFileSync(filePath, html);
  return { changed: true };
}

function applyCo2() {
  const filePath = path.join(ROOT, 'co2', 'index.html');
  if (!fs.existsSync(filePath)) return { changed: false, reason: 'missing' };
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;
  html = ensureSiteShellCssLink(html);

  if (isSiteChromeHeader(html) || /seadays-site-shell:header/.test(html)) {
    html = replaceSiteHeaderInHtml(html, { page: 'default' });
  } else {
    const header = getSiteHeaderHtml({ page: 'default' });
    if (/<main[^>]*>/i.test(html)) {
      html = html.replace(/<main[^>]*>/i, (m) => `${m}\n${header}\n`);
    } else if (/<div class="content-layer"[^>]*>/i.test(html)) {
      html = html.replace(
        /<div class="content-layer"[^>]*>/i,
        (m) => `${m}\n${header}\n`
      );
    }
  }

  html = replaceSiteFooterInHtml(html);

  if (html === before) return { changed: false };
  if (!DRY_RUN) fs.writeFileSync(filePath, html);
  return { changed: true };
}

function applyPress() {
  const indexPath = path.join(ROOT, 'press', 'index.html');
  const appPath = path.join(ROOT, 'press', 'js', 'press-app.js');
  let changed = false;

  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    const before = html;
    html = ensureSiteShellCssLink(html);
    html = replaceSiteHeaderInHtml(html, { page: 'default' });
    // Press page-local anchors (Assets / Guides) move into in-page content; global shell owns top nav.
    if (html !== before) {
      if (!DRY_RUN) fs.writeFileSync(indexPath, html);
      changed = true;
    }
  }

  if (fs.existsSync(appPath)) {
    let js = fs.readFileSync(appPath, 'utf8');
    const before = js;
    const footerFn = `function renderFooter() {
  return \`
${getSiteFooterHtml()}
  \`;
}`;
    if (/function renderFooter\(\) \{[\s\S]*?\n\}/.test(js)) {
      js = js.replace(/function renderFooter\(\) \{[\s\S]*?\n\}/, footerFn);
    }
    if (js !== before) {
      if (!DRY_RUN) fs.writeFileSync(appPath, js);
      changed = true;
    }
  }

  return { changed };
}

/**
 * Company/legal pages use div.header for titles — inject site chrome without renaming content.
 */
function applyStaticDocumentPage(relPath) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return { changed: false, reason: 'missing' };
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;
  html = ensureSiteShellCssLink(html);

  const hasShellHeader = isSiteChromeHeader(html) || /seadays-site-shell:header/.test(html);
  if (!hasShellHeader) {
    const header = getSiteHeaderHtml({ page: 'default' });
    if (/<div class="content-layer"[^>]*>/i.test(html)) {
      html = html.replace(
        /<div class="content-layer"[^>]*>/i,
        (m) => `${m}\n${header}\n`
      );
    } else if (/<body[^>]*>/i.test(html)) {
      html = html.replace(/<body[^>]*>/i, (m) => `${m}\n${header}\n`);
    }
  } else {
    html = replaceSiteHeaderInHtml(html, { page: 'default' });
  }

  if (!/<footer\b/i.test(html) && !/seadays-site-shell:footer/.test(html)) {
    const footer = getSiteFooterHtml();
    if (/<\/div>\s*<script>/i.test(html)) {
      html = html.replace(/(<\/div>)\s*(<script>)/i, `$1\n${footer}\n$2`);
    } else if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${footer}\n</body>`);
    }
  } else {
    html = replaceSiteFooterInHtml(html);
  }

  // Give document body top padding so absolute header does not cover back-link
  if (!/site-shell-page-pad/.test(html) && /<\/head>/i.test(html)) {
    html = html.replace(
      /<\/head>/i,
      `  <style id="site-shell-page-pad">.content-layer > .container, .content-layer > main, body > .container { padding-top: 88px; }</style>\n</head>`
    );
  }

  if (html === before) return { changed: false };
  if (!DRY_RUN) fs.writeFileSync(filePath, html);
  return { changed: true };
}

function applyFeatureLanding(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;
  html = ensureSiteShellCssLink(html);

  // Do not replace the content <header class="header"> (holds H1). Inject site nav above the container.
  if (!/seadays-site-shell:header/.test(html)) {
    const header = getSiteHeaderHtml({ page: 'default' });
    if (/<body[^>]*>/i.test(html)) {
      html = html.replace(/<body[^>]*>/i, (m) => `${m}\n${header}\n`);
    }
  }

  if (!/<footer\b/i.test(html) && !/seadays-site-shell:footer/.test(html)) {
    const footer = getSiteFooterHtml();
    html = html.replace(/<\/body>/i, `${footer}\n</body>`);
  } else if (/<footer\b/i.test(html)) {
    html = replaceSiteFooterInHtml(html);
  }

  if (!/site-shell-page-pad/.test(html)) {
    html = html.replace(
      /<\/head>/i,
      `  <style id="site-shell-page-pad">body > .container, body > .content-layer { padding-top: 88px; }</style>\n</head>`
    );
  }

  if (html === before) return { changed: false };
  if (!DRY_RUN) fs.writeFileSync(filePath, html);
  return { changed: true };
}

function main() {
  const cssPath = writeCss();
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Wrote ${path.relative(ROOT, cssPath)}`);

  const stats = { changed: 0, skipped: 0, files: [] };

  const home = applyHomepage();
  if (home.changed) {
    stats.changed += 1;
    stats.files.push('index.html');
  } else stats.skipped += 1;

  const co2 = applyCo2();
  if (co2.changed) {
    stats.changed += 1;
    stats.files.push('co2/index.html');
  } else stats.skipped += 1;

  const press = applyPress();
  if (press.changed) {
    stats.changed += 1;
    stats.files.push('press/index.html + press/js/press-app.js');
  } else stats.skipped += 1;

  for (const rel of STATIC_SHELL_PAGES) {
    const r = applyStaticDocumentPage(rel);
    if (r.changed) {
      stats.changed += 1;
      stats.files.push(rel);
    } else stats.skipped += 1;
  }

  for (const dir of FEATURE_LANDING_DIRS) {
    const fp = path.join(ROOT, dir, 'index.html');
    if (!fs.existsSync(fp)) continue;
    const r = applyFeatureLanding(fp);
    if (r.changed) {
      stats.changed += 1;
      stats.files.push(path.relative(ROOT, fp));
    } else stats.skipped += 1;
  }

  const dirs = ['blog', 'ships', 'ports', 'download'].map((d) => path.join(ROOT, d));
  for (const dir of dirs) {
    for (const file of walkHtmlFiles(dir)) {
      if (isFeatureLandingPage(file)) continue;
      const r = applyToGeneratedChromePage(file);
      if (r.changed) {
        stats.changed += 1;
        stats.files.push(path.relative(ROOT, file));
      } else stats.skipped += 1;
    }
  }

  // blog-article.html template if present
  const blogArticle = path.join(ROOT, 'blog-article.html');
  if (fs.existsSync(blogArticle)) {
    const r = applyToGeneratedChromePage(blogArticle);
    if (r.changed) {
      stats.changed += 1;
      stats.files.push('blog-article.html');
    }
  }

  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}Site shell apply complete: ${stats.changed} changed, ${stats.skipped} skipped`
  );
  if (stats.files.length && stats.files.length <= 40) {
    for (const f of stats.files) console.log(' -', f);
  } else if (stats.files.length) {
    console.log(` - (showing 20 of ${stats.files.length})`);
    for (const f of stats.files.slice(0, 20)) console.log(' -', f);
  }
}

main();
