/**
 * Consent cookie-uri AIA.E
 *
 * Bannerul din snippets/aiae-cookie-consent.liquid înlocuiește doar interfața
 * bannerului nativ Shopify; decizia vizitatorului merge tot prin Customer
 * Privacy API, deci pixelii Shopify, aplicațiile și Web Pixels o respectă.
 *
 * Fără acest API nu putem înregistra nimic, așa că în lipsa lui bannerul rămâne
 * ascuns în loc să ceară un acord pe care nu l-am putea aplica.
 */
(function () {
  'use strict';

  var ALL_CATEGORIES = ['analytics', 'marketing', 'preferences'];

  var root = document.querySelector('[data-aiae-cookie-consent]');
  if (!root) return;

  var banner = root.querySelector('[data-aiae-ckc-banner]');
  var overlay = root.querySelector('[data-aiae-ckc-overlay]');
  var dialog = root.querySelector('[data-aiae-ckc-dialog]');
  var checkboxes = root.querySelectorAll('[data-aiae-ckc-category]');
  var privacy = null;
  var lastFocus = null;

  /* ── API ────────────────────────────────────────────────── */

  function load(callback) {
    if (window.Shopify && window.Shopify.customerPrivacy) {
      callback(window.Shopify.customerPrivacy);
      return;
    }
    if (!window.Shopify || typeof window.Shopify.loadFeatures !== 'function') {
      callback(null);
      return;
    }
    window.Shopify.loadFeatures(
      [{ name: 'consent-tracking-api', version: '0.1' }],
      function (error) {
        callback(error ? null : window.Shopify.customerPrivacy || null);
      }
    );
  }

  /**
   * `sale_of_data` urmează marketingul: partajarea cu partenerii de publicitate
   * este exact ce descrie categoria de marketing în panoul de setări.
   */
  function apply(consent) {
    if (!privacy) return;
    privacy.setTrackingConsent(
      {
        analytics: !!consent.analytics,
        marketing: !!consent.marketing,
        preferences: !!consent.preferences,
        sale_of_data: !!consent.marketing,
      },
      function (result) {
        /*
         * Pe previzualizarea locala (`shopify theme dev`) apelul catre
         * Storefront API esueaza cu "Failed to fetch" — acolo alegerea nu se
         * salveaza si bannerul reapare la reincarcare. Pe domeniul real se
         * salveaza normal.
         */
        if (result && result.error) {
          console.warn('[aiae] Consimtamantul nu a putut fi salvat:', result.error);
        }
        hideBanner();
        closeDialog();
      }
    );
  }

  function everything(value) {
    var consent = {};
    ALL_CATEGORIES.forEach(function (name) {
      consent[name] = value;
    });
    return consent;
  }

  function fromCheckboxes() {
    var consent = {};
    Array.prototype.forEach.call(checkboxes, function (input) {
      consent[input.getAttribute('data-aiae-ckc-category')] = input.checked;
    });
    return consent;
  }

  function syncCheckboxes() {
    var current = privacy && privacy.currentVisitorConsent ? privacy.currentVisitorConsent() : {};
    Array.prototype.forEach.call(checkboxes, function (input) {
      input.checked = current[input.getAttribute('data-aiae-ckc-category')] === 'yes';
    });
  }

  /* ── Interfață ──────────────────────────────────────────── */

  function showBanner() {
    root.hidden = false;
    banner.hidden = false;
  }

  function hideBanner() {
    banner.hidden = true;
    if (overlay.hidden) root.hidden = true;
  }

  function openDialog() {
    lastFocus = document.activeElement;
    syncCheckboxes();
    root.hidden = false;
    overlay.hidden = false;
    document.body.classList.add('aiae-ckc-open');
    dialog.focus();
  }

  function closeDialog() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('aiae-ckc-open');
    if (banner.hidden) root.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  function on(selector, handler) {
    root.querySelectorAll(selector).forEach(function (el) {
      el.addEventListener('click', handler);
    });
  }

  on('[data-aiae-ckc-accept]', function () {
    apply(everything(true));
  });
  on('[data-aiae-ckc-decline]', function () {
    apply(everything(false));
  });
  on('[data-aiae-ckc-save]', function () {
    apply(fromCheckboxes());
  });
  on('[data-aiae-ckc-open]', openDialog);
  on('[data-aiae-ckc-close]', closeDialog);

  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) closeDialog();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeDialog();
  });

  /* Orice link din temă poate redeschide panoul — vezi subsolul paginii. */
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-aiae-cookie-prefs]');
    if (!trigger) return;
    event.preventDefault();
    if (!privacy) return;
    openDialog();
  });

  /* ── Pornire ────────────────────────────────────────────── */

  load(function (api) {
    privacy = api;
    if (!privacy) {
      console.warn('[aiae] Customer Privacy API indisponibil — bannerul de cookie-uri nu se afișează.');
      return;
    }
    syncCheckboxes();
    if (typeof privacy.shouldShowBanner !== 'function' || privacy.shouldShowBanner()) {
      showBanner();
    }
  });
})();
