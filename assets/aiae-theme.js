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
    function onScroll() {
      const y = window.scrollY || window.pageYOffset;
      if (nav) nav.classList.toggle('is-scrolled', y > 40);
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

    const cards = Array.prototype.slice.call(pod.querySelectorAll('[data-pod-card]'));
    const thumbs = Array.prototype.slice.call(pod.querySelectorAll('[data-pod-thumb]'));
    if (!cards.length) return;

    const info = pod.querySelector('[data-pod-info]');
    const nameEl = pod.querySelector('[data-pod-name]');
    const codeEl = pod.querySelector('[data-pod-code]');
    const descEl = pod.querySelector('[data-pod-desc]');
    const counterEl = pod.querySelector('[data-pod-counter]');
    const btn = pod.querySelector('[data-pod-btn]');
    const prev = pod.querySelector('[data-pod-prev]');
    const next = pod.querySelector('[data-pod-next]');
    const frame = pod.querySelector('[data-pod-frame]');
    const total = cards.length;
    const half = Math.floor(total / 2);
    const autoplay = pod.dataset.autoplay === 'true' && !reduceMotion && total > 1;
    const delay = Math.max(2, parseInt(pod.dataset.autoplaySpeed, 10) || 4) * 1000;
    let idx = -1;
    const lastOff = new Array(total);

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function paint(i) {
      const d = cards[i].dataset;
      if (nameEl) nameEl.textContent = d.name || '';
      if (codeEl) codeEl.textContent = d.code || '';
      if (descEl) descEl.textContent = d.desc || '';
      if (counterEl) counterEl.textContent = pad(i + 1) + ' / ' + pad(total);
      if (btn) btn.setAttribute('href', (d.url && d.url.length) ? d.url : '#');
    }

    // Position every card on a circular strip around the active one.
    // Ghosts sit at ±1; anything further is faded out, so the card that
    // wraps around the loop teleports while invisible.
    function layout(instant) {
      cards.forEach(function(card, k) {
        const off = ((k - idx) % total + total + half) % total - half;
        const dist = Math.abs(off);
        const snap = instant || (lastOff[k] !== undefined && Math.abs(off - lastOff[k]) > 1);
        lastOff[k] = off;
        if (snap) card.classList.add('is-snap');
        const scale = dist === 0 ? 1 : (dist === 1 ? 0.86 : 0.76);
        card.style.transform = 'translate(-50%, -50%) translateX(' + (off * 104) + '%) scale(' + scale + ')';
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
      i = (i % total + total) % total;
      if (i === idx) return;
      idx = i;
      layout(instant);
      thumbs.forEach(function(t, k) { t.classList.toggle('is-active', k === idx); });

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
      if (!autoplay || !inView || document.hidden) return;
      stopAuto();
      timer = setInterval(function() { setActive(idx + 1); }, delay);
    }
    function nudge() { stopAuto(); startAuto(); }

    if (autoplay) {
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
    thumbs.forEach(function(t, k) {
      t.addEventListener('click', function() { setActive(k); nudge(); });
    });
    if (prev) prev.addEventListener('click', function() { setActive(idx - 1); nudge(); });
    if (next) next.addEventListener('click', function() { setActive(idx + 1); nudge(); });

    // Clicking a ghost card brings it to the front
    let dragMoved = false;
    cards.forEach(function(card, k) {
      card.addEventListener('click', function() {
        if (dragMoved) return;
        if (card.classList.contains('is-ghost')) { setActive(k); nudge(); }
      });
    });

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

    setActive(0, true);
    startAuto();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiae);
  } else {
    initAiae();
  }
})();
