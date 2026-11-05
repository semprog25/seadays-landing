'use strict';

const { buildHorizontalScrollWheelHelperSource } = require('./horizontalScrollWheel');

/** Inline browser script for /ports/ directory (v2). Loaded as string into generated HTML. */
module.exports = function buildPortsDirectoryClientScriptSource() {
  return `(function(){
    ${buildHorizontalScrollWheelHelperSource()}
    var PAGE_SIZE = 24;
    var FEATURED_SIZE = 12;
    var search = document.getElementById('portSearch');
    var searchResults = document.getElementById('portSearchResults');
    var regionBrowse = document.getElementById('regionBrowse');
    var regionBrowseSection = document.getElementById('regionBrowseSection');
    var regionGridWrap = document.getElementById('regionGridWrap');
    var regionExpandToggle = document.getElementById('regionExpandToggle');
    var regionScrollPrev = document.getElementById('regionScrollPrev');
    var regionScrollNext = document.getElementById('regionScrollNext');
    var countryBrowse = document.getElementById('countryBrowse');
    var countryHeading = document.getElementById('countryHeading');
    var countryEmpty = document.getElementById('countryEmpty');
    var grid = document.getElementById('directoryGrid');
    var resultsMeta = document.getElementById('resultsMeta');
    var filterRegion = document.getElementById('filterRegion');
    var filterCountry = document.getElementById('filterCountry');
    var filterBookable = document.getElementById('filterBookable');
    var filterSort = document.getElementById('filterSort');
    var resetBtn = document.getElementById('directoryReset');
    var browseAllBtn = document.getElementById('browseAllPorts');
    var loadMoreBtn = document.getElementById('directoryLoadMore');
    var emptyPanel = document.getElementById('directoryEmpty');
    var directoryBack = document.getElementById('directoryBack');
    var directoryBreadcrumb = document.getElementById('directoryBreadcrumb');
    var directoryPortsWrap = document.getElementById('directoryPortsWrap');
    var countryBrowseSection = document.getElementById('countryBrowseSection');
    var directoryResults = document.getElementById('directoryResults');
    if(!grid) return;

    var countryImages = {};
    try {
      var countryImagesEl = document.getElementById('portsDirectoryCountryImages');
      if(countryImagesEl && countryImagesEl.textContent) countryImages = JSON.parse(countryImagesEl.textContent);
    } catch(countryImagesErr) { countryImages = {}; }

    var suppressAutoScroll = false;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.directory-card'));
    var state = {
      view: 'discover',
      regions: null,
      country: '__all__',
      bookable: false,
      sort: 'name',
      query: '',
      displayCount: PAGE_SIZE,
      syncingHistory: false
    };

    function escAttr(s){
      return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }
    function countryCardInner(entry){
      var img = countryImages[entry.key];
      var media = img && img.url
        ? '<span class="country-card-media"><img class="country-card-image" src="' + escAttr(img.url) + '" alt="' + escAttr(img.alt || entry.label) + '" loading="lazy" decoding="async" width="320" height="180"></span>'
        : '<span class="country-card-media"><span class="country-card-image country-card-image--placeholder" aria-hidden="true"></span></span>';
      return media + '<span class="country-card-body"><span class="country-card-name">' + escAttr(entry.label) + '</span><span class="country-card-count">' +
        entry.count + ' port' + (entry.count === 1 ? '' : 's') + '</span></span>';
    }
    function portsResultsActive(){
      if(state.view === 'browse' || !!state.query) return true;
      if(state.country && state.country !== '__all__') return true;
      return false;
    }
    function activeRegionLabel(){
      var pressed = document.querySelector('.region-card[aria-pressed="true"]');
      if(!pressed) return '';
      var nameEl = pressed.querySelector('.region-card-name');
      return nameEl ? nameEl.textContent.trim() : '';
    }
    function activeCountryLabel(){
      if(!state.country || state.country === '__all__') return '';
      var btn = countryBrowse && countryBrowse.querySelector('[data-country="' + state.country + '"]');
      if(!btn) return state.country;
      var nameEl = btn.querySelector('.country-card-name');
      return nameEl ? nameEl.textContent.trim() : state.country;
    }
    function collapseRegionGallery(){
      if(!regionGridWrap) return;
      regionGridWrap.classList.remove('is-expanded');
      if(regionExpandToggle){
        regionExpandToggle.setAttribute('aria-expanded', 'false');
        regionExpandToggle.textContent = 'View all regions';
      }
      updateRegionCarouselNav();
    }
    function updateRegionCarouselNav(){
      if(!regionBrowse || !regionScrollPrev || !regionScrollNext) return;
      var expanded = regionGridWrap && regionGridWrap.classList.contains('is-expanded');
      if(expanded){
        regionScrollPrev.disabled = true;
        regionScrollNext.disabled = true;
        regionScrollPrev.setAttribute('aria-hidden', 'true');
        regionScrollNext.setAttribute('aria-hidden', 'true');
        return;
      }
      var maxScroll = regionBrowse.scrollWidth - regionBrowse.clientWidth;
      var canScroll = maxScroll > 4;
      regionScrollPrev.setAttribute('aria-hidden', canScroll ? 'false' : 'true');
      regionScrollNext.setAttribute('aria-hidden', canScroll ? 'false' : 'true');
      if(!canScroll){
        regionScrollPrev.disabled = true;
        regionScrollNext.disabled = true;
        return;
      }
      regionScrollPrev.disabled = regionBrowse.scrollLeft <= 2;
      regionScrollNext.disabled = regionBrowse.scrollLeft >= maxScroll - 2;
    }
    function scrollRegionCarousel(dir){
      if(!regionBrowse || (regionGridWrap && regionGridWrap.classList.contains('is-expanded'))) return;
      var card = regionBrowse.querySelector('.region-card');
      var step = card ? Math.max(card.offsetWidth + 10, 240) : 280;
      regionBrowse.scrollBy({ left: dir * step, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    function updateDrillChrome(){
      var onRegions = !state.regions && !state.query && state.view !== 'browse';
      if(regionBrowseSection){
        var hideRegions = !onRegions && state.view !== 'browse';
        regionBrowseSection.classList.toggle('is-drill-hidden', hideRegions);
        if(hideRegions) collapseRegionGallery();
      }
      var showPorts = portsResultsActive();
      var showCountryGallery = !!(state.regions && state.regions.length) && !state.query && state.view !== 'browse' && (!state.country || state.country === '__all__');
      if(countryBrowseSection){
        countryBrowseSection.classList.toggle('is-drill-hidden', !showCountryGallery);
      }
      if(directoryResults) directoryResults.hidden = !showPorts;
      if(directoryPortsWrap) directoryPortsWrap.hidden = !showPorts;
      if(directoryBack){
        var showBack = !!(state.regions && state.regions.length) || (state.country && state.country !== '__all__') || state.view === 'browse' || !!state.query;
        directoryBack.hidden = !showBack;
      }
      if(directoryBreadcrumb){
        var parts = ['Regions'];
        var regionLabel = activeRegionLabel();
        if(regionLabel) parts.push(regionLabel);
        var countryLabel = activeCountryLabel();
        if(countryLabel) parts.push(countryLabel);
        if(state.query) parts = ['Search', '“' + (search && search.value ? search.value : state.query) + '”'];
        else if(state.view === 'browse') parts = ['All ports'];
        directoryBreadcrumb.innerHTML = parts.map(function(part, idx){
          var isLast = idx === parts.length - 1;
          var sep = idx ? '<span class="directory-breadcrumb-sep" aria-hidden="true">›</span>' : '';
          if(isLast) return sep + '<span aria-current="page">' + part + '</span>';
          return sep + '<span>' + part + '</span>';
        }).join('');
      }
    }

    function prefersReducedMotion(){
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    function scrollToSection(el){
      if(suppressAutoScroll || !el) return;
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
    function scrollAfterFilter(scrollKind){
      if(scrollKind === 'country'){
        scrollToSection(directoryResults || grid);
        return;
      }
      if(scrollKind === 'region'){
        scrollToSection(countryBrowseSection || directoryResults || grid);
      }
    }
    function norm(s){
      return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    function setPressed(container, attr, activeValue){
      if(!container) return;
      Array.prototype.slice.call(container.querySelectorAll('[' + attr + ']')).forEach(function(btn){
        var v = btn.getAttribute(attr);
        btn.setAttribute('aria-pressed', String(v === activeValue));
      });
    }
    function parseRegionsAttr(el){
      if(!el) return null;
      var raw = el.getAttribute('data-regions') || '';
      if(!raw) return null;
      return raw.split('|').map(function(s){ return s.trim(); }).filter(Boolean);
    }
    function cardMatchesRegions(card, regions){
      if(!regions || !regions.length) return true;
      var region = card.getAttribute('data-region') || card.getAttribute('data-group') || '';
      return regions.indexOf(region) !== -1;
    }
    function cardMatchesQuery(card, q){
      if(!q) return true;
      var name = card.getAttribute('data-name') || '';
      var country = card.getAttribute('data-country') || '';
      var region = norm(card.getAttribute('data-region') || card.getAttribute('data-group') || '');
      var aliases = card.getAttribute('data-aliases') || '';
      var item = card.getAttribute('data-item') || '';
      var title = ((card.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
      return name.indexOf(q) !== -1
        || country.indexOf(q) !== -1
        || region.indexOf(q) !== -1
        || aliases.indexOf(q) !== -1
        || title.indexOf(q) !== -1
        || item.indexOf(q) !== -1;
    }
    function isActiveFilter(){
      return !!(state.query || (state.regions && state.regions.length) || (state.country && state.country !== '__all__') || state.bookable);
    }
    function visiblePool(){
      if(!portsResultsActive()) return [];
      var q = state.query;
      if(state.view === 'browse' && !isActiveFilter()){
        return cards.slice();
      }
      return cards.filter(function(card){
        if(state.bookable && card.getAttribute('data-bookable') !== '1') return false;
        if(q) return cardMatchesQuery(card, q);
        if(!cardMatchesRegions(card, state.regions)) return false;
        if(state.country && state.country !== '__all__'){
          var c = card.getAttribute('data-country') || '';
          if(c !== state.country) return false;
        }
        return true;
      });
    }
    function sortCards(list){
      var mode = state.sort || 'name';
      return list.slice().sort(function(a, b){
        var photoA = a.getAttribute('data-verified-photo') === '1' ? 0 : 1;
        var photoB = b.getAttribute('data-verified-photo') === '1' ? 0 : 1;
        if(photoA !== photoB) return photoA - photoB;
        if(mode === 'name'){
          var na = ((a.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
          var nb = ((b.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
          return na.localeCompare(nb);
        }
        if(mode === 'country'){
          var ca = a.getAttribute('data-country') || '';
          var cb = b.getAttribute('data-country') || '';
          if(ca !== cb) return ca.localeCompare(cb);
          var ta = ((a.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
          var tb = ((b.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
          return ta.localeCompare(tb);
        }
        return 0;
      });
    }
    function rebuildCountryOptions(poolForCountries){
      var hasRegion = !!(state.regions && state.regions.length);
      var showCountries = hasRegion || !!state.query;
      var counts = {};
      if(showCountries){
        poolForCountries.forEach(function(card){
          var c = card.getAttribute('data-country') || '';
          var labelEl = card.querySelector('.seo-grid-card-meta');
          var label = '';
          if(labelEl){
            var parts = (labelEl.textContent || '').split('·');
            label = (parts[0] || '').trim();
          }
          if(!c) return;
          if(!counts[c]) counts[c] = { key: c, label: label || c, count: 0 };
          counts[c].count += 1;
          if(label) counts[c].label = label;
        });
      }
      var entries = Object.keys(counts).map(function(k){ return counts[k]; })
        .sort(function(a, b){ return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }); });

      if(countryBrowse){
        countryBrowse.innerHTML = '';
        if(!showCountries){
          if(countryEmpty){
            countryEmpty.style.display = 'block';
            countryEmpty.textContent = 'Select a region to see its countries, or search above.';
          }
        } else if(!entries.length){
          if(countryEmpty){
            countryEmpty.style.display = 'block';
            countryEmpty.textContent = 'No countries match the current filters.';
          }
        } else {
          if(countryEmpty) countryEmpty.style.display = 'none';
          var allBtn = document.createElement('button');
          allBtn.type = 'button';
          allBtn.className = 'country-card';
          allBtn.setAttribute('data-country', '__all__');
          allBtn.setAttribute('aria-pressed', state.country === '__all__' ? 'true' : 'false');
          allBtn.innerHTML = countryCardInner({ key: '__all__', label: 'Back to regions', count: poolForCountries.length });
          countryBrowse.appendChild(allBtn);
          entries.forEach(function(entry){
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'country-card';
            b.setAttribute('data-country', entry.key);
            b.setAttribute('aria-pressed', state.country === entry.key ? 'true' : 'false');
            b.innerHTML = countryCardInner(entry);
            countryBrowse.appendChild(b);
          });
        }
      }

      if(filterCountry){
        var previous = filterCountry.value;
        filterCountry.innerHTML = '<option value="__all__">Back to regions</option>';
        entries.forEach(function(entry){
          var opt = document.createElement('option');
          opt.value = entry.key;
          opt.textContent = entry.label + ' (' + entry.count + ')';
          filterCountry.appendChild(opt);
        });
        var still = entries.some(function(e){ return e.key === previous; });
        filterCountry.value = still ? previous : '__all__';
        if(!still) state.country = '__all__';
      }

      if(countryHeading){
        var regionLabel = 'Select a region';
        var pressed = document.querySelector('.region-card[aria-pressed="true"]');
        if(pressed){
          var nameEl = pressed.querySelector('.region-card-name');
          regionLabel = nameEl ? nameEl.textContent.trim() : (pressed.textContent || '').split('·')[0].trim();
        }
        countryHeading.textContent = state.query ? 'Countries matching search' : regionLabel;
      }
    }
    function syncHistory(){
      if(state.syncingHistory) return;
      var params = new URLSearchParams();
      if(state.query) params.set('q', state.query);
      if(state.view === 'browse') params.set('view', 'browse');
      if(state.regions && state.regions.length === 1) params.set('region', state.regions[0]);
      else if(state.regions && state.regions.length > 1){
        var pressed = document.querySelector('.region-card[aria-pressed="true"]');
        if(pressed) params.set('regionKey', pressed.getAttribute('data-region-key') || '');
      }
      if(state.country && state.country !== '__all__') params.set('country', state.country);
      if(state.bookable) params.set('bookable', '1');
      var qs = params.toString();
      var next = qs ? (window.location.pathname + '?' + qs) : window.location.pathname;
      if(next !== window.location.pathname + window.location.search){
        history.pushState({ portsDirV2: true }, '', next);
      }
    }
    function apply(opts){
      opts = opts || {};
      var drillingCountryGallery =
        !!(state.regions && state.regions.length) &&
        (!state.country || state.country === '__all__') &&
        !state.query &&
        state.view !== 'browse';
      if(drillingCountryGallery) state.view = 'discover';
      else if(isActiveFilter()) state.view = state.view === 'browse' ? 'browse' : 'filter';
      else if(state.view !== 'browse') state.view = 'discover';

      if(state.view === 'browse' && !isActiveFilter()) state.displayCount = Math.max(state.displayCount, PAGE_SIZE);
      else if(!opts.keepDisplayCount && portsResultsActive()) state.displayCount = PAGE_SIZE;

      var q = state.query;
      var regionPool = cards.filter(function(card){
        if(q) return cardMatchesQuery(card, q);
        if(state.view === 'browse' && !isActiveFilter()) return true;
        return cardMatchesRegions(card, state.regions);
      });
      rebuildCountryOptions(regionPool);

      var matched = sortCards(visiblePool());
      var shown = matched.slice(0, state.displayCount);
      var shownSet = {};
      shown.forEach(function(card, idx){
        shownSet[card.getAttribute('data-item')] = idx;
      });

      cards.forEach(function(card){
        var slug = card.getAttribute('data-item');
        var inMatch = matched.some(function(m){ return m.getAttribute('data-item') === slug; });
        if(!inMatch){
          card.classList.add('is-filter-hidden');
          card.classList.add('is-page-hidden');
          card.style.order = '';
          card.setAttribute('tabindex', '-1');
          return;
        }
        card.classList.remove('is-filter-hidden');
        if(Object.prototype.hasOwnProperty.call(shownSet, slug)){
          card.classList.remove('is-page-hidden');
          card.style.order = String(shownSet[slug]);
          card.removeAttribute('tabindex');
        } else {
          card.classList.add('is-page-hidden');
          card.style.order = '';
          card.setAttribute('tabindex', '-1');
        }
      });

      if(emptyPanel){
        var showEmpty = portsResultsActive() && matched.length === 0;
        emptyPanel.hidden = !showEmpty;
        if(showEmpty){
          emptyPanel.textContent = q
            ? 'No ports match your search. Try another city, country, or region name.'
            : 'No ports match these filters. Reset or browse all ports.';
        }
      }
      if(loadMoreBtn){
        var showLoadMore = portsResultsActive() && state.view !== 'featured' && matched.length > state.displayCount;
        loadMoreBtn.hidden = !showLoadMore;
        if(showLoadMore){
          loadMoreBtn.textContent = 'Load more ports (' + Math.min(PAGE_SIZE, matched.length - state.displayCount) + ' more)';
        }
      }
      if(resultsMeta){
        var label = '';
        if(!portsResultsActive()){
          label = 'Select a country to see its ports';
        } else if(matched.length){
          label = 'Showing ' + Math.min(state.displayCount, matched.length) + ' of ' + matched.length + ' port' + (matched.length === 1 ? '' : 's');
        } else {
          label = '0 ports';
        }
        if(portsResultsActive() && state.view === 'browse' && !isActiveFilter()) label += ' · all ports';
        if(portsResultsActive() && q) label += ' matching “' + q + '”';
        else if(portsResultsActive() && state.regions && state.regions.length) label += ' in selected region';
        if(portsResultsActive() && state.country && state.country !== '__all__') label += ' · filtered by country';
        resultsMeta.textContent = label;
      }
      if(!opts.skipHistory) syncHistory();
      updateDrillChrome();
      if(opts.scrollAfter) scrollAfterFilter(opts.scrollAfter);
    }
    function renderSearchResults(){
      if(!searchResults) return;
      var q = state.query;
      if(!q){
        searchResults.classList.remove('is-open');
        searchResults.innerHTML = '';
        return;
      }
      var hits = sortCards(cards.filter(function(card){ return cardMatchesQuery(card, q); })).slice(0, 8);
      if(!hits.length){
        searchResults.innerHTML = '<div class="search-empty">No ports found. Try a city, port, or country name.</div>';
        searchResults.classList.add('is-open');
        return;
      }
      searchResults.innerHTML = hits.map(function(card){
        var href = card.getAttribute('href') || '#';
        var name = ((card.querySelector('.seo-grid-card-title') || {}).textContent || '').trim();
        var meta = ((card.querySelector('.seo-grid-card-meta') || {}).textContent || '').trim();
        return '<a class="search-result-item" href="' + href + '">' +
          '<span class="search-result-name">' + name + '</span>' +
          '<span class="search-result-meta">' + meta + '</span></a>';
      }).join('');
      searchResults.classList.add('is-open');
    }
    function clearRegionSelection(){
      document.querySelectorAll('[data-region-key]').forEach(function(el){
        el.setAttribute('aria-pressed', 'false');
      });
      state.regions = null;
      if(filterRegion) filterRegion.value = '__all__';
    }
    function returnToAllRegions(opts){
      opts = opts || {};
      collapseRegionGallery();
      clearRegionSelection();
      state.country = '__all__';
      state.view = 'discover';
      if(filterCountry) filterCountry.value = '__all__';
      if(countryBrowse) setPressed(countryBrowse, 'data-country', '__all__');
      apply({ scrollAfter: opts.scrollAfter || 'region', skipHistory: opts.skipHistory });
    }
    function selectRegion(btn){
      collapseRegionGallery();
      if(search && search.value){
        search.value = '';
        state.query = '';
        renderSearchResults();
      }
      var key = btn ? btn.getAttribute('data-region-key') : '__all__';
      if(key === '__all__' || !btn){
        clearRegionSelection();
      } else {
        document.querySelectorAll('[data-region-key]').forEach(function(el){
          el.setAttribute('aria-pressed', String(el === btn));
        });
        state.regions = parseRegionsAttr(btn);
        if(filterRegion){
          var opt = Array.prototype.slice.call(filterRegion.options).find(function(o){ return o.value === key; });
          if(opt) filterRegion.value = key;
        }
      }
      state.country = '__all__';
      state.view = 'discover';
      apply({ scrollAfter: 'region' });
    }
    function resetAll(){
      if(search) search.value = '';
      state.query = '';
      state.view = 'discover';
      state.regions = null;
      state.country = '__all__';
      state.bookable = false;
      state.sort = 'name';
      state.displayCount = FEATURED_SIZE;
      clearRegionSelection();
      if(filterCountry) filterCountry.value = '__all__';
      if(filterBookable) filterBookable.value = '__all__';
      if(filterSort) filterSort.value = 'name';
      renderSearchResults();
      apply();
    }
    function browseAll(){
      if(search) search.value = '';
      state.query = '';
      clearRegionSelection();
      state.country = '__all__';
      state.bookable = false;
      state.view = 'browse';
      state.displayCount = PAGE_SIZE;
      renderSearchResults();
      apply();
    }
    function handleBack(){
      if(state.query){
        if(search) search.value = '';
        state.query = '';
        renderSearchResults();
        apply();
        return;
      }
      if(state.view === 'browse'){
        resetAll();
        return;
      }
      if(state.country && state.country !== '__all__'){
        state.country = '__all__';
        if(filterCountry) filterCountry.value = '__all__';
        if(countryBrowse) setPressed(countryBrowse, 'data-country', state.country);
        state.view = 'discover';
        apply({ scrollAfter: 'region' });
        return;
      }
      if(state.regions && state.regions.length){
        resetAll();
      }
    }
    function loadMore(){
      state.displayCount += PAGE_SIZE;
      apply({ keepDisplayCount: true });
    }
    function readStateFromUrl(){
      suppressAutoScroll = true;
      var params = new URLSearchParams(window.location.search);
      state.syncingHistory = true;
      if(search) search.value = '';
      state.query = '';
      state.view = 'discover';
      state.regions = null;
      state.country = '__all__';
      state.bookable = false;
      state.sort = 'name';
      state.displayCount = PAGE_SIZE;
      clearRegionSelection();
      if(filterCountry) filterCountry.value = '__all__';
      if(filterBookable) filterBookable.value = '__all__';
      if(filterSort) filterSort.value = 'name';

      if(params.get('view') === 'browse'){
        state.view = 'browse';
        state.displayCount = PAGE_SIZE;
      }
      var q = params.get('q');
      if(q){
        state.query = norm(q);
        if(search) search.value = q;
        state.view = 'filter';
      }
      if(params.get('bookable') === '1'){
        state.bookable = true;
        if(filterBookable) filterBookable.value = 'bookable';
      }
      var regionKey = params.get('regionKey');
      if(regionKey){
        var btn = document.querySelector('[data-region-key="' + regionKey.replace(/"/g, '') + '"]');
        if(btn){
          document.querySelectorAll('[data-region-key]').forEach(function(el){
            el.setAttribute('aria-pressed', String(el === btn));
          });
          state.regions = parseRegionsAttr(btn);
          state.view = 'discover';
        }
      }
      var region = params.get('region');
      if(region){
        state.regions = [region];
        state.view = 'discover';
      }
      var country = params.get('country');
      if(country){
        state.country = norm(country);
        if(filterCountry) filterCountry.value = state.country;
        state.view = 'filter';
      }
      state.syncingHistory = false;
      renderSearchResults();
      apply({ skipHistory: true });
      suppressAutoScroll = false;
    }

    if(regionBrowse){
      regionBrowse.addEventListener('scroll', function(){ updateRegionCarouselNav(); }, { passive: true });
      bindHorizontalWheelScroll(regionBrowse, function(){
        return !(regionGridWrap && regionGridWrap.classList.contains('is-expanded'));
      });
      regionBrowse.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('[data-region-key]');
        if(!btn) return;
        if(btn.getAttribute('aria-pressed') === 'true'){
          resetAll();
          return;
        }
        selectRegion(btn);
      });
    }
    if(regionExpandToggle && regionGridWrap){
      regionExpandToggle.addEventListener('click', function(){
        var expanded = regionGridWrap.classList.toggle('is-expanded');
        regionExpandToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        regionExpandToggle.textContent = expanded ? 'Show fewer regions' : 'View all regions';
        updateRegionCarouselNav();
      });
    }
    if(regionScrollPrev){
      regionScrollPrev.addEventListener('click', function(){ scrollRegionCarousel(-1); });
    }
    if(regionScrollNext){
      regionScrollNext.addEventListener('click', function(){ scrollRegionCarousel(1); });
    }
    window.addEventListener('resize', function(){ updateRegionCarouselNav(); }, { passive: true });
    if(countryBrowse){
      countryBrowse.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('[data-country]');
        if(!btn) return;
        state.country = btn.getAttribute('data-country') || '__all__';
        if(state.country === '__all__'){
          returnToAllRegions();
          return;
        }
        state.view = 'filter';
        setPressed(countryBrowse, 'data-country', state.country);
        if(filterCountry) filterCountry.value = state.country;
        apply({ scrollAfter: 'country' });
      });
    }
    if(filterRegion){
      filterRegion.addEventListener('change', function(){
        var val = filterRegion.value;
        if(val === '__all__'){
          clearRegionSelection();
          state.view = isActiveFilter() ? 'filter' : 'featured';
          apply();
          return;
        }
        var btn = document.querySelector('[data-region-key="' + val.replace(/"/g, '') + '"]');
        if(btn) selectRegion(btn);
        else {
          state.regions = [val];
          state.country = '__all__';
          state.view = 'filter';
          apply();
        }
      });
    }
    if(filterCountry){
      filterCountry.addEventListener('change', function(){
        state.country = filterCountry.value || '__all__';
        if(state.country === '__all__' && state.regions && state.regions.length){
          returnToAllRegions({ scrollAfter: 'region' });
          return;
        }
        state.view = 'filter';
        if(countryBrowse) setPressed(countryBrowse, 'data-country', state.country);
        apply({ scrollAfter: state.country !== '__all__' ? 'country' : undefined });
      });
    }
    if(filterBookable){
      filterBookable.addEventListener('change', function(){
        state.bookable = filterBookable.value === 'bookable';
        state.view = 'filter';
        apply();
      });
    }
    if(filterSort){
      filterSort.addEventListener('change', function(){
        state.sort = filterSort.value || 'name';
        apply({ keepDisplayCount: true });
      });
    }
    if(search){
      search.addEventListener('input', function(){
        state.query = norm(search.value || '');
        if(state.query){
          clearRegionSelection();
          state.country = '__all__';
          if(filterCountry) filterCountry.value = '__all__';
        }
        state.view = state.query ? 'filter' : 'discover';
        renderSearchResults();
        apply();
      });
      search.addEventListener('keydown', function(e){
        if(e.key === 'Escape'){
          searchResults && searchResults.classList.remove('is-open');
        }
      });
    }
    document.addEventListener('click', function(e){
      if(!searchResults || !search) return;
      if(search.contains(e.target) || searchResults.contains(e.target)) return;
      searchResults.classList.remove('is-open');
    });
    if(resetBtn) resetBtn.addEventListener('click', resetAll);
    if(browseAllBtn) browseAllBtn.addEventListener('click', browseAll);
    if(directoryBack) directoryBack.addEventListener('click', handleBack);
    if(loadMoreBtn) loadMoreBtn.addEventListener('click', loadMore);
    window.addEventListener('popstate', function(){
      readStateFromUrl();
    });

    if(window.location.search) readStateFromUrl();
    else {
      suppressAutoScroll = true;
      apply({ skipHistory: true });
      suppressAutoScroll = false;
    }
    updateRegionCarouselNav();
  })();`;
};
