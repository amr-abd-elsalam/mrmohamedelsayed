/* ── Upgrade Summary ──
   - COMPLETE REWRITE — unified single controller for privacy.html AND terms.html
   - Previous version had English titles + inLanguage:'en' — FIXED to Arabic
     (all legal pages are written in Arabic)
   - Uses SharedPage (SP) for: buildNavBrand, buildFooter, buildFooterCategories,
     buildWhatsAppLinks, buildEmailLinks, buildInlineBrandDomain, injectBaseSEO,
     injectJsonLd, initTocScroll, markCurrentNavLink
   - Reduced from ~180 lines to ~105 lines by leveraging SharedPage
   - Page detection: isTerms vs isPrivacy from pathname (unchanged logic, cleaner code)
   - Copyright via SP.buildCopyrightText() (unified formatYear)
   - Footer tagline from META.footerTagline
   - Added U.announce() on page load
   - JSON-LD: WebPage with dateModified from META.legalLastUpdated, inLanguage: 'ar'
   - hreflang: targets 'hreflang-ar' (was incorrectly 'hreflang-en' in old legal-app.js)
   ── End Summary ── */

'use strict';

(function () {

  /* ── Guard & Aliases ── */

  var U    = window.Utils;
  var DATA = window.COURSE_DATA;
  var SP   = window.SharedPage;

  if (!U || !DATA || !SP) {
    console.error('legal-app: dependencies missing.');
    return;
  }

  var META = DATA.META;

  /* ── Path Constants (relative from /legal/) ── */

  var COURSE_BASE = '../course/';

  /* ── Page Detection ── */

  function _isTermsPage() {
    return window.location.pathname.indexOf('terms') !== -1;
  }

  /* ── SEO ── */

  function injectSEO() {
    var base     = 'https://' + DATA.DOMAIN;
    var isTerms  = _isTermsPage();
    var pageSlug = isTerms ? 'terms.html' : 'privacy.html';
    var pageUrl  = base + '/legal/' + pageSlug;

    var pageTitle, pageDesc;
    if (isTerms) {
      pageTitle = 'شروط الاستخدام \u2014 ' + DATA.BRAND_NAME;
      pageDesc  = META.descriptionShort + ' \u2014 شروط الاستخدام وسياسة الشراء والاسترداد.';
    } else {
      pageTitle = 'سياسة الخصوصية \u2014 ' + DATA.BRAND_NAME;
      pageDesc  = META.descriptionShort + ' \u2014 كيف نجمع ونستخدم ونحمي بياناتك الشخصية.';
    }

    SP.injectBaseSEO({
      pageTitle:   pageTitle,
      pageDesc:    pageDesc,
      pageUrl:     pageUrl,
      pageImage:   base + META.ogImage,
      brand:       DATA.BRAND_NAME,
      hreflangId:  'hreflang-ar'
    });

    /* JSON-LD — WebPage */
    SP.injectJsonLd({
      '@context':     'https://schema.org',
      '@type':        'WebPage',
      '@id':          pageUrl + '#webpage',
      'url':          pageUrl,
      'name':         pageTitle,
      'description':  pageDesc,
      'isPartOf':     { '@id': base + '/#website' },
      'inLanguage':   'ar',
      'dateModified': META.legalLastUpdated || '2026-03-10'
    }, 'jsonld-legal');
  }

  /* ── WhatsApp Links ── */

  function buildWhatsAppCTA() {
    SP.buildWhatsAppLinks([
      'contact-whatsapp-link',
      'footer-whatsapp-link',
      'footer-wa-link-2'
    ]);
  }

  /* ── Init ── */

  function init() {
    injectSEO();
    SP.buildNavBrand();
    SP.buildInlineBrandDomain();
    SP.buildEmailLinks();
    buildWhatsAppCTA();
    SP.buildFooterCategories(COURSE_BASE);
    SP.buildFooter();
    SP.initTocScroll('.legal-toc');

    var pageName = _isTermsPage() ? 'شروط الاستخدام' : 'سياسة الخصوصية';
    U.announce(pageName);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
