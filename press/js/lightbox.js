'use strict';

import { escapeHtml } from './utils.js';

let activeImage = null;

function getModal() {
  return document.getElementById('pressLightbox');
}

/**
 * Open image lightbox.
 * @param {{ src: string, alt: string, downloadUrl?: string, downloadName?: string }} options
 */
export function openLightbox(options) {
  const modal = getModal();
  if (!modal) return;
  activeImage = options;
  const img = modal.querySelector('.lightbox-image');
  const caption = modal.querySelector('.lightbox-caption');
  const downloadBtn = modal.querySelector('[data-lightbox-download]');
  if (img) {
    img.src = options.src;
    img.alt = options.alt;
  }
  if (caption) caption.textContent = options.alt;
  if (downloadBtn) {
    downloadBtn.hidden = !options.downloadUrl;
    if (options.downloadUrl) {
      downloadBtn.dataset.url = options.downloadUrl;
      downloadBtn.dataset.filename = options.downloadName || 'seadays-asset';
    }
  }
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');
  modal.querySelector('.lightbox-close')?.focus();
}

function closeLightbox() {
  const modal = getModal();
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-open');
  activeImage = null;
}

/**
 * Initialize lightbox listeners.
 */
export function initLightbox() {
  const modal = getModal();
  if (!modal) return;

  modal.querySelector('.lightbox-backdrop')?.addEventListener('click', closeLightbox);
  modal.querySelector('.lightbox-close')?.addEventListener('click', closeLightbox);
  modal.querySelector('[data-lightbox-download]')?.addEventListener('click', () => {
    const btn = modal.querySelector('[data-lightbox-download]');
    if (!btn) return;
    const url = btn.dataset.url;
    const filename = btn.dataset.filename || 'seadays-asset';
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeLightbox();
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest('[data-lightbox]');
    if (!trigger) return;
    event.preventDefault();
    openLightbox({
      src: trigger.getAttribute('data-lightbox-src') || '',
      alt: trigger.getAttribute('data-lightbox-alt') || 'SeaDays media asset',
      downloadUrl: trigger.getAttribute('data-lightbox-download') || undefined,
      downloadName: trigger.getAttribute('data-lightbox-filename') || undefined,
    });
  });
}

export function lightboxMarkup() {
  return `
    <div id="pressLightbox" class="lightbox" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Image preview">
      <div class="lightbox-backdrop"></div>
      <div class="lightbox-panel">
        <button type="button" class="lightbox-close" aria-label="Close preview">&times;</button>
        <img class="lightbox-image" src="" alt="" loading="lazy" decoding="async">
        <p class="lightbox-caption"></p>
        <button type="button" class="btn-secondary" data-lightbox-download hidden>Download original</button>
      </div>
    </div>
  `;
}
