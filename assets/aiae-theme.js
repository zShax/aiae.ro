(function() {
  'use strict';

  function initAiae() {
    const reduceMotion = document.body.classList.contains('aiae-reduce-motion') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Loader
    const loader = document.getElementById('aiae-loader');
    if (loader) {
      if (reduceMotion) {
        loader.style.display = 'none';
      } else {
        setTimeout(function() { loader.style.display = 'none'; }, 2700);
      }
    }

    // Nav scroll
    const nav = document.getElementById('aiae-nav');
    // The hero ticker is the header's second row — it shares the nav's state.
    const ticker = document.querySelector('.aiae-hero__ticker');
    function onScroll() {
      const y = window.scrollY || window.pageYOffset;
      const scrolled = y > 40;
      if (nav) nav.classList.toggle('is-scrolled', scrolled);
      if (ticker) ticker.classList.toggle('is-scrolled', scrolled);
      if (!reduceMotion) {
        const word = document.getElementById('aiae-footer-word');
        if (word) {
          const r = word.getBoundingClientRect();
          const prog = Math.max(-1, Math.min(1, 1 - r.top / window.innerHeight));
          word.style.transform = 'translateX(' + (prog * -7) + 'vw)';
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Pause marquee if reduce motion
    if (reduceMotion) {
      document.querySelectorAll('.aiae-marquee-inner').forEach(function(el) {
        el.style.animationPlayState = 'paused';
      });
    }

    initMenu();
    initPod(reduceMotion);
    initCarousels(reduceMotion);
    initCardFlips(reduceMotion);
    initLotSeal();
    initReveal(reduceMotion, loader);
  }

  // ─── Lot seal: correct the server-rendered countdown ───────
  // The plates are painted by Liquid so they are never blank, but Shopify
  // serves that markup from cache — by the time a visitor sees it the figure
  // can be days old. This recomputes from the visitor's own clock and then
  // ticks on the second.
  function initLotSeal() {
    const seals = Array.prototype.slice.call(document.querySelectorAll('[data-aiae-seal]'));
    if (!seals.length) return;

    function paint(seal) {
      const deadline = parseInt(seal.dataset.deadline, 10);
      if (!deadline) return true;

      const remaining = deadline - Math.floor(Date.now() / 1000);
      if (remaining <= 0) {
        // Closed while the page was open, or served from a cache older than
        // the deadline. Swap the clock for the closing stamp.
        const clock = seal.querySelector('.aiae-seal__clock');
        if (clock && !seal.classList.contains('aiae-seal--closed')) {
          const line = document.createElement('p');
          line.className = 'aiae-seal__closed-line';
          line.textContent = seal.dataset.closedLabel || '';
          clock.replaceChildren(line);
          seal.classList.add('aiae-seal--closed');
        }
        return true;
      }

      // Days are read as a number and run to three digits, so they stay
      // unpadded; the clock units are padded to two so a plate never changes
      // width mid-tick.
      const parts = {
        days: String(Math.floor(remaining / 86400)),
        hours: pad(Math.floor((remaining % 86400) / 3600)),
        minutes: pad(Math.floor((remaining % 3600) / 60)),
        seconds: pad(remaining % 60)
      };
      Object.keys(parts).forEach(function(unit) {
        const el = seal.querySelector('[data-seal-' + unit + ']');
        if (el && el.textContent !== parts[unit]) el.textContent = parts[unit];
      });
      return false;
    }

    function pad(n) {
      return n < 10 ? '0' + n : String(n);
    }

    function tick() {
      // Every seal done means nothing left to schedule.
      const live = seals.filter(function(seal) { return !paint(seal); });
      if (!live.length) return;
      // Re-aim at the next whole second every time rather than setInterval,
      // which drifts and stacks up missed ticks after a background tab or a
      // sleeping laptop wakes.
      setTimeout(tick, 1000 - (Date.now() % 1000) + 20);
    }

    tick();
  }

  // ─── Collection cards: automatic flip-through of the shots ─────
  // Front / back / sides rotate by themselves on every device — the card
  // is a link, so there is no tap or hover affordance to hang this on.
  // Cards are staggered and only run while on screen.
  function initCardFlips(reduceMotion) {
    setupCardFlips(document, reduceMotion);

    document.addEventListener('shopify:section:load', function(e) {
      setupCardFlips(e.target, reduceMotion);
    });
  }

  function setupCardFlips(scope, reduceMotion) {
    if (reduceMotion) return;

    const STEP = 2600;
    const items = Array.prototype.slice.call(scope.querySelectorAll('[data-aiae-flip]'))
      .filter(function(el) { return el.dataset.aiaeFlipReady !== 'true'; })
      .map(function(el, i) {
        el.dataset.aiaeFlipReady = 'true';
        return {
          shots: Array.prototype.slice.call(el.querySelectorAll('.aiae-card__shot')),
          ticks: Array.prototype.slice.call(el.querySelectorAll('.aiae-card__tick')),
          idx: 0,
          timer: null,
          inView: false,
          // Neighbouring cards flip out of step rather than in unison
          phase: (i % 4) * 620
        };
      })
      .filter(function(it) { return it.shots.length > 1; });

    if (!items.length) return;

    function paint(it) {
      it.shots.forEach(function(img, k) { img.classList.toggle('is-active', k === it.idx); });
      it.ticks.forEach(function(t, k) { t.classList.toggle('is-active', k === it.idx); });
    }
    function stop(it) {
      if (it.timer) { clearTimeout(it.timer); it.timer = null; }
    }
    function schedule(it, delay) {
      stop(it);
      if (!it.inView || document.hidden) return;
      it.timer = setTimeout(function() {
        it.idx = (it.idx + 1) % it.shots.length;
        paint(it);
        schedule(it, STEP);
      }, delay);
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          const it = entry.target.aiaeFlip;
          if (!it) return;
          it.inView = entry.isIntersecting;
          if (it.inView) schedule(it, STEP + it.phase); else stop(it);
        });
      }, { threshold: 0.2 });
      items.forEach(function(it) {
        it.shots[0].parentNode.aiaeFlip = it;
        io.observe(it.shots[0].parentNode);
      });
    } else {
      items.forEach(function(it) { it.inView = true; schedule(it, STEP + it.phase); });
    }

    document.addEventListener('visibilitychange', function() {
      items.forEach(function(it) {
        // Phase kept on resume, or every card would come back in lockstep
        if (document.hidden) stop(it); else schedule(it, STEP + it.phase);
      });
    });
  }

  // ─── Concept carousels: hovering prev/next arrows ──────
  // Desktop has no visible scrollbar on these tracks, so the arrows are
  // the only affordance. Each click lands on a real card edge, which is
  // the snap the CSS proximity scroller would otherwise only approximate.
  function initCarousels(reduceMotion) {
    Array.prototype.slice.call(document.querySelectorAll('[data-aiae-carousel]'))
      .forEach(function(root) { setupCarousel(root, reduceMotion); });

    document.addEventListener('shopify:section:load', function(e) {
      Array.prototype.slice.call(e.target.querySelectorAll('[data-aiae-carousel]'))
        .forEach(function(root) { setupCarousel(root, reduceMotion); });
    });
  }

  function setupCarousel(root, reduceMotion) {
    if (root.dataset.aiaeCarouselReady === 'true') return;
    const track = root.querySelector('[data-aiae-carousel-track]');
    const prev = root.querySelector('[data-aiae-carousel-prev]');
    const next = root.querySelector('[data-aiae-carousel-next]');
    if (!track || !prev || !next) return;
    root.dataset.aiaeCarouselReady = 'true';

    const behavior = reduceMotion ? 'auto' : 'smooth';

    function cards() {
      return Array.prototype.slice.call(track.children);
    }

    // 1px of slack absorbs sub-pixel scroll positions so the card the
    // viewport is already parked on is never picked as "the next one".
    function step(dir) {
      const list = cards();
      if (!list.length) return;
      const left = track.scrollLeft;
      let target = null;
      if (dir > 0) {
        for (let i = 0; i < list.length; i++) {
          if (list[i].offsetLeft > left + 1) { target = list[i]; break; }
        }
        if (!target) target = list[list.length - 1];
      } else {
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].offsetLeft < left - 1) { target = list[i]; break; }
        }
        if (!target) target = list[0];
      }
      track.scrollTo({ left: target.offsetLeft, behavior: behavior });
    }

    function sync() {
      const max = track.scrollWidth - track.clientWidth;
      const overflows = max > 2;
      prev.hidden = !overflows || track.scrollLeft <= 2;
      next.hidden = !overflows || track.scrollLeft >= max - 2;
    }

    prev.addEventListener('click', function() { step(-1); });
    next.addEventListener('click', function() { step(1); });
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    if (window.ResizeObserver) new ResizeObserver(sync).observe(track);
    // Lazy-loaded card images change scrollWidth after first paint.
    window.addEventListener('load', sync);
    sync();
  }

  // ─── Scroll-entrance reveals ───────────────────────────
  function initReveal(reduceMotion, loader) {
    const SELECTOR = '.aiae-reveal, [data-aiae-reveal]';
    const targets = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
    if (!targets.length) return;
    // Without the .aiae-anim body class nothing is ever hidden,
    // so reduced motion / old browsers simply show static content.
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    document.body.classList.add('aiae-anim');

    // Once the entrance settles, strip the reveal hooks so the
    // element returns to stock styling (hover transitions etc.).
    function settle(el) {
      const delay = (parseFloat(getComputedStyle(el).transitionDelay) || 0) * 1000;
      setTimeout(function() {
        el.classList.remove('aiae-reveal', 'is-revealed');
        el.removeAttribute('data-aiae-reveal');
      }, 950 + delay);
    }

    const io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        entry.target.classList.add('is-revealed');
        settle(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });

    function observeAll(els) {
      els.forEach(function(el) {
        // The -10% bottom inset keeps below-the-fold reveals from firing too
        // early, but it also swallows anything already parked at the bottom of
        // the first screen (the hero CTA). Those reveal straight away.
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('is-revealed');
          settle(el);
          return;
        }
        io.observe(el);
      });
    }

    // Hold the first reveals until the intro loader curtain lifts
    const wait = (loader && loader.style.display !== 'none') ? 1900 : 0;
    setTimeout(function() { observeAll(targets); }, wait);

    // Theme editor re-renders sections with fresh (hidden) markup
    document.addEventListener('shopify:section:load', function(e) {
      observeAll(Array.prototype.slice.call(e.target.querySelectorAll(SELECTOR)));
    });
  }

  // ─── Mobile fullscreen menu ────────────────────────────
  function initMenu() {
    const toggle = document.querySelector('[data-aiae-menu-toggle]');
    const menu = document.getElementById('aiae-menu');
    if (!toggle || !menu) return;

    function setOpen(open) {
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('aiae-menu-lock', open);
    }

    toggle.addEventListener('click', function() {
      setOpen(!menu.classList.contains('is-open'));
    });
    menu.querySelectorAll('[data-aiae-menu-link]').forEach(function(link) {
      link.addEventListener('click', function() { setOpen(false); });
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false);
    });
  }

  // ─── Personalizer carousel — infinite loop with ghost cards ─
  function initPod(reduceMotion) {
    const pod = document.querySelector('.aiae-pod');
    if (!pod) return;

    function slice(nodes) { return Array.prototype.slice.call(nodes); }

    // One group per personalized collection. Only the active group's track
    // and thumbnail row are in the DOM flow; the rest sit hidden.
    const groups = slice(pod.querySelectorAll('.aiae-pod-track[data-pod-group]')).map(function(track, gi) {
      const thumbsWrap = pod.querySelector('.aiae-pod__thumbs[data-pod-group="' + gi + '"]');
      return {
        track: track,
        thumbsWrap: thumbsWrap,
        cards: slice(track.querySelectorAll('[data-pod-card]')),
        thumbs: thumbsWrap ? slice(thumbsWrap.querySelectorAll('[data-pod-thumb]')) : [],
        lastOff: []
      };
    });
    const tabs = slice(pod.querySelectorAll('[data-pod-tab]'));
    if (!groups.length || !groups[0].cards.length) return;

    let g = groups[0];

    const info = pod.querySelector('[data-pod-info]');
    const nameEl = pod.querySelector('[data-pod-name]');
    const codeEl = pod.querySelector('[data-pod-code]');
    const descEl = pod.querySelector('[data-pod-desc]');
    const counterEl = pod.querySelector('[data-pod-counter]');
    const numEl = pod.querySelector('[data-pod-num]');
    const btn = pod.querySelector('[data-pod-btn]');
    const prev = pod.querySelector('[data-pod-prev]');
    const next = pod.querySelector('[data-pod-next]');
    const frame = pod.querySelector('[data-pod-frame]');
    const autoplayOn = pod.dataset.autoplay === 'true' && !reduceMotion;
    const delay = Math.max(2, parseInt(pod.dataset.autoplaySpeed, 10) || 4) * 1000;
    let idx = -1;

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    // The oversized numeral is a marker for the change of piece, not a
    // backdrop: it comes up as the strip moves and fades out behind it.
    let numTimer = null;
    function flashNum() {
      if (!numEl) return;
      numEl.classList.add('is-flash');
      if (numTimer) clearTimeout(numTimer);
      numTimer = setTimeout(function() { numEl.classList.remove('is-flash'); }, 850);
    }

    function paint(i) {
      const d = g.cards[i].dataset;
      if (nameEl) nameEl.textContent = d.name || '';
      if (codeEl) codeEl.textContent = d.code || '';
      if (descEl) descEl.textContent = d.desc || '';
      if (counterEl) counterEl.textContent = pad(i + 1) + ' / ' + pad(g.cards.length);
      if (numEl) { numEl.textContent = pad(i + 1); flashNum(); }
      if (btn) btn.setAttribute('href', (d.url && d.url.length) ? d.url : '#');
    }

    // How far apart the cards sit and how small the ghosts get is a CSS
    // decision (it changes with the breakpoint), so read it back from there.
    function geom() {
      const cs = getComputedStyle(pod);
      const step = parseFloat(cs.getPropertyValue('--pod-step'));
      const ghost = parseFloat(cs.getPropertyValue('--pod-ghost'));
      return {
        step: isNaN(step) ? 104 : step,
        ghost: isNaN(ghost) ? 0.82 : ghost
      };
    }

    // Position every card on a circular strip around the active one.
    // Ghosts sit at ±1; anything further is faded out, so the card that
    // wraps around the loop teleports while invisible.
    function layout(instant) {
      const total = g.cards.length;
      const half = Math.floor(total / 2);
      const gm = geom();
      g.cards.forEach(function(card, k) {
        const off = ((k - idx) % total + total + half) % total - half;
        const dist = Math.abs(off);
        const snap = instant || (g.lastOff[k] !== undefined && Math.abs(off - g.lastOff[k]) > 1);
        g.lastOff[k] = off;
        if (snap) card.classList.add('is-snap');
        const scale = dist === 0 ? 1 : (dist === 1 ? gm.ghost : gm.ghost * 0.9);
        card.style.transform = 'translate(-50%, -50%) translateX(' + (off * gm.step) + '%) scale(' + scale + ')';
        card.style.zIndex = String(3 - Math.min(dist, 2));
        card.classList.toggle('is-active', dist === 0);
        card.classList.toggle('is-ghost', dist === 1);
        if (snap) {
          void card.offsetWidth;
          card.classList.remove('is-snap');
        }
      });
    }

    function setActive(i, instant) {
      const total = g.cards.length;
      i = (i % total + total) % total;
      if (i === idx) return;
      idx = i;
      layout(instant);
      g.thumbs.forEach(function(t, k) { t.classList.toggle('is-active', k === idx); });

      if (instant || reduceMotion || !info) {
        paint(idx);
      } else {
        info.classList.add('is-swapping');
        setTimeout(function() {
          paint(idx);
          info.classList.remove('is-swapping');
        }, 200);
      }
    }

    // ── Infinite auto-rotation ──
    let timer = null;
    let inView = true;
    function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
    function startAuto() {
      if (!autoplayOn || !inView || document.hidden || g.cards.length < 2) return;
      stopAuto();
      timer = setInterval(function() { setActive(idx + 1); }, delay);
    }
    function nudge() { stopAuto(); startAuto(); }

    // ── Collection switcher ──
    function selectGroup(gi) {
      const target = groups[gi];
      if (!target || target === g || !target.cards.length) return;
      stopAuto();
      g.track.hidden = true;
      if (g.thumbsWrap) g.thumbsWrap.hidden = true;
      g = target;
      g.track.hidden = false;
      if (g.thumbsWrap) g.thumbsWrap.hidden = false;
      g.lastOff = [];
      tabs.forEach(function(t) {
        const on = parseInt(t.dataset.podTab, 10) === gi;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      idx = -1;
      setActive(0, true);
      startAuto();
    }
    tabs.forEach(function(t) {
      t.addEventListener('click', function() { selectGroup(parseInt(t.dataset.podTab, 10)); });
    });

    if (autoplayOn) {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function(entries) {
          inView = entries[0].isIntersecting;
          if (inView) startAuto(); else stopAuto();
        }, { threshold: 0.25 }).observe(pod);
      }
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) stopAuto(); else startAuto();
      });
      if (frame) {
        frame.addEventListener('mouseenter', stopAuto);
        frame.addEventListener('mouseleave', startAuto);
      }
    }

    // ── Controls ──
    let dragMoved = false;
    groups.forEach(function(group) {
      group.thumbs.forEach(function(t, k) {
        t.addEventListener('click', function() { setActive(k); nudge(); });
      });
      // Clicking a ghost card brings it to the front
      group.cards.forEach(function(card, k) {
        card.addEventListener('click', function() {
          if (dragMoved || group !== g) return;
          if (card.classList.contains('is-ghost')) { setActive(k); nudge(); }
        });
      });
    });
    if (prev) prev.addEventListener('click', function() { setActive(idx - 1); nudge(); });
    if (next) next.addEventListener('click', function() { setActive(idx + 1); nudge(); });

    // Keyboard arrows when the pod is in view
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const r = pod.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      if (r.top > window.innerHeight * 0.4 || r.bottom < window.innerHeight * 0.6) return;
      if (e.key === 'ArrowLeft') setActive(idx - 1);
      else setActive(idx + 1);
      nudge();
    });

    // ── Scrollable frame: drag / swipe / horizontal wheel ──
    if (frame) {
      let sx = 0, sy = 0, dragging = false;
      frame.addEventListener('pointerdown', function(e) {
        dragging = true; dragMoved = false;
        sx = e.clientX; sy = e.clientY;
        frame.classList.add('is-grabbing');
        stopAuto();
      });
      window.addEventListener('pointermove', function(e) {
        if (!dragging) return;
        if (Math.abs(e.clientX - sx) > 8) dragMoved = true;
      });
      window.addEventListener('pointerup', function(e) {
        if (!dragging) return;
        dragging = false;
        frame.classList.remove('is-grabbing');
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
          setActive(dx < 0 ? idx + 1 : idx - 1);
        }
        startAuto();
        setTimeout(function() { dragMoved = false; }, 0);
      });
      window.addEventListener('pointercancel', function() {
        dragging = false;
        frame.classList.remove('is-grabbing');
        startAuto();
      });

      let wheelLock = false;
      frame.addEventListener('wheel', function(e) {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        if (wheelLock) return;
        wheelLock = true;
        setActive(e.deltaX > 0 ? idx + 1 : idx - 1);
        nudge();
        setTimeout(function() { wheelLock = false; }, 450);
      }, { passive: false });
    }

    // The strip geometry is breakpoint-dependent — re-lay it out after a resize
    let resizeTimer = null;
    window.addEventListener('resize', function() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() { layout(true); }, 150);
    });

    setActive(0, true);
    startAuto();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiae);
  } else {
    initAiae();
  }
})();
