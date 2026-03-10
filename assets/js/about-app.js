'use strict';

/* ═══════════════════════════════════════════════════════════════
   about-app.js — Logic for about.html
   Depends on: Utils (utils.js), COURSE_DATA (courses-data.js)
   NO innerHTML for dynamic content — DOM API only.
   ═══════════════════════════════════════════════════════════════ */

(function () {

  /* ─────────────────────────────────────────
     ALIASES + GUARD CLAUSE
  ───────────────────────────────────────── */

  var U    = window.Utils;
  var DATA = window.COURSE_DATA;

  if (!U || !DATA) {
    console.error('about-app: dependencies missing.');
    return;
  }

  /* ─────────────────────────────────────────
     HELPERS (now powered by Utils)
  ───────────────────────────────────────── */

  function setAttr(id, attr, val) {
    var el = U.qs('#' + id);
    if (el) el.setAttribute(attr, val);
  }

  function setText(id, val) {
    var el = U.qs('#' + id);
    if (el) el.textContent = val;
  }

  function buildWhatsAppUrl(phone, message) {
    var raw = 'https://wa.me/' + encodeURIComponent(phone);
    if (message) raw += '?text=' + encodeURIComponent(message);
    return U.sanitizeUrl(raw);
  }

  /* ─────────────────────────────────────────
     SEO INJECTION
  ───────────────────────────────────────── */

  function injectSEO() {
    var brand   = DATA.BRAND_NAME;
    var domain  = DATA.DOMAIN;
    var meta    = DATA.META;
    var base    = 'https://' + domain;
    var pageUrl = base + '/about.html';

    var pageTitle = 'About Us — ' + brand;
    var pageDesc  = meta.descriptionShort + ' — ' + brand;
    var pageImage = base + meta.ogImage;

    /* <title> */
    document.title = pageTitle;

    /* meta description */
    setAttr('page-desc',     'content', pageDesc);
    setAttr('page-canonical', 'href',   pageUrl);

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

    /* hreflang — try id first, fall back to attribute selector */
    var hreflang = U.qs('#hreflang-en') ||
                   U.qs('link[rel="alternate"][hreflang="en"]');
    if (hreflang) hreflang.setAttribute('href', pageUrl);

    /* aria-current="page" on About nav link */
    U.qsa('.nav-link').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href.indexOf('about') !== -1) {
        link.setAttribute('aria-current', 'page');
      }
    });

    /* JSON-LD — Organization + WebPage */
    var schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': base + '/#organization',
          'name': brand,
          'url': base,
          'logo': base + (meta.logoPath || '/assets/img/fav180.png'),
          'foundingDate': meta.foundingYear,
          'contactPoint': {
            '@type': 'ContactPoint',
            'contactType': 'customer support',
            'availableLanguage': 'English'
          }
        },
        {
          '@type': 'WebPage',
          '@id': pageUrl + '#webpage',
          'url': pageUrl,
          'name': pageTitle,
          'description': pageDesc,
          'isPartOf': { '@id': base + '/#website' },
          'about': { '@id': base + '/#organization' },
          'inLanguage': 'en'
        }
      ]
    };

    var script = document.createElement('script');
    script.type        = 'application/ld+json';
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  }

  /* ─────────────────────────────────────────
     BUILDERS
  ───────────────────────────────────────── */

  function buildNavBrand() {
    setText('nav-brand-name', DATA.BRAND_NAME);
  }

  function buildInlineBrands() {
    /* brand-inline-1 — used in platform section body text */
    setText('brand-inline-1', DATA.BRAND_NAME);
  }

  function buildWhatsAppLinks() {
    var message = (DATA.META && DATA.META.whatsappDefaultMessage)
      ? DATA.META.whatsappDefaultMessage
      : 'Hello! I have a question about your courses.';
    var url = buildWhatsAppUrl(DATA.WHATSAPP_NUMBER, message);
    var ids = [
      'contact-whatsapp-btn',
      'footer-whatsapp-link',
      'footer-wa-link-2'
    ];
    ids.forEach(function (id) {
      var el = U.qs('#' + id);
      if (el) el.href = url;
    });
  }

  function buildEmailLinks() {
    var email  = DATA.META.supportEmail;
    var mailto = U.sanitizeUrl('mailto:' + email);

    var contactLink = U.qs('#contact-email-link');
    if (contactLink) contactLink.href = mailto;

    var contactText = U.qs('#contact-email-text');
    if (contactText) contactText.textContent = email;

    var footerLink = U.qs('#footer-email-link');
    if (footerLink) footerLink.href = mailto;
  }

  function buildFooter() {
    setText('footer-brand-name', DATA.BRAND_NAME);
    setText('footer-copyright',
      '© ' + new Date().getFullYear() + ' ' +
      DATA.BRAND_NAME + '. All rights reserved.'
    );
  }

  function buildFooterCategories() {
    var list = U.qs('#footer-categories');
    if (!list) return;
    var catMap = {};
    DATA.courses.forEach(function (c) {
      catMap[c.category] = (catMap[c.category] || 0) + 1;
    });
    Object.keys(catMap).forEach(function (name) {
      var li = document.createElement('li');
      var a = U.el('a', {
        href: U.sanitizeUrl('./course/?category=' + encodeURIComponent(name)),
        textContent: name
      });
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */

  function init() {
    injectSEO();
    buildNavBrand();
    buildInlineBrands();
    buildWhatsAppLinks();
    buildEmailLinks();
    buildFooter();
    buildFooterCategories();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();