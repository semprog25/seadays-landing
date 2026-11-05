'use strict';

function parseFocalPercent(focal) {
  if (!focal || typeof focal !== 'object') return '';
  const x = Number(focal.x);
  const y = Number(focal.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return '';
  const clamp = (n) => Math.min(100, Math.max(0, n));
  return `${clamp(x)}% ${clamp(y)}%`;
}

function objectPositionStyle(focal) {
  const pos = parseFocalPercent(focal);
  return pos ? `object-position:${pos};` : '';
}

function cssVarFocal(name, focal) {
  const pos = parseFocalPercent(focal);
  if (!pos) return '';
  return `--${name}:${pos};`;
}

module.exports = {
  parseFocalPercent,
  objectPositionStyle,
  cssVarFocal,
};
