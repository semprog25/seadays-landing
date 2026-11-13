'use strict';

const { buildHorizontalScrollWheelHelperSource } = require('./horizontalScrollWheel');

module.exports = function buildShipsDirectoryClientScriptSource() {
  return `(function(){
    ${buildHorizontalScrollWheelHelperSource().trim()}
    var SHIP_PAGE_SIZE = 6;
    var grid = document.getElementById('directoryGrid');
    var shipSearch = document.getElementById('shipSearch');
    var filterLine = document.getElementById('filterLine');
    var shipsReset = document.getElementById('shipsReset');
    var popularLinePills = document.getElementById('popularLinePills');
    var shipsResultsMeta = document.getElementById('shipsResultsMeta');
    var loadMoreWrap = document.getElementById('shipsLoadMoreWrap');
    var loadMoreBtn = document.getElementById('shipsLoadMore');
    var catalogEl = document.getElementById('shipsDirectoryCatalog');
    var emptyEl = document.getElementById('shipsDirectoryEmpty');
    if(!grid || !catalogEl) return;

    var catalog = [];
    try { catalog = JSON.parse(catalogEl.textContent || '[]'); } catch(e) { catalog = []; }
    var totalShips = catalog.length;
    var state = { line: '__all__', query: '', visibleCount: SHIP_PAGE_SIZE, syncingHistory: false };

    function escAttr(s){
      return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }
    function matchedCatalog(){
      var q = state.query.trim().toLowerCase();
      return catalog.filter(function(ship){
        var line = ship.line || '';
        var slug = ship.slug || '';
        var name = (ship.name || '').toLowerCase();
        if(state.line && state.line !== '__all__' && line !== state.line) return false;
        if(!q) return true;
        return name.indexOf(q) >= 0 || line.toLowerCase().indexOf(q) >= 0 || slug.indexOf(q) >= 0;
      });
    }
    function buildCardElement(ship, index){
      var hasPhoto = !!(ship.imgUrl && String(ship.imgUrl).trim());
      var a = document.createElement('a');
      a.href = '/ships/' + encodeURIComponent(ship.slug) + '/';
      a.className = hasPhoto
        ? 'seo-grid-card directory-card directory-card--with-photo'
        : 'seo-grid-card directory-card';
      a.setAttribute('data-group', ship.line || '');
      a.setAttribute('data-item', ship.slug || '');
      if(hasPhoto) a.setAttribute('data-verified-photo', '1');
      if(hasPhoto){
        var img = document.createElement('img');
        img.className = 'directory-card-image img-loading';
        img.src = ship.imgUrl;
        img.alt = ship.name || ship.slug || 'Cruise ship';
        img.width = 400;
        img.height = 225;
        img.decoding = 'async';
        img.loading = index < SHIP_PAGE_SIZE ? 'eager' : 'lazy';
        img.setAttribute('data-img-source', 'directory');
        img.onload = function(){ img.classList.remove('img-loading'); };
        a.appendChild(img);
      }
      var body = document.createElement('span');
      body.className = 'directory-card-body';
      body.innerHTML =
        '<span class="seo-grid-card-title">' + escAttr(ship.name) + '</span>' +
        '<span class="seo-grid-card-meta">' + escAttr(ship.line || 'Cruise line') + '</span>' +
        '<span class="seo-grid-card-bottom">' +
        (ship.ratingHtml || '') +
        '<span class="seo-grid-card-hint">View ship guide →</span></span>';
      a.appendChild(body);
      return a;
    }
    function updateMeta(matchedLen, shownLen){
      if(!shipsResultsMeta) return;
      var label = 'Showing <strong>' + shownLen + '</strong> of <strong>' + matchedLen + '</strong> ships';
      if(matchedLen !== totalShips){
        label = 'Showing <strong>' + shownLen + '</strong> of <strong>' + matchedLen + '</strong> matching ships (' + totalShips + ' total)';
      }
      if(state.line && state.line !== '__all__') label += ' · ' + state.line;
      if(state.query) label += ' matching “' + state.query + '”';
      shipsResultsMeta.innerHTML = label;
    }
    function updateLoadMore(matchedLen, shownLen){
      if(!loadMoreWrap || !loadMoreBtn) return;
      var hasMore = shownLen < matchedLen;
      loadMoreWrap.hidden = !hasMore;
      loadMoreBtn.disabled = !hasMore;
      if(hasMore){
        var next = Math.min(shownLen + SHIP_PAGE_SIZE, matchedLen);
        loadMoreBtn.textContent = 'Load more ships (' + next + ' of ' + matchedLen + ')';
      }
    }
    function renderShips(opts){
      opts = opts || {};
      var matched = matchedCatalog();
      var shownLen = Math.min(state.visibleCount, matched.length);
      var focusSlug = opts.preserveFocusSlug || '';
      var prevScroll = window.scrollY;
      grid.replaceChildren();
      matched.slice(0, shownLen).forEach(function(ship, idx){
        grid.appendChild(buildCardElement(ship, idx));
      });
      updateMeta(matched.length, shownLen);
      updateLoadMore(matched.length, shownLen);
      if(emptyEl) emptyEl.hidden = matched.length > 0;
      if(focusSlug){
        var focusEl = grid.querySelector('[data-item="' + focusSlug.replace(/"/g, '') + '"]');
        if(focusEl && typeof focusEl.focus === 'function') focusEl.focus({ preventScroll: true });
      }
      if(opts.restoreScroll) window.scrollTo(0, prevScroll);
      if(!opts.skipHistory) syncHistory();
    }
    function setLinePressed(activeLine){
      if(shipsReset) shipsReset.setAttribute('aria-pressed', String(activeLine === '__all__'));
      if(popularLinePills){
        Array.prototype.slice.call(popularLinePills.querySelectorAll('[data-line]')).forEach(function(btn){
          btn.setAttribute('aria-pressed', String(btn.getAttribute('data-line') === activeLine));
        });
      }
      if(filterLine) filterLine.value = activeLine === '__all__' ? '__all__' : activeLine;
    }
    function syncHistory(){
      if(state.syncingHistory) return;
      var params = new URLSearchParams();
      if(state.query) params.set('q', state.query);
      if(state.line && state.line !== '__all__') params.set('line', state.line);
      var qs = params.toString();
      var next = qs ? (window.location.pathname + '?' + qs) : window.location.pathname;
      if(next !== window.location.pathname + window.location.search){
        history.pushState({ shipsDirV2: true }, '', next);
      }
    }
    function selectLine(line){
      state.line = line || '__all__';
      state.visibleCount = SHIP_PAGE_SIZE;
      setLinePressed(state.line);
      renderShips();
    }
    function resetAll(){
      state.line = '__all__';
      state.query = '';
      state.visibleCount = SHIP_PAGE_SIZE;
      if(shipSearch) shipSearch.value = '';
      setLinePressed('__all__');
      renderShips();
    }
    function readStateFromUrl(){
      state.syncingHistory = true;
      var params = new URLSearchParams(window.location.search);
      state.line = '__all__';
      state.query = '';
      state.visibleCount = SHIP_PAGE_SIZE;
      if(shipSearch) shipSearch.value = '';
      var q = params.get('q');
      if(q){
        state.query = q;
        if(shipSearch) shipSearch.value = q;
      }
      var line = params.get('line');
      if(line) state.line = line;
      setLinePressed(state.line);
      state.syncingHistory = false;
      renderShips({ skipHistory: true });
    }

    if(shipsReset) shipsReset.addEventListener('click', resetAll);
    if(popularLinePills){
      popularLinePills.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('[data-line]');
        if(!btn) return;
        selectLine(btn.getAttribute('data-line') || '__all__');
      });
      bindHorizontalWheelScroll(popularLinePills);
    }
    if(filterLine){
      filterLine.addEventListener('change', function(){
        selectLine(filterLine.value || '__all__');
      });
    }
    if(shipSearch){
      shipSearch.addEventListener('input', function(){
        state.query = shipSearch.value || '';
        state.visibleCount = SHIP_PAGE_SIZE;
        renderShips();
      });
    }
    if(loadMoreBtn){
      loadMoreBtn.addEventListener('click', function(){
        var matched = matchedCatalog();
        var before = Math.min(state.visibleCount, matched.length);
        state.visibleCount = Math.min(state.visibleCount + SHIP_PAGE_SIZE, matched.length);
        var firstNew = matched[before];
        renderShips({
          preserveFocusSlug: firstNew ? firstNew.slug : '',
          restoreScroll: true,
        });
      });
    }
    window.addEventListener('popstate', readStateFromUrl);

    if(window.location.search) readStateFromUrl();
    else {
      setLinePressed('__all__');
      renderShips({ skipHistory: true });
    }
  })();`;
};
