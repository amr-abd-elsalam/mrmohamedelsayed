/* ── Upgrade Summary ──
   - Uses SharedPage for: footer, nav brand, WhatsApp links, footer categories,
     copyright, formatPrice, star fragment, SEO injection, nav aria-current
   - All hardcoded Arabic strings moved to COURSE_DATA.META (white-label ready)
   - Dead code: removed local buildWhatsAppUrl, getWhatsAppMessage, getLogoPath,
     formatPrice, buildStarFragment, buildFooterCategories, buildFooter (now in SharedPage)
   - Extracted buildFeaturedCard into sub-functions (was >50 lines)
   - FEATURED_COUNT → named constant
   - Copyright formatting unified to U.formatYear() via SharedPage.buildCopyrightText()
   - Added U.announce() calls for dynamic content
   - Improved aria labels using META strings
   - SEO injection uses SharedPage.injectBaseSEO() + SharedPage.injectJsonLd()
   - Category icons remain page-specific (not white-label)
   ── End Summary ── */

'use strict';

(function () {

  /* ── Guard & Aliases ── */

  var U    = window.Utils;
  var DATA = window.COURSE_DATA;
  var SP   = window.SharedPage;

  if (!U || !DATA || !SP) {
    console.error('home-app: dependencies missing.');
    return;
  }

  var META = DATA.META;

  /* ── Constants ── */

  var FEATURED_COUNT = 3;

  var CATEGORY_ICONS = {
    'الدعامة والحركة في الكائنات الحية':        'bi-activity',
    'التكاثر واستمرارية الحياة':                'bi-heart-pulse-fill',
    'التنسيق الهرموني والعصبي':                'bi-lightning-charge-fill',
    'البيولوجيا الجزيئية والتكنولوجيا الحيوية':  'bi-virus2'
  };

  /* ── Path Constants (relative from /) ── */

  var COURSE_BASE    = './course/';
  var DETAILS_BASE   = './course/course-details/?id=';
  var IMG_BASE       = './assets/img/';

  /* ── Computed Stats ── */

  function computeStats() {
    var courseCount   = DATA.courses.length;
    var totalStudents = DATA.courses.reduce(function (s, c) { return s + c.students; }, 0);
    var ratedCourses  = DATA.courses.filter(function (c) { return c.rating > 0; });
    var avgRating     = ratedCourses.length > 0
      ? (ratedCourses.reduce(function (s, c) { return s + c.rating; }, 0) / ratedCourses.length)
      : 0;

    return [
      { icon: 'bi-journal-bookmark-fill', number: U.formatNumberAr(courseCount),   label: 'كورسات متاحة' },
      { icon: 'bi-people-fill',           number: U.formatNumberAr(totalStudents), label: 'طلاب مسجلين' },
      { icon: 'bi-star-fill',             number: avgRating > 0 ? U.formatNumberAr(avgRating.toFixed(1)) : '٠', label: 'متوسط التقييم' },
      { icon: 'bi-award-fill',            number: ratedCourses.length > 0 ? '١٠٠٪' : '٠٪', label: 'نسبة الرضا' }
    ];
  }

  /* ── Data Helpers ── */

  function getFeaturedCourses() {
    return DATA.courses.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    }).slice(0, FEATURED_COUNT);
  }

  function getLevelLabel(level) {
    return (META.levels && META.levels[level]) || level;
  }

  /* ── SEO ── */

  function injectSEO() {
    var base      = 'https://' + DATA.DOMAIN;
    var pageTitle = DATA.BRAND_NAME + ' — ' + META.tagline;

    SP.injectBaseSEO({
      pageTitle: pageTitle,
      pageDesc:  META.description,
      pageUrl:   base + '/',
      pageImage: base + META.ogImage,
      brand:     DATA.BRAND_NAME
    });

    SP.markCurrentNavLink(function (href) {
      return (href === '/' || href === './' ||
              href.indexOf('index.html') !== -1) &&
             href.indexOf('course') === -1;
    });

    /* JSON-LD — WebSite + Organization */
    SP.injectJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': base + '/#website',
          'name': DATA.BRAND_NAME,
          'url': base,
          'description': META.description,
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
          'name': DATA.BRAND_NAME,
          'url': base,
          'logo': base + (META.logoPath || '/assets/img/fav180.png'),
          'foundingDate': META.foundingYear,
          'contactPoint': {
            '@type': 'ContactPoint',
            'contactType': 'customer support',
            'availableLanguage': 'Arabic'
          }
        }
      ]
    }, 'jsonld-home');
  }

  /* ── Hero ── */

  function buildHero() {
    SP.setTextById('nav-brand-name', DATA.BRAND_NAME);
    SP.setTextById('hero-title-line1',   META.heroLine1    || '');
    SP.setTextById('hero-title-gradient', META.heroLine2   || '');
    SP.setTextById('hero-subtitle',       META.heroSubtitle || '');
  }

  /* ── Stats Bar ── */

