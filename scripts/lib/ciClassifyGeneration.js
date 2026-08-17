'use strict';

/**
 * Map git path changes to a landing generation channel.
 *
 * Normal landing HTML/CSS/asset pushes must not regenerate blogs or the
 * 412-port catalogue. Shared generator/templates that affect every page
 * select `full` without orphan cleanup.
 */

const { commitMessageForChannel } = require('./generateMode');

const FULL_PATTERNS = [
  /^scripts\/generateBlogs\.js$/,
  /^scripts\/lib\/analyticsSnippet\.js$/,
  /^scripts\/lib\/faviconHead\.js$/,
];

const BLOG_PATTERNS = [
  /^scripts\/lib\/adsenseArticleSlot\.js$/,
  /^scripts\/lib\/adsenseConfig\.js$/,
  /^scripts\/lib\/seoKeywordLinks\.js$/,
  /^scripts\/inject-blog-ad-slots\.js$/,
  /^scripts\/inject-blog-port-links\.js$/,
  /^scripts\/inject-analytics-head\.js$/,
  /^blog-article\.html$/,
];

const PORT_PATTERNS = [
  /^scripts\/regenerate-port-pages\.js$/,
  /^scripts\/regenerate-ports-index\.js$/,
  /^scripts\/extract-public-port-guides\.js$/,
  /^scripts\/extract-public-port-terminals\.js$/,
  /^scripts\/lib\/portSeoRedirects\.js$/,
  /^scripts\/lib\/portsDirectoryIndex\.js$/,
  /^scripts\/lib\/publicPortGuideAdapter\.js$/,
  /^scripts\/lib\/portGuideSections\.js$/,
  /^scripts\/lib\/viatorAffiliate\.js$/,
  /^data\/public-port-guides\.json$/,
  /^data\/public-port-terminals\.json$/,
  /^data\/known-affiliate-port-ids\.json$/,
];

const CATALOGUE_PATTERNS = [
  /^scripts\/lib\/appCruiseDataset\.js$/,
  /^scripts\/lib\/seoShipPortPages\.js$/,
  /^scripts\/lib\/seoShipPortFallbacks\.js$/,
  /^scripts\/lib\/landingCruiseContentOverrides\.js$/,
  /^scripts\/lib\/reviewAggregateMerge\.js$/,
  /^scripts\/fix-featured-guide-thumbnails\.js$/,
  /^data\/landing-cruise-content-overrides\.json$/,
];

const SITEMAP_PATTERNS = [
  /^scripts\/generate-sitemap\.js$/,
  /^robots\.txt$/,
];

function normalizePath(file) {
  return String(file || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
}

function matchesAny(patterns, file) {
  return patterns.some((re) => re.test(file));
}

function emptyPlan(channel, extra = {}) {
  return {
    skip: channel === 'skip',
    channel,
    blogs: false,
    ships: false,
    ports: false,
    allowOrphanCleanup: false,
    needsViator: false,
    needsFeaturedThumbs: false,
    commitMessage: '',
    ...extra,
  };
}

function planForChannel(channel, { allowOrphanCleanup = false } = {}) {
  if (!channel || channel === 'skip' || channel === 'deploy') {
    return emptyPlan('skip');
  }
  if (channel === 'sitemap') {
    return emptyPlan('sitemap', {
      commitMessage: commitMessageForChannel('sitemap'),
    });
  }
  if (channel === 'blogs') {
    return {
      skip: false,
      channel: 'blogs',
      blogs: true,
      ships: false,
      ports: false,
      allowOrphanCleanup: false,
      needsViator: false,
      needsFeaturedThumbs: false,
      commitMessage: commitMessageForChannel('blogs'),
    };
  }
  if (channel === 'ports') {
    return {
      skip: false,
      channel: 'ports',
      blogs: false,
      ships: false,
      ports: true,
      allowOrphanCleanup: false,
      needsViator: true,
      needsFeaturedThumbs: true,
      commitMessage: commitMessageForChannel('ports'),
    };
  }
  if (channel === 'ships') {
    return {
      skip: false,
      channel: 'ships',
      blogs: false,
      ships: true,
      ports: false,
      allowOrphanCleanup: false,
      needsViator: false,
      needsFeaturedThumbs: true,
      commitMessage: commitMessageForChannel('ships'),
    };
  }
  if (channel === 'catalogue') {
    return {
      skip: false,
      channel: 'catalogue',
      blogs: false,
      ships: true,
      ports: true,
      allowOrphanCleanup: false,
      needsViator: true,
      needsFeaturedThumbs: true,
      commitMessage: commitMessageForChannel('catalogue'),
    };
  }
  if (channel === 'full') {
    return {
      skip: false,
      channel: 'full',
      blogs: true,
      ships: true,
      ports: true,
      allowOrphanCleanup: Boolean(allowOrphanCleanup),
      needsViator: true,
      needsFeaturedThumbs: true,
      commitMessage: commitMessageForChannel('full'),
    };
  }
  throw new Error(`Unknown generation channel: ${channel}`);
}

function classifyChangedFiles(files) {
  const normalized = (Array.isArray(files) ? files : []).map(normalizePath).filter(Boolean);
  let blogs = false;
  let ports = false;
  let catalogue = false;
  let full = false;
  let sitemap = false;

  for (const file of normalized) {
    if (matchesAny(FULL_PATTERNS, file)) full = true;
    if (matchesAny(BLOG_PATTERNS, file)) blogs = true;
    if (matchesAny(PORT_PATTERNS, file)) ports = true;
    if (matchesAny(CATALOGUE_PATTERNS, file)) catalogue = true;
    if (matchesAny(SITEMAP_PATTERNS, file)) sitemap = true;
  }

  if (full) return planForChannel('full');
  if (catalogue) return planForChannel('catalogue');
  if (ports) return planForChannel('ports');
  if (blogs) return planForChannel('blogs');
  if (sitemap) return planForChannel('sitemap');
  return emptyPlan('skip');
}

function resolveGenerationPlan({
  eventName = 'push',
  changedFiles = [],
  dispatchChannel = '',
  allowOrphanCleanup = false,
} = {}) {
  const event = String(eventName || 'push');
  const requested = String(dispatchChannel || '').trim().toLowerCase();

  if (event === 'schedule') return planForChannel('blogs');

  if (event === 'workflow_dispatch') {
    if (!requested || requested === 'auto') {
      const fromFiles = classifyChangedFiles(changedFiles);
      if (!fromFiles.skip) return fromFiles;
      return planForChannel('blogs');
    }
    return planForChannel(requested, { allowOrphanCleanup });
  }

  return classifyChangedFiles(changedFiles);
}

module.exports = {
  FULL_PATTERNS,
  BLOG_PATTERNS,
  PORT_PATTERNS,
  CATALOGUE_PATTERNS,
  SITEMAP_PATTERNS,
  classifyChangedFiles,
  planForChannel,
  resolveGenerationPlan,
};
