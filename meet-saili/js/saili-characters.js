/**
 * Meet Saili — single source of truth for character PNG assets.
 * Replace any `image` URL here; do not duplicate URLs across the page.
 */
(function (global) {
  'use strict';

  var SAILI_PUBLIC_BASE =
    'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic';

  /** @type {ReadonlyArray<{
   *   id: string,
   *   name: string,
   *   file: string,
   *   image: string,
   *   alt: string,
   *   eyebrow: string,
   *   title: string,
   *   body: string
   * }>} */
  /** Intro portrait used in the “Okay, but who is Saili?” section (not a chapter). */
  var sailiIntro = {
    id: 'meet',
    name: 'Meet Saili',
    file: 'meet-saili.png',
    image: SAILI_PUBLIC_BASE + '/meet-saili.png',
    alt: 'Saili, the SeaDays travel companion, waving in a branded hoodie and cap'
  };

  /** Journey section portrait below the four stages (not a chapter). */
  var sailiJourneyVisual = {
    id: 'cute',
    name: 'Cute Saili',
    file: 'cute-saili.png',
    image: SAILI_PUBLIC_BASE + '/cute-saili.png',
    alt: 'Saili resting in a SeaDays hoodie and cap'
  };

  var sailiCharacters = [
    {
      id: 'explorer',
      name: 'Explorer Saili',
      file: 'saili-explorer.png',
      image: SAILI_PUBLIC_BASE + '/saili-explorer.png',
      alt: 'Saili dressed as a cruise explorer',
      eyebrow: 'Explore',
      title: 'Always looking past the horizon.',
      body: 'Binoculars up and curiosity on — Explorer Saili is ready for the next deck, destination, and discovery.'
    },
    {
      id: 'planner',
      name: 'Planner Saili',
      file: 'saili-planner.png',
      image: SAILI_PUBLIC_BASE + '/saili-planner.png',
      alt: 'Saili planning a cruise with a map',
      eyebrow: 'Plan',
      title: 'Every great voyage starts on the map.',
      body: 'Culture, beach, history, adventure — Planner Saili helps turn a pile of ideas into a cruise you can actually sail.'
    },
    {
      id: 'packing',
      name: 'Packing Saili',
      file: 'saili-packing.png',
      image: SAILI_PUBLIC_BASE + '/saili-packing.png',
      alt: 'Saili preparing for a cruise',
      eyebrow: 'Pack',
      title: 'Embarkation day, handled.',
      body: 'Suitcase open, checklist ticking — Packing Saili makes sure the little things are ready before the big adventure begins.'
    },
    {
      id: 'port',
      name: 'Port Saili',
      file: 'saili-port.png',
      image: SAILI_PUBLIC_BASE + '/saili-port.png',
      alt: 'Saili exploring a cruise port',
      eyebrow: 'Port',
      title: 'First steps ashore.',
      body: 'Boarding pass in hand and eyes on the pier — Port Saili lives for that first moment when the cruise becomes real.'
    },
    {
      id: 'captain',
      name: 'Captain Saili',
      file: 'saili-captain.png',
      image: SAILI_PUBLIC_BASE + '/saili-captain.png',
      alt: 'Saili dressed as a cruise captain',
      eyebrow: 'Captain',
      title: 'Steady hands on the voyage.',
      body: 'Uniform sharp and smile wider — Captain Saili is the confident side of SeaDays that keeps the journey on course.'
    },
    {
      id: 'relaxed',
      name: 'Relaxed Saili',
      file: 'saili-relaxed.png',
      image: SAILI_PUBLIC_BASE + '/saili-relaxed.png',
      alt: 'Saili relaxing on a cruise',
      eyebrow: 'Sea day',
      title: 'Soft landings between the adventures.',
      body: 'Yawn accepted. Pillow approved. Relaxed Saili reminds you that sea days are for comfort, not just the itinerary.'
    },
    {
      id: 'sustainable',
      name: 'Sustainable Saili',
      file: 'saili-sustainable.png',
      image: SAILI_PUBLIC_BASE + '/saili-sustainable.png',
      alt: 'Saili holding a CO2 neutral cruising sign',
      eyebrow: 'Sustain',
      title: 'Cruising with a lighter footprint.',
      body: 'Reusable bottle, recycling ready — Sustainable Saili stands for CO₂-aware voyages and choices that travel better.'
    },
    {
      id: 'celebration',
      name: 'Celebration Saili',
      file: 'saili-celebration.png',
      image: SAILI_PUBLIC_BASE + '/saili-celebration.png',
      alt: 'Saili celebrating with cruise rewards',
      eyebrow: 'Celebrate',
      title: 'Memories worth cheering for.',
      body: 'Confetti up, flag high — Celebration Saili is every milestone, reward, and “we actually did this” moment at sea.'
    }
  ];

  var sailiById = {};
  for (var i = 0; i < sailiCharacters.length; i++) {
    sailiById[sailiCharacters[i].id] = sailiCharacters[i];
  }
  sailiById[sailiIntro.id] = sailiIntro;
  sailiById[sailiJourneyVisual.id] = sailiJourneyVisual;

  /**
   * Apply `data-saili="<id>"` on <img> elements: sets src from the shared config.
   * Optional `data-saili-eager="true"` forces loading="eager".
   */
  function applySailiImages(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('img[data-saili]');
    for (var n = 0; n < nodes.length; n++) {
      var img = nodes[n];
      var id = img.getAttribute('data-saili');
      var character = sailiById[id];
      if (!character) continue;
      img.src = character.image;
      if (!img.getAttribute('alt')) img.alt = character.alt;
      if (!img.getAttribute('width')) img.setAttribute('width', '1024');
      if (!img.getAttribute('height')) img.setAttribute('height', '1024');
      img.setAttribute('decoding', img.getAttribute('decoding') || 'async');
      if (img.getAttribute('data-saili-eager') === 'true') {
        img.setAttribute('loading', 'eager');
        img.setAttribute('fetchpriority', 'high');
      } else if (!img.getAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
    }
  }

  var AUTO_MS = 4500;
  var TRANSITION_MS = 700;

  function buildChapterSlide(c, index, isClone) {
    var article = document.createElement('article');
    article.className = 'ms-chapter ms-chapters-slide';
    article.setAttribute('data-slide-index', String(index));
    if (isClone) {
      article.setAttribute('aria-hidden', 'true');
    } else {
      article.id = 'saili-' + c.id;
      article.setAttribute('aria-labelledby', 'saili-chapter-' + c.id);
      article.setAttribute('aria-roledescription', 'slide');
      article.setAttribute('aria-label', c.name + ' (' + (index + 1) + ' of ' + sailiCharacters.length + ')');
    }

    var media = document.createElement('div');
    media.className = 'ms-chapter-media';

    var img = document.createElement('img');
    img.src = c.image;
    img.alt = isClone ? '' : c.alt;
    img.width = 1024;
    img.height = 1024;
    img.decoding = 'async';
    img.loading = index === 0 && !isClone ? 'eager' : 'lazy';
    if (index === 0 && !isClone) img.setAttribute('fetchpriority', 'high');
    if (isClone) img.setAttribute('aria-hidden', 'true');
    media.appendChild(img);

    var copy = document.createElement('div');
    copy.className = 'ms-chapter-copy';

    var eyebrow = document.createElement('p');
    eyebrow.className = 'ms-chapter-eyebrow';
    eyebrow.textContent = c.eyebrow;

    var title = document.createElement('h3');
    if (!isClone) title.id = 'saili-chapter-' + c.id;
    title.textContent = c.title;

    var body = document.createElement('p');
    body.textContent = c.body;

    copy.appendChild(eyebrow);
    copy.appendChild(title);
    copy.appendChild(body);

    article.appendChild(media);
    article.appendChild(copy);
    return article;
  }

  /**
   * Render “Every side of Saili” as one carousel block with smooth auto-loop.
   */
  function renderSailiChapters(mount) {
    if (!mount) return;

    var total = sailiCharacters.length;
    if (!total) return;

    mount.className = 'ms-chapters-carousel';
    mount.setAttribute('role', 'region');
    mount.setAttribute('aria-roledescription', 'carousel');
    mount.setAttribute('aria-label', 'Every side of Saili');

    var viewport = document.createElement('div');
    viewport.className = 'ms-chapters-viewport';

    var track = document.createElement('div');
    track.className = 'ms-chapters-track';

    for (var i = 0; i < total; i++) {
      track.appendChild(buildChapterSlide(sailiCharacters[i], i, false));
    }
    // Clone of first slide for seamless loop
    track.appendChild(buildChapterSlide(sailiCharacters[0], 0, true));

    viewport.appendChild(track);

    var controls = document.createElement('div');
    controls.className = 'ms-chapters-controls';

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'ms-chapters-nav ms-chapters-nav--prev';
    prevBtn.setAttribute('aria-label', 'Previous Saili');
    prevBtn.innerHTML = '<span aria-hidden="true">‹</span>';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'ms-chapters-nav ms-chapters-nav--next';
    nextBtn.setAttribute('aria-label', 'Next Saili');
    nextBtn.innerHTML = '<span aria-hidden="true">›</span>';

    var dots = document.createElement('div');
    dots.className = 'ms-chapters-dots';
    dots.setAttribute('role', 'tablist');
    dots.setAttribute('aria-label', 'Saili slides');

    var dotButtons = [];
    for (var d = 0; d < total; d++) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'ms-chapters-dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', 'Show ' + sailiCharacters[d].name);
      dot.setAttribute('aria-selected', d === 0 ? 'true' : 'false');
      (function (idx) {
        dot.addEventListener('click', function () {
          goTo(idx, true);
          restartAuto();
        });
      })(d);
      dots.appendChild(dot);
      dotButtons.push(dot);
    }

    controls.appendChild(prevBtn);
    controls.appendChild(dots);
    controls.appendChild(nextBtn);

    var live = document.createElement('div');
    live.className = 'ms-chapters-live';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');

    mount.appendChild(viewport);
    mount.appendChild(controls);
    mount.appendChild(live);

    var index = 0;
    var animating = false;
    var autoTimer = 0;
    var reduceMotion =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function logicalIndex() {
      return index >= total ? 0 : index;
    }

    function updateDots() {
      var active = logicalIndex();
      for (var i = 0; i < dotButtons.length; i++) {
        var on = i === active;
        dotButtons[i].classList.toggle('is-active', on);
        dotButtons[i].setAttribute('aria-selected', on ? 'true' : 'false');
      }
      live.textContent = sailiCharacters[active].name;
    }

    function setTrack(instant) {
      if (instant) track.classList.add('is-instant');
      track.style.transform = 'translate3d(-' + index * 100 + '%, 0, 0)';
      if (instant) {
        // Force reflow so the next transition works
        void track.offsetWidth;
        track.classList.remove('is-instant');
      }
    }

    function goTo(next, userDriven) {
      if (animating && !userDriven) return;
      if (reduceMotion) {
        index = ((next % total) + total) % total;
        setTrack(true);
        updateDots();
        return;
      }
      animating = true;
      index = next;
      setTrack(false);
      updateDots();
    }

    function onTransitionEnd(event) {
      if (event.target !== track) return;
      if (event.propertyName && event.propertyName.indexOf('transform') === -1) return;
      if (index >= total) {
        index = 0;
        setTrack(true);
        updateDots();
      }
      animating = false;
    }

    function next() {
      goTo(index + 1, false);
    }

    function prev() {
      if (animating) return;
      if (index <= 0) {
        // Jump to clone position visually at end, then animate back one
        index = total;
        setTrack(true);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            goTo(total - 1, true);
          });
        });
        return;
      }
      goTo(index - 1, true);
    }

    function stopAuto() {
      if (autoTimer) {
        window.clearInterval(autoTimer);
        autoTimer = 0;
      }
    }

    function startAuto() {
      stopAuto();
      if (reduceMotion) return;
      autoTimer = window.setInterval(next, AUTO_MS);
    }

    function restartAuto() {
      stopAuto();
      startAuto();
    }

    track.addEventListener('transitionend', onTransitionEnd);
    nextBtn.addEventListener('click', function () {
      if (index >= total - 1) goTo(total, true);
      else goTo(index + 1, true);
      restartAuto();
    });
    prevBtn.addEventListener('click', function () {
      prev();
      restartAuto();
    });

    mount.addEventListener('mouseenter', stopAuto);
    mount.addEventListener('mouseleave', startAuto);
    mount.addEventListener('focusin', stopAuto);
    mount.addEventListener('focusout', function (e) {
      if (!mount.contains(e.relatedTarget)) startAuto();
    });

    // Touch swipe
    var touchX = 0;
    var touchY = 0;
    var touching = false;
    viewport.addEventListener(
      'touchstart',
      function (e) {
        if (!e.touches || !e.touches.length) return;
        touching = true;
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
        stopAuto();
      },
      { passive: true }
    );
    viewport.addEventListener(
      'touchend',
      function (e) {
        if (!touching) return;
        touching = false;
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) {
          startAuto();
          return;
        }
        var dx = t.clientX - touchX;
        var dy = t.clientY - touchY;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) {
            if (index >= total - 1) goTo(total, true);
            else goTo(index + 1, true);
          } else {
            prev();
          }
        }
        startAuto();
      },
      { passive: true }
    );

    // Pause when off-screen
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(
        function (entries) {
          var entry = entries[0];
          if (!entry) return;
          if (entry.isIntersecting) startAuto();
          else stopAuto();
        },
        { threshold: 0.35 }
      );
      io.observe(mount);
    } else {
      startAuto();
    }

    setTrack(true);
    updateDots();
  }

  global.SAILI_PUBLIC_BASE = SAILI_PUBLIC_BASE;
  global.sailiIntro = sailiIntro;
  global.sailiJourneyVisual = sailiJourneyVisual;
  global.sailiCharacters = sailiCharacters;
  global.sailiById = sailiById;
  global.applySailiImages = applySailiImages;
  global.renderSailiChapters = renderSailiChapters;
})(typeof window !== 'undefined' ? window : this);
