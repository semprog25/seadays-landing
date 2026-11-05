'use strict';

/** Inline helper for directory horizontal carousels (non-passive wheel only when scrolling carousel). */
function buildHorizontalScrollWheelHelperSource() {
  return `
  function bindHorizontalWheelScroll(el, canScrollFn){
    if(!el) return;
    canScrollFn = canScrollFn || function(){ return true; };
    el.addEventListener('wheel', function(e){
      if(!canScrollFn()) return;
      if(Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      var dy = e.deltaY;
      if(!dy) return;
      var max = el.scrollWidth - el.clientWidth;
      if(max <= 2) return;
      var left = el.scrollLeft;
      var atStart = left <= 1;
      var atEnd = left >= max - 1;
      if(dy > 0 && atEnd) return;
      if(dy < 0 && atStart) return;
      e.preventDefault();
      el.scrollBy({ left: dy, behavior: 'auto' });
    }, { passive: false });
  }
  `;
}

module.exports = { buildHorizontalScrollWheelHelperSource };
