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
    initPodSnap(reduceMotion);
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

  // ─── Personalizer carousel ─────────────────────────────
  function initPod(reduceMotion) {
    const pod = document.querySelector('.aiae-pod');
    if (!pod) return;

    const slides = Array.prototype.slice.call(pod.querySelectorAll('.aiae-pod-slide'));
    const thumbs = Array.prototype.slice.call(pod.querySelectorAll('[data-pod-thumb]'));
    if (!slides.length) return;

    const info = pod.querySelector('[data-pod-info]');
    const nameEl = pod.querySelector('[data-pod-name]');
    const codeEl = pod.querySelector('[data-pod-code]');
    const descEl = pod.querySelector('[data-pod-desc]');
    const counterEl = pod.querySelector('[data-pod-counter]');
    const btn = pod.querySelector('[data-pod-btn]');
    const prev = pod.querySelector('[data-pod-prev]');
    const next = pod.querySelector('[data-pod-next]');
    const frame = pod.querySelector('.aiae-pod-frame');
    const total = slides.length;
    let idx = -1;

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function paint(i) {
      const d = slides[i].dataset;
      if (nameEl) nameEl.textContent = d.name || '';
      if (codeEl) codeEl.textContent = d.code || '';
      if (descEl) descEl.textContent = d.desc || '';
      if (counterEl) counterEl.textContent = pad(i + 1) + ' / ' + pad(total);
      if (btn) btn.setAttribute('href', (d.url && d.url.length) ? d.url : '#');
    }

    function setActive(i, instant) {
      i = (i % total + total) % total;
      if (i === idx) return;
      idx = i;
      slides.forEach(function(s, k) { s.classList.toggle('is-active', k === idx); });
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

    thumbs.forEach(function(t, k) {
      t.addEventListener('click', function() { setActive(k); });
    });
    if (prev) prev.addEventListener('click', function() { setActive(idx - 1); });
    if (next) next.addEventListener('click', function() { setActive(idx + 1); });

    // Keyboard arrows when the pod is in view
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const r = pod.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      if (r.top > window.innerHeight * 0.4 || r.bottom < window.innerHeight * 0.6) return;
      if (e.key === 'ArrowLeft') setActive(idx - 1);
      else setActive(idx + 1);
    });

    // Swipe on the frame (mobile)
    if (frame) {
      let sx = 0, sy = 0, tracking = false;
      frame.addEventListener('touchstart', function(e) {
        const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; tracking = true;
      }, { passive: true });
      frame.addEventListener('touchend', function(e) {
        if (!tracking) return; tracking = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
          setActive(dx < 0 ? idx + 1 : idx - 1);
        }
      }, { passive: true });
    }

    setActive(0, true);
  }

  // ─── Magnetic fullscreen snap (luxurious easing) ───────
  function initPodSnap(reduceMotion) {
    if (reduceMotion) return;
    const pod = document.querySelector('.aiae-pod');
    if (!pod) return;

    let cooldown = false;
    let raf = null;

    function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function tweenTo(targetY, dur) {
      const startY = window.scrollY || window.pageYOffset;
      const dist = targetY - startY;
      if (Math.abs(dist) < 3) return;
      const start = performance.now();
      cooldown = true;
      if (raf) cancelAnimationFrame(raf);
      (function step(now) {
        const p = Math.min(1, (now - start) / dur);
        window.scrollTo(0, startY + dist * easeInOutCubic(p));
        if (p < 1) raf = requestAnimationFrame(step);
        else setTimeout(function() { cooldown = false; }, 140);
      })(start);
    }

    function trySnap() {
      if (cooldown) return;
      const rect = pod.getBoundingClientRect();
      const vh = window.innerHeight;
      const top = rect.top;
      // Only when the pod is taller-or-equal usable height and partly in the capture band.
      const enteringDown = top > 0 && top < vh * 0.5;                       // pulling up into view
      const enteringUp = top < 0 && top > -vh * 0.42 && rect.bottom > vh * 0.5; // scrolling back up into it
      if (enteringDown || enteringUp) {
        tweenTo((window.scrollY || window.pageYOffset) + top, 720);
      }
    }

    // Act only on scroll-end so we never fight an active gesture.
    let timer = null;
    function schedule() {
      if (cooldown) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(trySnap, 120);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', function() { if (!cooldown) trySnap(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiae);
  } else {
    initAiae();
  }
})();
