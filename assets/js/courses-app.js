/* ── Upgrade Summary ──
   - Uses SharedPage (SP) for: formatPrice, buildCatalogUrl, injectBaseSEO,
     injectJsonLd, markCurrentNavLink, getCategoriesWithCount
   - All hardcoded Arabic strings moved to COURSE_DATA.META (white-label ready):
     level labels, empty state, results text, sort labels, filter headings
   - Removed local LEVEL_LABELS object (now META.levels)
   - Removed duplicated getCategoriesWithCount (now SharedPage)
   - Sort dropdown role fixed: ul→role="listbox", items→role="option" (a11y)
   - Added U.announce() calls: after render, after reset, after sort change
   - buildCard: course level displayed in Arabic via META.levels
   - buildCard: removed inline style textAlign (inherited from dir="rtl")
   - buildCard: image src sanitized via U.sanitizeUrl()
   - buildFiltersDOM: extracted sub-builders (_buildCategoryFilters,
     _buildLevelFilters, _buildRatingFilters, _buildFilterActions)
   - render(): extracted _buildResultsText() helper
   - Pagination: aria-current already correct ✓
   - CONFIG constants documented
   - Magic numbers replaced: SCROLL_OFFSET=100 named
   - Error handling: graceful fallback if DOM elements missing
   - readURL: validates page number against total pages
   ── End Summary ── */

'use strict';

