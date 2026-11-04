'use strict';

/** Inline browser script for /ports/ directory (v2). Loaded as string into generated HTML. */
module.exports = function buildPortsDirectoryClientScriptSource() {
  return `(function(){
    var PAGE_SIZE = 24;
    var FEATURED_SIZE = 12;
    var search = document.getElementById('portSearch');
    var searchResults = document.getElementById('portSearchResults');
    var regionBrowse = document.getElementById('regionBrowse');
    var regionMoreToggle = document.getElementById('regionMoreToggle');
    var regionMorePanel = document.getElementById('regionMorePanel');
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
    var countryBrowseSection = document.getElementById('countryBrowseSection');
    var directoryResults = document.getElementById('directoryResults');
    if(!grid) return;

    var suppressAutoScroll = false;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.directory-card'));
    var state = {
      view: 'featured',
      regions: null,
      country: '__all__',
      bookable: false,
      sort: 'name',
      query: '',
      displayCount: FEATURED_SIZE,
      syncingHistory: false
    };

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
      var q = state.query;
      if(state.view === 'featured' && !isActiveFilter()){
        return cards.filter(function(card){ return card.getAttribute('data-featured') === '1'; });
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
          allBtn.innerHTML = '<span class="country-card-name">All countries</span><span class="country-card-count">' +
            poolForCountries.length + ' port' + (poolForCountries.length === 1 ? '' : 's') + '</span>';
          countryBrowse.appendChild(allBtn);
          entries.forEach(function(entry){
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'country-card';
            b.setAttribute('data-country', entry.key);
            b.setAttribute('aria-pressed', state.country === entry.key ? 'true' : 'false');
            b.innerHTML = '<span class="country-card-name">' + entry.label + '</span>' +
              '<span class="country-card-count">' + entry.count + ' port' + (entry.count === 1 ? '' : 's') + '</span>';
            countryBrowse.appendChild(b);
          });
        }
      }

      if(filterCountry){
        var previous = filterCountry.value;
        filterCountry.innerHTML = '<option value="__all__">All Countries</option>';
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
        var pressed = document.querySelector('.region-card[aria-pressed="true"], .region-more-pill[aria-pressed="true"]');
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
        var pressed = document.querySelector('.region-card[aria-pressed="true"], .region-more-pill[aria-pressed="true"]');
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
      if(isActiveFilter()) state.view = 'filter';
      else if(state.view !== 'browse') state.view = 'featured';

      if(state.view === 'featured' && !isActiveFilter()) state.displayCount = FEATURED_SIZE;
      else if(!opts.keepDisplayCount) state.displayCount = PAGE_SIZE;

      var q = state.query;
      var regionPool = cards.filter(function(card){
        if(q) return cardMatchesQuery(card, q);
        if(state.view === 'featured' && !isActiveFilter()) return card.getAttribute('data-featured') === '1';
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
        emptyPanel.hidden = matched.length > 0;
        emptyPanel.textContent = q
          ? 'No ports match your search. Try another city, country, or region name.'
          : 'No ports match these filters. Reset or browse all ports.';
      }
      if(loadMoreBtn){
        var showLoadMore = state.view !== 'featured' && matched.length > state.displayCount;
        loadMoreBtn.hidden = !showLoadMore;
        if(showLoadMore){
          loadMoreBtn.textContent = 'Load more ports (' + Math.min(PAGE_SIZE, matched.length - state.displayCount) + ' more)';
        }
      }
      if(resultsMeta){
        var label = '';
        if(matched.length){
          label = 'Showing ' + Math.min(state.displayCount, matched.length) + ' of ' + matched.length + ' port' + (matched.length === 1 ? '' : 's');
        } else {
          label = '0 ports';
        }
        if(state.view === 'featured' && !isActiveFilter()) label += ' · featured guides';
        else if(state.view === 'browse' && !isActiveFilter()) label += ' · all ports';
        if(q) label += ' matching “' + q + '”';
        else if(state.regions && state.regions.length) label += ' in selected region';
        if(state.country && state.country !== '__all__') label += ' · filtered by country';
        resultsMeta.textContent = label;
      }
      if(!opts.skipHistory) syncHistory();
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
    function selectRegion(btn){
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
      if(filterCountry) filterCountry.value = '__all__';
      state.view = 'filter';
      apply({ scrollAfter: 'region' });
    }
    function resetAll(){
      if(search) search.value = '';
      state.query = '';
      state.view = 'featured';
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
      state.view = 'featured';
      state.regions = null;
      state.country = '__all__';
      state.bookable = false;
      state.sort = 'name';
      state.displayCount = FEATURED_SIZE;
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
          if(filterRegion){
            var opt = Array.prototype.slice.call(filterRegion.options).find(function(o){ return o.value === regionKey; });
            if(opt) filterRegion.value = regionKey;
          }
          state.view = 'filter';
        }
        state.syncingHistory = false;
        renderSearchResults();
        apply({ skipHistory: true });
        suppressAutoScroll = false;
        return;
      }
      var region = params.get('region');
      if(region){
        state.regions = [region];
        state.view = 'filter';
      }
      var country = params.get('country');
      if(country){
        state.country = norm(country);
        if(filterCountry) filterCountry.value = state.country;
      }
      state.syncingHistory = false;
      renderSearchResults();
      apply({ skipHistory: true });
      suppressAutoScroll = false;
    }

    if(regionBrowse){
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
    if(regionMorePanel){
      regionMorePanel.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('[data-region-key]');
        if(!btn) return;
        selectRegion(btn);
      });
    }
    if(regionMoreToggle && regionMorePanel){
      regionMoreToggle.addEventListener('click', function(){
        var open = regionMorePanel.classList.toggle('is-open');
        regionMoreToggle.setAttribute('aria-expanded', String(open));
        regionMoreToggle.textContent = open ? 'Hide additional regions' : 'View all regions';
      });
    }
    if(countryBrowse){
      countryBrowse.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('[data-country]');
        if(!btn) return;
        state.country = btn.getAttribute('data-country') || '__all__';
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
        state.view = state.query ? 'filter' : 'featured';
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
  })();`;
};
