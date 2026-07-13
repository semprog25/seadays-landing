'use strict';

/** @typedef {{ path: string, label?: string }} DownloadTarget */

/**
 * Fetch JSON from press data directory.
 * @param {string} name
 * @returns {Promise<unknown>}
 */
export async function fetchJson(name) {
  const response = await fetch(`/press/data/${name}.json`, { cache: 'default' });
  if (!response.ok) {
    throw new Error(`Failed to load ${name}.json`);
  }
  return response.json();
}

/**
 * Format byte size for display.
 * @param {number | null | undefined} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Escape HTML for safe text insertion.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Copy text to clipboard with user feedback.
 * @param {string} text
 * @param {HTMLButtonElement} button
 */
export async function copyToClipboard(text, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied!';
    button.classList.add('is-copied');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    button.textContent = 'Copied!';
    button.classList.add('is-copied');
  }
  window.setTimeout(() => {
    button.textContent = original;
    button.classList.remove('is-copied');
  }, 2000);
}

/**
 * Trigger immediate file download without opening a new tab.
 * @param {string} url
 * @param {string} filename
 */
export function triggerDownload(url, filename) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || '';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Observe elements for entrance animation.
 * @param {string} selector
 */
export function observeReveal(selector) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements = document.querySelectorAll(selector);
  if (prefersReducedMotion) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  elements.forEach((el) => observer.observe(el));
}

/**
 * Resolve file sizes for asset metadata when available.
 * @param {Array<{ path: string, fileSize?: number | null }>} items
 */
export async function hydrateFileSizes(items) {
  await Promise.all(
    items.map(async (item) => {
      if (item.fileSize) return;
      try {
        const response = await fetch(item.path, { method: 'HEAD' });
        const length = response.headers.get('content-length');
        if (length) item.fileSize = Number(length);
      } catch {
        item.fileSize = null;
      }
    })
  );
}

/**
 * Create skeleton placeholder markup.
 * @param {string} className
 * @returns {string}
 */
export function skeleton(className) {
  return `<div class="skeleton ${className}" aria-hidden="true"></div>`;
}