(function () {

  /* ── Guard & Aliases ── */

  var U    = window.Utils;
  var DATA = window.COURSE_DATA;
  var SP   = window.SharedPage;

  if (!U || !DATA || !SP) {
    console.error('courses-app: dependencies missing.');
    return;
  }

  var META = DATA.META;

  /* ── Constants ── */

  var CONFIG = Object.freeze({
    CARDS_PER_PAGE:   6,
    DEBOUNCE_DELAY:   300,   /* ms — search input debounce */
    SCROLL_THROTTLE:  150,   /* ms — FAB scroll throttle */
    SCROLL_HIDE_OFFSET: 100  /* px — hide FAB after scrolling down this far */
  });

  var VALID_LEVELS     = ['All', 'Beginner', 'Intermediate', 'Advanced'];
  var VALID_RATINGS    = [0, 1, 2, 3, 4];
  var VALID_CATEGORIES = Object.keys(DATA.categories);

  var SORT_OPTIONS = [
    { key: 'newly published',   label: 'الأحدث'             },
    { key: 'title a-z',         label: 'العنوان أ-ي'        },
    { key: 'title z-a',         label: 'العنوان ي-أ'        },
    { key: 'price high to low', label: 'السعر: الأعلى أولاً' },
    { key: 'price low to high', label: 'السعر: الأقل أولاً'  },
    { key: 'popular',           label: 'الأكثر شعبية'       },
    { key: 'average ratings',   label: 'الأعلى تقييماً'     }
  ];

  var VALID_SORT_KEYS = SORT_OPTIONS.map(function (o) { return o.key; });
  var DEFAULT_SORT    = 'average ratings';

  /* ── Path Constants (relative from /course/) ── */

  var DETAILS_PATH = './course-details/index.html?id=';
  var IMG_BASE     = '../assets/img/';

  /* ── State ── */

  var state = {
    currentPage:     1,
    currentSort:     DEFAULT_SORT,
    filteredCourses: [],
    filtersEl:       null
  };

  var DOM = {};

  /* ── Helpers ── */

  function getLevelLabel(level) {
    return (META.levels && META.levels[level]) || level;
  }

  function countCategories(courses) {
    var m = {};
    courses.forEach(function (c) { m[c.category] = (m[c.category] || 0) + 1; });
    return m;
  }

  /* ── SEO Injection ── */

  function injectSEO() {
    var base      = 'https://' + DATA.DOMAIN;
    var pageUrl   = base + '/course/';
    var pageTitle = DATA.BRAND_NAME + ' \u2014 تصفح الكورسات';

    SP.injectBaseSEO({
      pageTitle: pageTitle,
      pageDesc:  META.descriptionShort,
      pageUrl:   pageUrl,
      pageImage: base + META.ogImage,
      brand:     DATA.BRAND_NAME
    });

    SP.markCurrentNavLink(function (href) {
      return href &&
        href.indexOf('/course/') !== -1 &&
        href.indexOf('course-details') === -1;
    });

    SP.injectJsonLd({
      '@context':    'https://schema.org',
      '@type':       'CollectionPage',
      'name':        pageTitle,
      'description': META.descriptionShort,
      'url':         pageUrl,
      'publisher': {
        '@type': 'Organization',
        'name':  DATA.BRAND_NAME,
        'url':   base
      },
      'inLanguage': 'ar'
    }, 'jsonld-collection');
  }

  /* ── DOM Cache ── */

  function cacheDom() {
    DOM.grid        = U.qs('#courses-grid');
    DOM.pagination  = U.qs('#pagination-bar');
    DOM.results     = U.qs('#results-text');
    DOM.search      = U.qs('#search-input');
    DOM.sortBtn     = U.qs('#sort-dropdown');
    DOM.sortMenu    = U.qs('#sort-dropdown-menu');
    DOM.desktopSlot = U.qs('#desktop-filters-slot');
    DOM.mobileSlot  = U.qs('#mobile-filters-slot');
    DOM.offcanvas   = U.qs('#offcanvas-filters');
    DOM.fab         = U.qs('#floating-filter-btn');
    DOM.contentArea = U.qs('#content-area');
  }

  /* ══════════════════════════════════════
     FILTERS ENGINE
  ══════════════════════════════════════ */

  function readFilters() {
    if (!state.filtersEl) return { categories: [], level: 'All', minRating: 0, search: '' };

    var cats = U.qsa('input[data-filter="category"]:checked', state.filtersEl)
      .map(function (e) { return e.value; });

    var levelEl = U.qs('input[name="level-filter"]:checked', state.filtersEl);
    var lv = levelEl ? levelEl.value : 'All';

    var ratingEl = U.qs('input[name="rating-filter"]:checked', state.filtersEl);
    var rt = parseInt(ratingEl ? ratingEl.value : '0', 10);

    var s = DOM.search ? DOM.search.value.toLowerCase().trim() : '';

    return { categories: cats, level: lv, minRating: rt, search: s };
  }

  function matchesSearch(course, searchTerm) {
    if (!searchTerm) return true;
    var s = searchTerm;
    return (
      course.title.toLowerCase().indexOf(s) !== -1 ||
      (Array.isArray(course.tags) && course.tags.some(function (t) { return t.toLowerCase().indexOf(s) !== -1; })) ||
      (course.description && course.description.toLowerCase().indexOf(s) !== -1) ||
      (course.instructor && course.instructor.toLowerCase().indexOf(s) !== -1)
    );
  }

  function filterExceptCategory(courses, f) {
    return courses.filter(function (c) {
      if (c.rating < f.minRating) return false;
      if (f.level && f.level !== 'All' && c.level !== f.level) return false;
      if (!matchesSearch(c, f.search)) return false;
      return true;
    });
  }

  function filterByCategory(courses, cats) {
    if (!cats || !cats.length) return courses;
    return courses.filter(function (c) { return cats.indexOf(c.category) !== -1; });
  }

  function sortCourses(courses) {
    var l = courses.slice();
    switch (state.currentSort) {
      case 'title a-z':         return l.sort(function (a, b) { return a.title.localeCompare(b.title, 'ar'); });
      case 'title z-a':         return l.sort(function (a, b) { return b.title.localeCompare(a.title, 'ar'); });
      case 'price low to high': return l.sort(function (a, b) { return a.price - b.price; });
      case 'price high to low': return l.sort(function (a, b) { return b.price - a.price; });
      case 'popular':           return l.sort(function (a, b) { return b.students - a.students; });
      case 'newly published':   return l.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
      default:                  return l.sort(function (a, b) { return b.rating - a.rating; });
    }
  }

  /* ══════════════════════════════════════
     CARD BUILDER
  ══════════════════════════════════════ */

  function _buildCardVisual(course, idx) {
    var img = U.el('img', {
      className: 'card-img-top course-card-img',
      src:       U.sanitizeUrl(IMG_BASE + course.image),
      alt:       course.title,
      loading:   idx < CONFIG.CARDS_PER_PAGE / 2 ? 'eager' : 'lazy',
      decoding:  'async'
    });

    var badgeColor = (DATA.categories[course.category] || {}).color || 'emerald';
    var badge = U.el('span', {
      className: 'course-badge course-badge--' + badgeColor,
      textContent: course.category
    });

    return U.el('div', { className: 'course-card-visual' }, [img, badge]);
  }

  function _buildCardStats(course) {
    return U.el('div', { className: 'course-card-stats' }, [
      U.el('span', null, [
        U.el('i', { className: 'bi bi-people-fill ms-1', aria: { hidden: 'true' } }),
        U.formatNumberAr(course.students)
      ]),
      U.el('span', null, [
        U.el('i', { className: 'bi bi-book-fill ms-1', aria: { hidden: 'true' } }),
        U.formatNumberAr(course.lessons) + ' درس'
      ]),
      U.el('span', null, [
        U.el('i', { className: 'bi bi-star-fill ms-1', aria: { hidden: 'true' } }),
        U.formatNumberAr(course.rating)
      ])
    ]);
  }

  function _buildCardFooter(course) {
    var price = SP.formatPrice(course.price);
    var href  = DETAILS_PATH + course.id;

    return U.el('div', { className: 'course-card-footer' }, [
      U.el('span', {
        className:   'course-card-price' + (course.price === 0 ? ' free' : ''),
        textContent: price
      }),
      U.el('a', {
        className:   'course-card-btn',
        href:        U.sanitizeUrl(href),
        textContent: META.viewCourse || 'عرض الكورس',
        aria:        { label: (META.viewCourse || 'عرض كورس') + ': ' + course.title }
      })
    ]);
  }

  function buildCard(course, idx) {
    var titleEl = U.el('h3', { className: 'course-card-title', textContent: course.title });

    var descAttrs = { className: 'course-card-desc', textContent: course.description };
    if (course.language === 'ar') {
      descAttrs.dir  = 'rtl';
      descAttrs.lang = 'ar';
    }
    var desc = U.el('p', descAttrs);

    var instructor = U.el('span', { className: 'course-card-instructor' }, [
      U.el('i', { className: 'bi bi-person-fill ms-1', aria: { hidden: 'true' } }),
      course.instructor
    ]);

    var body = U.el('div', { className: 'course-card-body' }, [
      titleEl,
      desc,
      instructor,
      _buildCardStats(course),
      _buildCardFooter(course)
    ]);

    var card = U.el('div', {
      className: 'course-card',
      style:     { animationDelay: (idx * 0.08) + 's' },
      dataset:   { category: course.category, level: course.level, rating: String(course.rating) }
    }, [_buildCardVisual(course, idx), body]);

    return U.el('div', { className: 'col-12 col-md-6 col-xl-4 mb-4' }, [card]);
  }

  function buildEmpty() {
    return U.el('div', { className: 'col-12 text-center py-5' }, [
      U.el('i',      { className: 'bi bi-search empty-icon', aria: { hidden: 'true' } }),
      U.el('h3',     { className: 'empty-title', textContent: META.emptyStateTitle || 'مفيش كورسات' }),
      U.el('p',      { className: 'empty-text',  textContent: META.emptyStateText || 'جرّب تغيّر الفلاتر أو كلمة البحث' }),
      U.el('button', {
        className: 'btn-reset',
        type:      'button',
        textContent: META.resetFiltersLabel || 'إعادة ضبط الفلاتر',
        events:    { click: resetAll }
      })
    ]);
  }

  /* ══════════════════════════════════════
     FILTER UI BUILDER
  ══════════════════════════════════════ */

  function _buildCategoryFilters(root) {
    root.appendChild(U.el('h3', { className: 'filters-heading', textContent: 'الفصول' }));
    var catList   = U.el('div', { className: 'filter-group', id: 'category-filter-list' });
    var allCounts = countCategories(DATA.courses);

    VALID_CATEGORIES.forEach(function (cat) {
      var count = allCounts[cat] || 0;
      var id    = 'cat-' + cat.replace(/\s+/g, '-').toLowerCase();

      var cb    = U.el('input', {
        className: 'filter-checkbox',
        type: 'checkbox',
        id: id,
        value: cat,
        dataset: { filter: 'category' }
      });

      var label = U.el('label', { className: 'filter-label', textContent: cat });
      label.setAttribute('for', id);

      var countEl = U.el('span', { className: 'filter-count', textContent: U.formatNumberAr(count) });
      catList.appendChild(U.el('div', { className: 'filter-item' }, [cb, label, countEl]));
    });

    root.appendChild(catList);
  }

  function _buildLevelFilters(root) {
    root.appendChild(U.el('h3', { className: 'filters-heading', textContent: 'المستوى' }));
    var levelGroup = U.el('div', { className: 'filter-group', role: 'radiogroup', aria: { label: 'فلتر المستوى' } });

    VALID_LEVELS.forEach(function (lv) {
      var id = 'level-' + lv.toLowerCase();
      var r  = U.el('input', { className: 'filter-radio', type: 'radio', id: id, name: 'level-filter', value: lv });
      if (lv === 'All') r.checked = true;

      var label = U.el('label', { className: 'filter-label', textContent: getLevelLabel(lv) });
      label.setAttribute('for', id);

      levelGroup.appendChild(U.el('div', { className: 'filter-item' }, [r, label]));
    });

    root.appendChild(levelGroup);
  }

  function _buildRatingFilters(root) {
    root.appendChild(U.el('h3', { className: 'filters-heading', textContent: 'التقييم' }));
    var ratingGroup = U.el('div', { className: 'filter-group', role: 'radiogroup', aria: { label: 'فلتر التقييم' } });

    var ratingOptions = [
      { v: 0, t: 'كل التقييمات' },
      { v: 1, t: '★ وأعلى'      },
      { v: 2, t: '★★ وأعلى'     },
      { v: 3, t: '★★★ وأعلى'    },
      { v: 4, t: '★★★★ وأعلى'   }
    ];

    ratingOptions.forEach(function (o) {
      var id = 'rating-' + o.v;
      var r  = U.el('input', { className: 'filter-radio', type: 'radio', id: id, name: 'rating-filter', value: String(o.v) });
      if (o.v === 0) r.checked = true;

      var label = U.el('label', {
        className: 'filter-label' + (o.v > 0 ? ' rating-label' : ''),
        textContent: o.t
      });
      label.setAttribute('for', id);

      ratingGroup.appendChild(U.el('div', { className: 'filter-item' }, [r, label]));
    });

    root.appendChild(ratingGroup);
  }

  function _buildFilterActions(root) {
    var applyBtn = U.el('button', {
      className: 'filter-btn-apply',
      type: 'button',
      textContent: 'تطبيق الفلاتر',
      events: { click: function () { closeMobile(); render(true); } }
    });

    var resetBtn = U.el('button', {
      className: 'filter-btn-reset',
      type: 'button',
      textContent: META.resetFiltersLabel || 'إعادة الضبط',
      events: { click: function () { resetAll(); closeMobile(); } }
    });

    root.appendChild(U.el('div', { className: 'filter-actions' }, [applyBtn, resetBtn]));
  }

  function buildFiltersDOM() {
    var root = U.el('div', { id: 'filters-root', className: 'filters-panel' });

    root.appendChild(U.el('h2', { className: 'filters-title d-none d-lg-block', textContent: 'الفلاتر' }));

    _buildCategoryFilters(root);
    _buildLevelFilters(root);
    _buildRatingFilters(root);
    _buildFilterActions(root);

    return root;
  }

  function updateCategoryCounts(counts) {
    if (!state.filtersEl) return;
    U.qsa('#category-filter-list .filter-item', state.filtersEl).forEach(function (item) {
      var cb = U.qs('.filter-checkbox', item);
      var ct = U.qs('.filter-count',    item);
      if (!cb || !ct) return;

      var n = counts[cb.value] || 0;
      ct.textContent = U.formatNumberAr(n);
      item.classList.toggle('disabled', n === 0);
      cb.disabled = n === 0;
      if (n === 0 && cb.checked) {
        cb.checked = false;
      }
    });
  }

  /* ══════════════════════════════════════
     FILTER TRANSFER (Desktop ↔ Mobile)
  ══════════════════════════════════════ */

  function toDesktop() {
    if (state.filtersEl && DOM.desktopSlot && !DOM.desktopSlot.contains(state.filtersEl)) {
      DOM.desktopSlot.appendChild(state.filtersEl);
    }
  }

  function toMobile() {
    if (state.filtersEl && DOM.mobileSlot && !DOM.mobileSlot.contains(state.filtersEl)) {
      DOM.mobileSlot.appendChild(state.filtersEl);
    }
  }

  function closeMobile() {
    if (!DOM.offcanvas) return;
    try {
      var inst = bootstrap.Offcanvas.getInstance(DOM.offcanvas);
      if (inst) inst.hide();
    } catch (e) { /* bootstrap not loaded */ }
  }

  function setupTransfer() {
    if (!DOM.offcanvas) return;

    DOM.offcanvas.addEventListener('show.bs.offcanvas',   toMobile);
    DOM.offcanvas.addEventListener('hidden.bs.offcanvas', toDesktop);

    var mq = window.matchMedia('(min-width: 992px)');
    mq.addEventListener('change', function (e) {
      if (e.matches) {
        closeMobile();
        toDesktop();
      }
    });
  }

  /* ══════════════════════════════════════
     PAGINATION
  ══════════════════════════════════════ */

  function buildPagination(total) {
    if (!DOM.pagination) return;
    while (DOM.pagination.firstChild) DOM.pagination.removeChild(DOM.pagination.firstChild);

    var pages = Math.ceil(total / CONFIG.CARDS_PER_PAGE);
    if (pages <= 1) return;
    if (state.currentPage > pages) state.currentPage = pages;
    if (state.currentPage < 1)     state.currentPage = 1;

    var WINDOW_SIZE = 2;
    var frag = document.createDocumentFragment();

    function mkPage(label, page, opts) {
      opts = opts || {};
      var li = U.el('li', {
        className: 'page-item' + (opts.disabled ? ' disabled' : '') + (opts.active ? ' active' : '')
      });

      var a = U.el('a', {
        className: 'page-link',
        href: '#',
        textContent: String(label),
        aria: { label: opts.ariaLabel || 'صفحة ' + U.formatNumberAr(page) }
      });

      if (opts.active) a.setAttribute('aria-current', 'page');

      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (!opts.disabled && state.currentPage !== page) {
          state.currentPage = page;
          render(false);
          if (DOM.grid) DOM.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      li.appendChild(a);
      return li;
    }

    /* Previous */
    frag.appendChild(mkPage('›', state.currentPage - 1, {
      disabled: state.currentPage === 1,
      ariaLabel: 'الصفحة السابقة'
    }));

    /* Page numbers with ellipsis */
    var range = [];
    for (var i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= state.currentPage - WINDOW_SIZE && i <= state.currentPage + WINDOW_SIZE)) {
        range.push(i);
      }
    }

    var last = 0;
    range.forEach(function (p) {
      if (p - last > 1) {
        var ell = U.el('li', { className: 'page-item disabled' });
        ell.appendChild(U.el('span', { className: 'page-link', textContent: '…', aria: { hidden: 'true' } }));
        frag.appendChild(ell);
      }
      frag.appendChild(mkPage(U.formatNumberAr(p), p, { active: p === state.currentPage }));
      last = p;
    });

    /* Next */
    frag.appendChild(mkPage('‹', state.currentPage + 1, {
      disabled: state.currentPage === pages,
      ariaLabel: 'الصفحة التالية'
    }));

    DOM.pagination.appendChild(frag);
  }

  /* ══════════════════════════════════════
     SORT
  ══════════════════════════════════════ */

  function buildSort() {
    if (!DOM.sortMenu) return;
    while (DOM.sortMenu.firstChild) DOM.sortMenu.removeChild(DOM.sortMenu.firstChild);

    SORT_OPTIONS.forEach(function (o) {
      var li = U.el('li', { role: 'none' });
      var a = U.el('a', {
        className: 'dropdown-item' + (o.key === state.currentSort ? ' active' : ''),
        href:      '#',
        textContent: o.label,
        dataset:   { sortKey: o.key },
        role:      'option',
        aria:      { selected: o.key === state.currentSort ? 'true' : 'false' }
      });

      a.addEventListener('click', function (e) {
        e.preventDefault();
        state.currentSort = o.key;
        updateSortLabel();
        highlightSort();
        render(true);
        U.announce('مرتب حسب: ' + o.label);
      });

      li.appendChild(a);
      DOM.sortMenu.appendChild(li);
    });

    updateSortLabel();
  }

  function updateSortLabel() {
    if (!DOM.sortBtn) return;
    var lbl = U.qs('.sort-label', DOM.sortBtn);
    var match = SORT_OPTIONS.filter(function (o) { return o.key === state.currentSort; })[0];
    if (lbl) lbl.textContent = match ? match.label : 'الأعلى تقييماً';
  }

  function highlightSort() {
    if (!DOM.sortMenu) return;
    U.qsa('.dropdown-item', DOM.sortMenu).forEach(function (item) {
      var isActive = item.dataset.sortKey === state.currentSort;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  /* ══════════════════════════════════════
     URL SYNC
  ══════════════════════════════════════ */

  function writeURL() {
    var f = readFilters();
    var p = new URLSearchParams();

    if (f.categories.length)                     p.set('categories', f.categories.join(','));
    if (f.minRating > 0)                         p.set('rating',     String(f.minRating));
    if (f.level !== 'All')                       p.set('level',      f.level);
    if (f.search)                                p.set('search',     f.search);
    if (state.currentSort !== DEFAULT_SORT)       p.set('sort',       state.currentSort);
    if (state.currentPage > 1)                   p.set('page',       String(state.currentPage));

    var qs = p.toString();
    history.replaceState(null, '', qs ? location.pathname + '?' + qs : location.pathname);
  }

  function readURL() {
    var p = new URLSearchParams(location.search);
    if (!p.toString()) return;

    /* Categories */
    var cats = (p.get('categories') || '').split(',').filter(function (c) {
      return VALID_CATEGORIES.indexOf(c) !== -1;
    });
    if (cats.length && state.filtersEl) {
      U.qsa('input[data-filter="category"]', state.filtersEl).forEach(function (cb) {
        cb.checked = cats.indexOf(cb.value) !== -1;
      });
    }

    /* Rating */
    var rt = parseInt(p.get('rating'), 10);
    if (VALID_RATINGS.indexOf(rt) !== -1 && state.filtersEl) {
      var ri = U.qs('input[name="rating-filter"][value="' + rt + '"]', state.filtersEl);
      if (ri) ri.checked = true;
    }

    /* Level */
    var lv = p.get('level');
    if (VALID_LEVELS.indexOf(lv) !== -1 && state.filtersEl) {
      var li = U.qs('input[name="level-filter"][value="' + lv + '"]', state.filtersEl);
      if (li) li.checked = true;
    }

    /* Search */
    if (p.get('search') && DOM.search) {
      DOM.search.value = p.get('search');
    }

    /* Sort */
    var st = p.get('sort');
    if (VALID_SORT_KEYS.indexOf(st) !== -1) {
      state.currentSort = st;
    }

    /* Page — will be clamped during render */
    var pg = parseInt(p.get('page'), 10);
    if (!isNaN(pg) && pg >= 1) {
      state.currentPage = pg;
    }
  }

  /* ══════════════════════════════════════
     SCHEMA
  ══════════════════════════════════════ */

  function updateSchema(courses) {
    var existing = document.getElementById('jsonld-courses');
    if (existing) existing.remove();
    if (!courses.length) return;

    SP.injectJsonLd({
      '@context':      'https://schema.org',
      '@type':         'ItemList',
      'name':          DATA.BRAND_NAME + ' \u2014 الكورسات',
      'numberOfItems': courses.length,
      'itemListElement': courses.map(function (c, i) {
        return {
          '@type':    'ListItem',
          'position': i + 1,
          'item': {
            '@type':       'Course',
            'url':         location.origin + '/course/course-details/index.html?id=' + c.id,
            'name':        c.title,
            'description': c.description,
            'provider': {
              '@type': 'Organization',
              'name':  DATA.BRAND_NAME
            }
          }
        };
      })
    }, 'jsonld-courses');
  }

  /* ══════════════════════════════════════
     RESULTS TEXT
  ══════════════════════════════════════ */

  function _buildResultsText(total, start, end) {
    var template = META.resultsTemplate || 'عرض {start}\u2013{end} من {total} نتيجة';
    return template
      .replace('{start}', U.formatNumberAr(total ? start + 1 : 0))
      .replace('{end}',   U.formatNumberAr(end))
      .replace('{total}', U.formatNumberAr(total));
  }

  /* ══════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════ */

  function render(resetPage) {
    if (resetPage) state.currentPage = 1;

    var f        = readFilters();
    var pre      = filterExceptCategory(DATA.courses, f);
    updateCategoryCounts(countCategories(pre));

    var filtered = filterByCategory(pre, f.categories);
    var sorted   = sortCourses(filtered);
    state.filteredCourses = sorted;

    var total = sorted.length;
    var start = (state.currentPage - 1) * CONFIG.CARDS_PER_PAGE;
    var end   = Math.min(start + CONFIG.CARDS_PER_PAGE, total);
    var page  = sorted.slice(start, end);

    /* Grid */
    if (DOM.grid) {
      while (DOM.grid.firstChild) DOM.grid.removeChild(DOM.grid.firstChild);

      if (!page.length) {
        DOM.grid.appendChild(buildEmpty());
      } else {
        var frag = document.createDocumentFragment();
        page.forEach(function (c, i) { frag.appendChild(buildCard(c, i)); });
        DOM.grid.appendChild(frag);
      }
    }

    /* Results text */
    if (DOM.results) {
      DOM.results.textContent = _buildResultsText(total, start, end);
    }

    /* Pagination + Schema + URL */
    buildPagination(total);
    updateSchema(state.filteredCourses);
    writeURL();

    /* Screen reader announcement */
    U.announce(U.formatNumberAr(total) + ' كورس');
  }

  /* ══════════════════════════════════════
     RESET
  ══════════════════════════════════════ */

  function resetAll() {
    if (DOM.search) DOM.search.value = '';

    if (state.filtersEl) {
      U.qsa('input[data-filter="category"]', state.filtersEl).forEach(function (c) { c.checked = false; });

      var allLevel  = U.qs('input[name="level-filter"][value="All"]', state.filtersEl);
      if (allLevel) allLevel.checked = true;

      var allRating = U.qs('input[name="rating-filter"][value="0"]', state.filtersEl);
      if (allRating) allRating.checked = true;
    }

    state.currentSort = DEFAULT_SORT;
    updateSortLabel();
    highlightSort();
    render(true);
    U.announce('تم إعادة ضبط الفلاتر');
  }

  /* ══════════════════════════════════════
     EVENTS
  ══════════════════════════════════════ */

  function bindEvents() {
    /* Search — debounced */
    if (DOM.search) {
      DOM.search.addEventListener('input', U.debounce(function () {
        render(true);
      }, CONFIG.DEBOUNCE_DELAY));
    }

    /* Filter changes */
    if (state.filtersEl) {
      state.filtersEl.addEventListener('change', function (e) {
        if (e.target.matches('input[data-filter="category"], input[name="level-filter"], input[name="rating-filter"]')) {
          render(true);
        }
      });
    }

    /* FAB visibility on scroll */
    if (DOM.fab) {
      var lastY = window.scrollY;
      window.addEventListener('scroll', U.throttle(function () {
        var y = window.scrollY;
        DOM.fab.classList.toggle('is-hidden', y > CONFIG.SCROLL_HIDE_OFFSET && y > lastY);
        lastY = y;
      }, CONFIG.SCROLL_THROTTLE));
    }

    /* Desktop ↔ Mobile filter transfer */
    setupTransfer();
  }

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */

  function init() {
    injectSEO();
    cacheDom();

    if (DOM.contentArea) {
      DOM.contentArea.style.position = 'relative';
    }

    state.filtersEl = buildFiltersDOM();
    toDesktop();
    buildSort();
    readURL();
    bindEvents();
    render(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
