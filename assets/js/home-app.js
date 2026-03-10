'use strict';

/* ═══════════════════════════════════════════════════════════════
   home-app.js — Logic for index.html
   Depends on: Utils (utils.js), COURSE_DATA (courses-data.js)
   Uses Utils (aliased U) for all DOM construction and security.
   NO innerHTML for dynamic content — DOM API only.
   ═══════════════════════════════════════════════════════════════ */

(function () {

  /* ─────────────────────────────────────────
     GUARD CLAUSE & ALIASES
  ───────────────────────────────────────── */

  var U    = window.Utils;
  var DATA = window.COURSE_DATA;

  if (!U || !DATA) {
    console.error('home-app: dependencies missing.');
    return;
  }

  /* ─────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────── */

  var FEATURED_COUNT = 3;

  var CATEGORY_ICONS = {
    'الدعامة والحركة في الكائنات الحية':      'bi-activity',
    'التكاثر واستمرارية الحياة':              'bi-heart-pulse-fill',
    'التنسيق الهرموني والعصبي':              'bi-lightning-charge-fill',
    'البيولوجيا الجزيئية والتكنولوجيا الحيوية': 'bi-virus2'
  };

  /* ─────────────────────────────────────────
     COMPUTED STATS
  ───────────────────────────────────────── */

  var courseCount   = DATA.courses.length;
  var totalStudents = DATA.courses.reduce(function (s, c) { return s + c.students; }, 0);
  var ratedCourses  = DATA.courses.filter(function (c) { return c.rating > 0; });
  var avgRating     = ratedCourses.length > 0
    ? (ratedCourses.reduce(function (s, c) { return s + c.rating; }, 0) / ratedCourses.length)
    : 0;

  var STATS = [
    { icon: 'bi-journal-bookmark-fill', number: U.formatNumber(courseCount),   label: 'كورسات متاحة' },
    { icon: 'bi-people-fill',           number: U.formatNumber(totalStudents), label: 'طلاب مسجلين' },
    { icon: 'bi-star-fill',             number: avgRating > 0 ? avgRating.toFixed(1) : '0', label: 'متوسط التقييم' },
    { icon: 'bi-award-fill',            number: ratedCourses.length > 0 ? '100%' : '0%',   label: 'نسبة الرضا' }
  ];

  /* ─────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────── */

  function getWhatsAppMessage() {
    return (DATA.META && DATA.META.whatsappDefaultMessage)
      ? DATA.META.whatsappDefaultMessage
      : 'مرحباً! عندي سؤال عن الكورسات.';
  }

  function getLogoPath() {
    return (DATA.META && DATA.META.logoPath)
      ? DATA.META.logoPath
      : '/assets/img/fav180.png';
  }

  function buildWhatsAppUrl(phone, message) {
    var base = 'https://wa.me/' + encodeURIComponent(phone);
    if (message) base += '?text=' + encodeURIComponent(message);
    return base;
  }

  function buildCatalogUrl(category) {
    if (!category) return './course/';
    return './course/?category=' + encodeURIComponent(category);
  }

  function buildCourseUrl(id) {
    return './course/course-details/?id=' + encodeURIComponent(id);
  }

  function formatPrice(price) {
    if (price === 0) return 'مجاني';
    return price.toFixed(0) + ' ج.م';
  }

  function getFeaturedCourses() {
    return DATA.courses.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    }).slice(0, FEATURED_COUNT);
  }

  function getCategoriesWithCount() {
    var map = {};
    DATA.courses.forEach(function (c) {
      map[c.category] = (map[c.category] || 0) + 1;
    });
    return map;
  }

  function buildStarFragment(rating) {
    var frag = document.createDocumentFragment();
    for (var i = 1; i <= 5; i++) {
      var cls = rating >= i
        ? 'bi bi-star-fill'
        : rating >= i - 0.5 ? 'bi bi-star-half' : 'bi bi-star';
      frag.appendChild(U.el('i', { className: cls, aria: { hidden: 'true' } }));
    }
    return frag;
  }

  /* ─────────────────────────────────────────
     SEO INJECTION — from DATA
  ───────────────────────────────────────── */

  function injectSEO() {
    var brand  = DATA.BRAND_NAME;
    var domain = DATA.DOMAIN;
    var meta   = DATA.META;
    var base   = 'https://' + domain;

    var pageTitle = brand + ' — ' + meta.tagline;
    var pageDesc  = meta.description;
    var pageUrl   = base + '/';
    var pageImage = base + meta.ogImage;

    /* <title> */
    document.title = pageTitle;

    /* meta description */
    var descEl = document.getElementById('page-desc');
    if (descEl) descEl.setAttribute('content', pageDesc);

    /* canonical */
    var canonEl = document.getElementById('page-canonical');
    if (canonEl) canonEl.setAttribute('href', pageUrl);

    /* Open Graph */
    var ogMap = {
      'og-url':       pageUrl,
      'og-title':     pageTitle,
      'og-desc':      pageDesc,
      'og-image':     pageImage,
      'og-site-name': brand
    };
    Object.keys(ogMap).forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.setAttribute('content', ogMap[id]);
    });

    /* Twitter Card */
    var twMap = {
      'tw-title': pageTitle,
      'tw-desc':  pageDesc,
      'tw-image': pageImage
    };
    Object.keys(twMap).forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.setAttribute('content', twMap[id]);
    });

    /* hreflang */
    var hreflang = document.getElementById('hreflang-ar');
    if (!hreflang) {
      hreflang = document.querySelector('link[rel="alternate"][hreflang="ar"]');
    }
    if (hreflang) hreflang.setAttribute('href', pageUrl);

    /* aria-current="page" on Home nav link */
    U.qsa('.nav-link').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && (href === '/' || href === './' ||
          href.indexOf('index.html') !== -1) &&
          href.indexOf('course') === -1) {
        link.setAttribute('aria-current', 'page');
      }
    });

    /* JSON-LD — WebSite + Organization */
    var schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': base + '/#website',
          'name': brand,
          'url': base,
          'description': meta.description,
          'potentialAction': {
            '@type': 'SearchAction',
            'target': {
              '@type': 'EntryPoint',
              'urlTemplate': base + '/course/?search={search_term_string}'
            },
            'query-input': 'required name=search_term_string'
          }
        },
        {
          '@type': 'Organization',
          '@id': base + '/#organization',
          'name': brand,
          'url': base,
          'logo': base + getLogoPath(),
          'foundingDate': meta.foundingYear,
          'contactPoint': {
            '@type': 'ContactPoint',
            'contactType': 'customer support',
            'availableLanguage': 'Arabic'
          }
        }
      ]
    };

    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  }

  /* ─────────────────────────────────────────
     BUILDERS
  ───────────────────────────────────────── */

  function buildHero() {
    var line1    = document.getElementById('hero-title-line1');
    var gradient = document.getElementById('hero-title-gradient');
    var subtitle = document.getElementById('hero-subtitle');
    var navBrand = document.getElementById('nav-brand-name');

    if (navBrand)  navBrand.textContent  = DATA.BRAND_NAME;
    if (line1)     line1.textContent     = 'افهم الأحياء صح،';
    if (gradient)  gradient.textContent  = 'وحقق أعلى الدرجات.';
    if (subtitle)  subtitle.textContent  =
      'شرح تفصيلي لمنهج الأحياء للثانوية العامة — من الدعامة والحركة للبيولوجيا الجزيئية. ' +
      'رسومات توضيحية، أسئلة محلولة، ودعم مباشر من المدرس.';
  }

  function buildStats() {
    var container = document.getElementById('stats-bar');
    if (!container) return;
    var frag = document.createDocumentFragment();

    STATS.forEach(function (stat) {
      var item = U.el('div', { className: 'stat-item', role: 'listitem' }, [
        U.el('i', { className: 'bi ' + stat.icon + ' stat-icon', aria: { hidden: 'true' } }),
        U.el('div', { className: 'stat-number', textContent: stat.number }),
        U.el('div', { className: 'stat-label',  textContent: stat.label })
      ]);
      frag.appendChild(item);
    });

    container.appendChild(frag);
  }

  function buildFeaturedCard(course) {
    var col = U.el('div', { className: 'col-12 col-md-6 col-lg-4' });

    var card = U.el('div', { className: 'featured-card' });

    /* image */
    var img = U.el('img', {
      className: 'featured-card-img',
      alt:       course.title,
      loading:   'lazy',
      decoding:  'async',
      width:     '400',
      height:    '225',
      src:       './assets/img/' + course.image
    });
    card.appendChild(img);

    /* body */
    var body = U.el('div', { className: 'featured-card-body' });

    body.appendChild(U.el('div', { className: 'featured-card-category', textContent: course.category }));
    body.appendChild(U.el('h3',  { className: 'featured-card-title',    textContent: course.title }));
    var descAttrs = { className: 'featured-card-desc', textContent: course.description };
    if (course.language === 'ar') { descAttrs.dir = 'rtl'; descAttrs.lang = 'ar'; descAttrs.style = { textAlign: 'right' }; }
    body.appendChild(U.el('p', descAttrs));

    /* meta */
    var metaRow = U.el('div', { className: 'featured-card-meta' });

    var starsWrap = U.el('div', {
      className: 'featured-stars',
      role:      'img',
      aria:      { label: 'التقييم: ' + course.rating + ' من 5' }
    });
    starsWrap.appendChild(buildStarFragment(course.rating));
    metaRow.appendChild(starsWrap);

    var lessonsItem = U.el('span', { className: 'featured-meta-item' }, [
      U.el('i', { className: 'bi bi-play-circle', aria: { hidden: 'true' } }),
      ' ' + course.lessons + ' درس'
    ]);
    metaRow.appendChild(lessonsItem);

    var levelItem = U.el('span', { className: 'featured-meta-item' }, [
      U.el('i', { className: 'bi bi-bar-chart-fill', aria: { hidden: 'true' } }),
      ' ' + course.level
    ]);
    metaRow.appendChild(levelItem);

    body.appendChild(metaRow);

    /* footer */
    var footer = U.el('div', { className: 'featured-card-footer' });

    var priceEl = U.el('span', {
      className:   'featured-card-price' + (course.price === 0 ? ' featured-card-price--free' : ''),
      textContent: formatPrice(course.price)
    });
    footer.appendChild(priceEl);

    var btn = U.el('a', {
      className:   'featured-card-btn',
      href:        U.sanitizeUrl(buildCourseUrl(course.id)),
      textContent: 'عرض الكورس',
      aria:        { label: 'عرض كورس: ' + course.title }
    });
    footer.appendChild(btn);

    body.appendChild(footer);
    card.appendChild(body);
    col.appendChild(card);
    return col;
  }

  function buildFeaturedCourses() {
    var grid = document.getElementById('featured-courses-grid');
    if (!grid) return;
    var frag = document.createDocumentFragment();
    getFeaturedCourses().forEach(function (c) {
      frag.appendChild(buildFeaturedCard(c));
    });
    grid.appendChild(frag);
  }

  function buildCategoryCard(name, count, colorKey) {
    var col = U.el('div', { className: 'col-6 col-sm-4 col-md-3 col-lg-2' });

    var anchor = U.el('a', {
      className: 'category-card category-card--' + colorKey,
      href:      U.sanitizeUrl(buildCatalogUrl(name)),
      aria:      { label: name + ' — ' + count + (count === 1 ? ' كورس' : ' كورسات') }
    });

    var iconWrap = U.el('div', { className: 'category-icon category-icon--' + colorKey }, [
      U.el('i', {
        className: 'bi ' + (CATEGORY_ICONS[name] || 'bi-bookmark-fill'),
        aria:      { hidden: 'true' }
      })
    ]);
    anchor.appendChild(iconWrap);

    anchor.appendChild(U.el('span', { className: 'category-name',  textContent: name }));
    anchor.appendChild(U.el('span', { className: 'category-count', textContent: count === 1 ? 'كورس واحد' : count + ' كورسات' }));

    col.appendChild(anchor);
    return col;
  }

  function buildCategories() {
    var grid = document.getElementById('categories-grid');
    if (!grid) return;
    var catMap = getCategoriesWithCount();
    var frag   = document.createDocumentFragment();
    Object.keys(catMap).forEach(function (name) {
      var colorKey = (DATA.categories[name] || {}).color || 'emerald';
      frag.appendChild(buildCategoryCard(name, catMap[name], colorKey));
    });
    grid.appendChild(frag);
  }

  function buildFooterCategories() {
    var list = document.getElementById('footer-categories');
    if (!list) return;
    var catMap = getCategoriesWithCount();
    var frag   = document.createDocumentFragment();
    Object.keys(catMap).forEach(function (name) {
      var li = U.el('li', null, [
        U.el('a', {
          href:        U.sanitizeUrl(buildCatalogUrl(name)),
          textContent: name
        })
      ]);
      frag.appendChild(li);
    });
    list.appendChild(frag);
  }

  function buildWhatsAppLinks() {
    var url = U.sanitizeUrl(buildWhatsAppUrl(
      DATA.WHATSAPP_NUMBER,
      getWhatsAppMessage()
    ));
    var ctaBtn    = document.getElementById('cta-whatsapp-btn');
    var footerBtn = document.getElementById('footer-whatsapp-link');
    if (ctaBtn)    ctaBtn.href    = url;
    if (footerBtn) footerBtn.href = url;
  }

  function buildFooter() {
    var brandEl = document.getElementById('footer-brand-name');
    var copyrEl = document.getElementById('footer-copyright');
    if (brandEl) brandEl.textContent = DATA.BRAND_NAME;
    if (copyrEl) copyrEl.textContent =
      '© ' + new Date().getFullYear() + ' ' +
      DATA.BRAND_NAME + '. جميع الحقوق محفوظة.';
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */

  function init() {
    injectSEO();
    buildHero();
    buildStats();
    buildFeaturedCourses();
    buildCategories();
    buildFooterCategories();
    buildWhatsAppLinks();
    buildFooter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
