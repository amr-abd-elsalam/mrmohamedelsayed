'use strict';

/* ═══════════════════════════════════════════════════════════════
   legal-app.js — Shared logic for legal/privacy.html
                  and legal/terms.html
   Depends on: Utils (utils.js), COURSE_DATA (courses-data.js)
   NO innerHTML for dynamic content — DOM API only.
   ═══════════════════════════════════════════════════════════════ */

(function () {

  /* ─────────────────────────────────────────
     GUARD CLAUSE + ALIASES
  ───────────────────────────────────────── */

  var U    = window.Utils;
  var DATA = window.COURSE_DATA;

  if (!U || !DATA) {
    console.error('legal-app: dependencies missing.');
    return;
  }

  var META = DATA.META;

  /* ─────────────────────────────────────────
     HELPERS (using Utils)
  ───────────────────────────────────────── */

  function buildWhatsAppUrl(phone, message) {
    var base = 'https://wa.me/' + encodeURIComponent(phone);
    if (message) base += '?text=' + encodeURIComponent(message);
    return U.sanitizeUrl(base);
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHref(id, href) {
    var el = document.getElementById(id);
    if (el) el.href = U.sanitizeUrl(href);
  }

  function setAttr(id, attr, val) {
    var el = document.getElementById(id);
    if (el) el.setAttribute(attr, val);
  }

  /* ─────────────────────────────────────────
     SEO INJECTION
  ───────────────────────────────────────── */

  function injectSEO() {
    var brand   = DATA.BRAND_NAME;
    var domain  = DATA.DOMAIN;
    var base    = 'https://' + domain;

    /* detect current page */
    var isTerms   = window.location.pathname.indexOf('terms') !== -1;
    var pageSlug  = isTerms ? 'terms.html' : 'privacy.html';
    var pageUrl   = base + '/legal/' + pageSlug;
    var pageImage = base + META.ogImage;

    var pageTitle, pageDesc;

    if (isTerms) {
      pageTitle = 'Terms of Use — ' + brand;
      pageDesc  = META.descriptionShort + ' — Terms of Use';
    } else {
      pageTitle = 'Privacy Policy — ' + brand;
      pageDesc  = META.descriptionShort + ' — Privacy Policy';
    }

    /* <title> */
    document.title = pageTitle;

    /* meta tags */
    setAttr('page-desc',     'content', pageDesc);
    setAttr('page-canonical','href',    pageUrl);

    /* Open Graph */
    setAttr('og-url',       'content', pageUrl);
    setAttr('og-title',     'content', pageTitle);
    setAttr('og-desc',      'content', pageDesc);
    setAttr('og-image',     'content', pageImage);
    setAttr('og-site-name', 'content', brand);

    /* Twitter Card */
    setAttr('tw-title', 'content', pageTitle);
    setAttr('tw-desc',  'content', pageDesc);
    setAttr('tw-image', 'content', pageImage);

    /* hreflang — try ID first, fall back to attribute selector */
    var hreflang = document.getElementById('hreflang-en')
      || document.querySelector('link[rel="alternate"][hreflang="en"]');
    if (hreflang) hreflang.setAttribute('href', pageUrl);

    /* JSON-LD — WebPage schema */
    var schema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': pageUrl + '#webpage',
      'url': pageUrl,
      'name': pageTitle,
      'description': pageDesc,
      'isPartOf': { '@id': base + '/#website' },
      'inLanguage': 'en',
      'dateModified': META.legalLastUpdated || '2026-02-19'
    };

    var script = U.el('script', { type: 'application/ld+json', textContent: JSON.stringify(schema, null, 2) });
    document.head.appendChild(script);
  }

  /* ─────────────────────────────────────────
     BUILDERS
  ───────────────────────────────────────── */

  function buildNavBrand() {
    setText('nav-brand-name', DATA.BRAND_NAME);
  }

  function buildInlineBrandDomain() {
    var brand  = DATA.BRAND_NAME;
    var domain = DATA.DOMAIN;
    var base   = 'https://' + domain;

    /* brand inline references — no-op if ID not present in page */
    ['brand-inline-1','brand-inline-2','brand-inline-3',
     'brand-inline-4','brand-inline-5','brand-inline-6'
    ].forEach(function (id) { setText(id, brand); });

    /* domain inline text */
    setText('domain-inline-1',     domain);
    setText('legal-domain-inline', domain);

    /* domain link in contact block */
    var domainLink = document.getElementById('domain-link');
    if (domainLink) {
      domainLink.textContent = domain;
      domainLink.href        = U.sanitizeUrl(base);
    }

    /* terms page: self-referencing URL */
    var termsLink = document.getElementById('terms-url-link');
    if (termsLink) {
      var termsUrl = base + '/legal/terms.html';
      termsLink.textContent = termsUrl;
      termsLink.href        = U.sanitizeUrl(termsUrl);
    }
  }

  function buildEmailLinks() {
    var email  = META.supportEmail;
    var mailto = 'mailto:' + email;

    var contactLink = document.getElementById('contact-email-link');
    if (contactLink) contactLink.href = U.sanitizeUrl(mailto);

    var contactText = document.getElementById('contact-email-text');
    if (contactText) contactText.textContent = email;

    var footerLink = document.getElementById('footer-email-link');
    if (footerLink) footerLink.href = U.sanitizeUrl(mailto);
  }

  function buildWhatsAppLinks() {
    var message = (META.whatsappDefaultMessage)
      ? META.whatsappDefaultMessage
      : 'Hello! I have a question about your courses.';

    var url = buildWhatsAppUrl(DATA.WHATSAPP_NUMBER, message);

    ['contact-whatsapp-link',
     'footer-whatsapp-link',
     'footer-wa-link-2'
    ].forEach(function (id) { setHref(id, url); });
  }

  function buildFooter() {
    setText('footer-brand-name', DATA.BRAND_NAME);
    setText('footer-copyright',
      '© ' + new Date().getFullYear() + ' ' +
      DATA.BRAND_NAME + '. All rights reserved.'
    );
  }

  /* ─────────────────────────────────────────
     FOOTER CATEGORIES
  ───────────────────────────────────────── */

  function buildFooterCategories() {
    var container = document.getElementById('footer-categories');
    if (!container) return;

    /* compute { categoryName → courseCount } from live data */
    var counts = {};
    DATA.courses.forEach(function (c) {
      if (!c.category) return;
      counts[c.category] = (counts[c.category] || 0) + 1;
    });

    var names = Object.keys(counts);
    if (!names.length) return;

    names.forEach(function (name) {
      var href = '../course/?category=' + encodeURIComponent(name);
      var li = U.el('li', null, [
        U.el('a', { href: U.sanitizeUrl(href), textContent: name })
      ]);
      container.appendChild(li);
    });
  }

  /* ─────────────────────────────────────────
     SMOOTH SCROLL — TOC links
  ───────────────────────────────────────── */

  function initTocScroll() {
    var toc = U.qs('.legal-toc');
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

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */

  function init() {
    injectSEO();
    buildNavBrand();
    buildInlineBrandDomain();
    buildEmailLinks();
    buildWhatsAppLinks();
    buildFooter();
    buildFooterCategories();
    initTocScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();