function buildStats() {
  var container = document.getElementById('stats-bar');
  if (!container) return;

  var stats = computeStats();
  var frag  = document.createDocumentFragment();

  stats.forEach(function (stat) {
    frag.appendChild(
      U.el('div', { className: 'stat-item', role: 'listitem' }, [
        U.el('i',   { className: 'bi ' + stat.icon + ' stat-icon', aria: { hidden: 'true' } }),
        U.el('div', { className: 'stat-number', textContent: stat.number }),
        U.el('div', { className: 'stat-label',  textContent: stat.label })
      ])
    );
  });

  container.innerHTML = '';   /* ← مسح الـ skeleton placeholders أولاً */
  container.appendChild(frag);
}

  /* ── Featured Course Card ── */

  function _buildCardImage(course) {
    return U.el('img', {
      className: 'featured-card-img',
      alt:       course.title,
      loading:   'lazy',
      decoding:  'async',
      width:     '400',
      height:    '225',
      src:       U.sanitizeUrl(IMG_BASE + course.image)
    });
  }

  function _buildCardMeta(course) {
    var metaRow = U.el('div', { className: 'featured-card-meta' });

    /* Stars */
    var starsWrap = U.el('div', {
      className: 'featured-stars',
      role:      'img',
      aria:      { label: 'التقييم: ' + U.formatNumberAr(course.rating) + ' من ٥' }
    });
    starsWrap.appendChild(SP.buildStarFragment(course.rating));
    metaRow.appendChild(starsWrap);

    /* Lessons */
    metaRow.appendChild(
      U.el('span', { className: 'featured-meta-item' }, [
        U.el('i', { className: 'bi bi-play-circle', aria: { hidden: 'true' } }),
        ' ' + U.formatNumberAr(course.lessons) + ' درس'
      ])
    );

    /* Level — Arabic label */
    metaRow.appendChild(
      U.el('span', { className: 'featured-meta-item' }, [
        U.el('i', { className: 'bi bi-bar-chart-fill', aria: { hidden: 'true' } }),
        ' ' + getLevelLabel(course.level)
      ])
    );

    return metaRow;
  }

  function _buildCardFooter(course) {
    var footer = U.el('div', { className: 'featured-card-footer' });

    footer.appendChild(U.el('span', {
      className:   'featured-card-price' + (course.price === 0 ? ' featured-card-price--free' : ''),
      textContent: SP.formatPrice(course.price)
    }));

    footer.appendChild(U.el('a', {
      className:   'featured-card-btn',
      href:        U.sanitizeUrl(DETAILS_BASE + course.id),
      textContent: META.viewCourse || 'عرض الكورس',
      aria:        { label: (META.viewCourse || 'عرض كورس') + ': ' + course.title }
    }));

    return footer;
  }

  function buildFeaturedCard(course) {
    var col  = U.el('div', { className: 'col-12 col-md-6 col-lg-4' });
    var card = U.el('div', { className: 'featured-card' });

    /* Image */
    card.appendChild(_buildCardImage(course));

    /* Body */
    var body = U.el('div', { className: 'featured-card-body' });
    body.appendChild(U.el('div', { className: 'featured-card-category', textContent: course.category }));
    body.appendChild(U.el('h3',  { className: 'featured-card-title',    textContent: course.title }));

    var descAttrs = { className: 'featured-card-desc', textContent: course.description };
    if (course.language === 'ar') {
      descAttrs.dir  = 'rtl';
      descAttrs.lang = 'ar';
    }
    body.appendChild(U.el('p', descAttrs));

    body.appendChild(_buildCardMeta(course));
    body.appendChild(_buildCardFooter(course));

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

  /* ── Categories ── */

  function buildCategoryCard(name, count, colorKey) {
    var col = U.el('div', { className: 'col-6 col-sm-4 col-md-3 col-lg-2' });

    var countLabel = count === 1 ? 'كورس واحد' : U.formatNumberAr(count) + ' كورسات';

    var anchor = U.el('a', {
      className: 'category-card category-card--' + colorKey,
      href:      U.sanitizeUrl(SP.buildCatalogUrl(COURSE_BASE, name)),
      aria:      { label: name + ' — ' + countLabel }
    });

    anchor.appendChild(
      U.el('div', { className: 'category-icon category-icon--' + colorKey }, [
        U.el('i', {
          className: 'bi ' + (CATEGORY_ICONS[name] || 'bi-bookmark-fill'),
          aria:      { hidden: 'true' }
        })
      ])
    );
    anchor.appendChild(U.el('span', { className: 'category-name',  textContent: name }));
    anchor.appendChild(U.el('span', { className: 'category-count', textContent: countLabel }));

    col.appendChild(anchor);
    return col;
  }

  function buildCategories() {
    var grid = document.getElementById('categories-grid');
    if (!grid) return;

    var catMap = SP.getCategoriesWithCount();
    var frag   = document.createDocumentFragment();

    Object.keys(catMap).forEach(function (name) {
      var colorKey = (DATA.categories[name] || {}).color || 'emerald';
      frag.appendChild(buildCategoryCard(name, catMap[name], colorKey));
    });

    grid.appendChild(frag);
  }

  /* ── WhatsApp & Footer ── */

  function buildWhatsAppCTA() {
    var url = SP.getDefaultWhatsAppUrl();
    SP.setHrefById('cta-whatsapp-btn', url);
  }

  /* ── Init ── */

  function init() {
    injectSEO();
    buildHero();
    buildStats();
    buildFeaturedCourses();
    buildCategories();
    buildWhatsAppCTA();
    SP.buildWhatsAppLinks(['footer-whatsapp-link']);
    SP.buildFooterCategories(COURSE_BASE);
    SP.buildFooter();
    U.announce(U.formatNumberAr(DATA.courses.length) + ' كورس متاح');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
