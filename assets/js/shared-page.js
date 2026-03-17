/* ── Upgrade Summary ──
   NEW FILE — shared-page.js
   - Extracts common page-chrome builders shared across all controllers:
     buildNavBrand, buildFooter, buildFooterCategories, buildWhatsAppLinks,
     buildEmailLinks, buildWhatsAppUrl, buildCatalogUrl, buildCourseUrl,
     formatPrice, injectBaseSEO, setTextById, setAttrById, setHrefById
   - Eliminates ~95% duplication between home-app, about-app, legal-app
   - All functions use Utils.el() and Utils.sanitizeUrl() — no innerHTML
   - Frozen public API: window.SharedPage
   ── End Summary ── */

'use strict';

var SharedPage = (function () {

  var U    = window.Utils;
  var DATA = window.COURSE_DATA;

  if (!U || !DATA) {
    console.error('SharedPage: dependencies missing (Utils or COURSE_DATA).');
    return null;
  }

  var META = DATA.META;

  /* ── DOM Helpers ── */

  function setTextById(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHrefById(id, href) {
    var el = document.getElementById(id);
    if (el) el.href = U.sanitizeUrl(href);
  }

  function setAttrById(id, attr, val) {
    var el = document.getElementById(id);
    if (el) el.setAttribute(attr, val);
  }

  /* ── URL Builders ── */

  /**
   * Build a WhatsApp deep link.
   * @param {string} phone  — phone number (digits only)
   * @param {string} [message] — pre-filled message
   * @returns {string} sanitized URL
   */
  function buildWhatsAppUrl(phone, message) {
    var base = 'https://wa.me/' + encodeURIComponent(phone);
    if (message) base += '?text=' + encodeURIComponent(message);
    return U.sanitizeUrl(base);
  }

  /**
   * Build catalog URL, optionally filtered by category.
   * @param {string} basePath — relative path to course/ dir (e.g. './course/', '../course/')
   * @param {string} [category] — optional category filter
   * @returns {string}
   */
  function buildCatalogUrl(basePath, category) {
    if (!category) return basePath;
    return basePath + '?category=' + encodeURIComponent(category);
  }

  /**
   * Build course detail URL.
   * @param {string} basePath — relative path to course-details/ dir
   * @param {number} id — course ID
   * @returns {string}
   */
  function buildCourseUrl(basePath, id) {
    return basePath + '?id=' + encodeURIComponent(id);
  }

  /**
   * Format a price for display in Arabic.
   * @param {number} price
   * @returns {string}
   */
  function formatPrice(price) {
    if (parseFloat(price) === 0) return META.freeLabel || 'مجاني';
    return U.formatNumberAr(price) + ' ' + (META.currencyLabel || 'ج.م');
  }

  /**
   * Get the default WhatsApp message from META.
   * @returns {string}
   */
  function getWhatsAppMessage() {
    return META.whatsappDefaultMessage || 'مرحباً! عندي سؤال عن الكورسات.';
  }

  /**
   * Get the default WhatsApp URL with pre-filled message.
   * @returns {string}
   */
  function getDefaultWhatsAppUrl() {
    return buildWhatsAppUrl(DATA.WHATSAPP_NUMBER, getWhatsAppMessage());
  }

  /* ── Copyright Builder ── */

  /**
   * Build copyright text using META.copyrightTemplate.
   * @returns {string}
   */
  function buildCopyrightText() {
    var year = U.formatYear(new Date().getFullYear());
    var template = META.copyrightTemplate || '© {year} {brand}. جميع الحقوق محفوظة.';
    return template
      .replace('{year}', year)
      .replace('{brand}', DATA.BRAND_NAME);
  }

  /* ── Nav Brand ── */

  /**
   * Set brand name in navbar.
   * Looks for element with id="nav-brand-name".
   */
  function buildNavBrand() {
    setTextById('nav-brand-name', DATA.BRAND_NAME);
  }

  /* ── Footer Builder ── */

  /**
   * Populate footer brand name and copyright.
   * Expects ids: footer-brand-name, footer-copyright
   */
  function buildFooter() {
    setTextById('footer-brand-name', DATA.BRAND_NAME);
    setTextById('footer-copyright', buildCopyrightText());
  }

  /**
   * Populate footer category links.
   * @param {string} courseBasePath — relative path to course/ dir from current page
   */
  function buildFooterCategories(courseBasePath) {
    var container = document.getElementById('footer-categories');
    if (!container) return;

    var counts = {};
    DATA.courses.forEach(function (c) {
      if (!c.category) return;
      counts[c.category] = (counts[c.category] || 0) + 1;
    });

    var names = Object.keys(counts);
    if (!names.length) return;

    var frag = document.createDocumentFragment();
    names.forEach(function (name) {
      var href = buildCatalogUrl(courseBasePath, name);
      frag.appendChild(
        U.el('li', null, [
          U.el('a', { href: U.sanitizeUrl(href), textContent: name })
        ])
      );
    });
    container.appendChild(frag);
  }

  /* ── WhatsApp Links ── */

  /**
   * Set href on WhatsApp link elements.
   * @param {string[]} ids — array of element IDs to update
   */
  function buildWhatsAppLinks(ids) {
    var url = getDefaultWhatsAppUrl();
    ids.forEach(function (id) { setHrefById(id, url); });
  }

  /* ── Email Links ── */

  /**
   * Set href and text on email link elements.
   * Expects ids: contact-email-link, contact-email-text, footer-email-link
   */
  function buildEmailLinks() {
    var email  = META.supportEmail;
    if (!email) return;
    var mailto = 'mailto:' + email;

    setHrefById('contact-email-link', mailto);
    setTextById('contact-email-text', email);
    setHrefById('footer-email-link', mailto);
  }

  /* ── Inline Brand / Domain Text ── */

  /**
   * Fill brand and domain text into inline placeholder elements.
   * Supports brand-inline-1..6, domain-inline-1, legal-domain-inline,
   * domain-link, terms-url-link
   */
  function buildInlineBrandDomain() {
    var brand  = DATA.BRAND_NAME;
    var domain = DATA.DOMAIN;
    var base   = 'https://' + domain;

    var BRAND_IDS = [
      'brand-inline-1', 'brand-inline-2', 'brand-inline-3',
      'brand-inline-4', 'brand-inline-5', 'brand-inline-6'
    ];
    BRAND_IDS.forEach(function (id) { setTextById(id, brand); });

    setTextById('domain-inline-1', domain);
    setTextById('legal-domain-inline', domain);

    var domainLink = document.getElementById('domain-link');
    if (domainLink) {
      domainLink.textContent = domain;
      domainLink.href = U.sanitizeUrl(base);
    }

    var termsLink = document.getElementById('terms-url-link');
    if (termsLink) {
      var termsUrl = base + '/legal/terms.html';
      termsLink.textContent = termsUrl;
      termsLink.href = U.sanitizeUrl(termsUrl);
    }
  }

  /* ── SEO Injection ── */

  /**
   * Inject common SEO meta tags from provided config.
   * @param {object} config
   * @param {string} config.pageTitle
   * @param {string} config.pageDesc
   * @param {string} config.pageUrl
   * @param {string} config.pageImage
   * @param {string} config.brand
   * @param {string} [config.hreflangId] — ID of hreflang link element (default: 'hreflang-ar')
   */
  function injectBaseSEO(config) {
    document.title = config.pageTitle;

    setAttrById('page-desc',      'content', config.pageDesc);
    setAttrById('page-canonical',  'href',   config.pageUrl);

    /* Open Graph */
    var ogMap = {
      'og-url':       config.pageUrl,
      'og-title':     config.pageTitle,
      'og-desc':      config.pageDesc,
      'og-image':     config.pageImage,
      'og-site-name': config.brand
    };
    Object.keys(ogMap).forEach(function (id) {
      setAttrById(id, 'content', ogMap[id]);
    });

    /* Twitter Card */
    var twMap = {
      'tw-title': config.pageTitle,
      'tw-desc':  config.pageDesc,
      'tw-image': config.pageImage
    };
    Object.keys(twMap).forEach(function (id) {
      setAttrById(id, 'content', twMap[id]);
    });

    /* hreflang */
    var hreflangId = config.hreflangId || 'hreflang-ar';
    var hreflang = document.getElementById(hreflangId)
      || document.querySelector('link[rel="alternate"][hreflang="ar"]');
    if (hreflang) hreflang.setAttribute('href', config.pageUrl);
  }

  /**
   * Inject a JSON-LD script into <head>.
   * @param {object} schema — the schema.org object
   * @param {string} [id] — optional script element ID for later reference
   */
  function injectJsonLd(schema, id) {
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    if (id) script.id = id;
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  }

  /* ── TOC Smooth Scroll ── */

  /**
   * Enable smooth scroll for table-of-contents anchor links.
   * @param {string} [tocSelector] — CSS selector for TOC container (default: '.legal-toc')
   */
  function initTocScroll(tocSelector) {
    var toc = U.qs(tocSelector || '.legal-toc');
    if (!toc) return;

    toc.addEventListener('click', function (e) {
      var anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;

      var targetId = anchor.getAttribute('href').slice(1);
      var target   = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (history.replaceState) {
        history.replaceState(null, '', '#' + targetId);
      }
    });
  }

  /* ── aria-current on nav links ── */

  /**
   * Set aria-current="page" on nav links matching current page.
   * @param {function} matchFn — receives href string, returns true if current page
   */
  function markCurrentNavLink(matchFn) {
    U.qsa('.nav-link').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && matchFn(href)) {
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  /* ── Star Rating Fragment (display only) ── */

  /**
   * Build a document fragment with star icons for a rating value.
   * Supports half-star display.
   * @param {number} rating — 0 to 5
   * @returns {DocumentFragment}
   */
  function buildStarFragment(rating) {
    var MAX_STARS = 5;
    var frag = document.createDocumentFragment();
    for (var i = 1; i <= MAX_STARS; i++) {
      var cls = rating >= i
        ? 'bi bi-star-fill'
        : rating >= i - 0.5 ? 'bi bi-star-half' : 'bi bi-star';
      frag.appendChild(U.el('i', { className: cls, aria: { hidden: 'true' } }));
    }
    return frag;
  }

  /* ── Categories with Counts ── */

  /**
   * Count courses per category.
   * @returns {object} { categoryName: count }
   */
  function getCategoriesWithCount() {
    var map = {};
    DATA.courses.forEach(function (c) {
      map[c.category] = (map[c.category] || 0) + 1;
    });
    return map;
  }

  /* ── Public API ── */

  return Object.freeze({
    /* DOM helpers */
    setTextById:     setTextById,
    setHrefById:     setHrefById,
    setAttrById:     setAttrById,

    /* URL builders */
    buildWhatsAppUrl:    buildWhatsAppUrl,
    buildCatalogUrl:     buildCatalogUrl,
    buildCourseUrl:      buildCourseUrl,
    getDefaultWhatsAppUrl: getDefaultWhatsAppUrl,
    getWhatsAppMessage:  getWhatsAppMessage,

    /* Formatting */
    formatPrice:       formatPrice,
    buildCopyrightText: buildCopyrightText,

    /* Page chrome builders */
    buildNavBrand:          buildNavBrand,
    buildFooter:            buildFooter,
    buildFooterCategories:  buildFooterCategories,
    buildWhatsAppLinks:     buildWhatsAppLinks,
    buildEmailLinks:        buildEmailLinks,
    buildInlineBrandDomain: buildInlineBrandDomain,

    /* SEO */
    injectBaseSEO:    injectBaseSEO,
    injectJsonLd:     injectJsonLd,
    markCurrentNavLink: markCurrentNavLink,

    /* UI helpers */
    initTocScroll:          initTocScroll,
    buildStarFragment:      buildStarFragment,
    getCategoriesWithCount: getCategoriesWithCount
  });

})();

if (typeof window !== 'undefined' && SharedPage) window.SharedPage = SharedPage;
