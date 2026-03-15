'use strict';

(function () {

  var U = window.Utils;
  var DATA = window.COURSE_DATA;
  if (!U || !DATA) { console.error('courses-app: dependencies missing.'); return; }

  var CONFIG = Object.freeze({ CARDS_PER_PAGE: 6, DEBOUNCE_DELAY: 300, SCROLL_THROTTLE: 150 });

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

  /* Level display names for Arabic UI */
  var LEVEL_LABELS = {
    'All':          'كل المستويات',
    'Beginner':     'مبتدئ',
    'Intermediate': 'متوسط',
    'Advanced':     'متقدم'
  };

  var state = { currentPage: 1, currentSort: 'average ratings', filteredCourses: [], filtersEl: null };
  var DOM = {};

  // ── SEO Injection ──

  function injectSEO() {
    var brand    = DATA.BRAND_NAME;
    var domain   = DATA.DOMAIN;
    var meta     = DATA.META;
    var base     = 'https://' + domain;
    var pageUrl  = base + '/course/';
    var pageTitle = brand + ' \u2014 تصفح الكورسات';
    var pageDesc  = meta.descriptionShort;
    var pageImage = base + meta.ogImage;

    document.title = pageTitle;

    var descEl = document.getElementById('page-desc');
    if (descEl) descEl.setAttribute('content', pageDesc);

    var canonEl = document.getElementById('page-canonical');
    if (canonEl) canonEl.setAttribute('href', pageUrl);

    var ogMap = {
      'og-url':       pageUrl,
      'og-title':     pageTitle,
      'og-desc':      pageDesc,
      'og-image':     pageImage,
      'og-site-name': brand
    };
    Object.keys(ogMap).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.setAttribute('content', ogMap[id]);
    });

    var twMap = {
      'tw-title': pageTitle,
      'tw-desc':  pageDesc,
      'tw-image': pageImage
    };
    Object.keys(twMap).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.setAttribute('content', twMap[id]);
    });

    var hreflang = document.getElementById('hreflang-ar') || document.getElementById('hreflang-en');
    if (hreflang) hreflang.setAttribute('href', pageUrl);

    var navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(function (link) {
      if (link.getAttribute('href') &&
          link.getAttribute('href').indexOf('/course/') !== -1 &&
          link.getAttribute('href').indexOf('course-details') === -1) {
        link.setAttribute('aria-current', 'page');
      }
    });

    var schema = {
      '@context':   'https://schema.org',
      '@type':      'CollectionPage',
      'name':       pageTitle,
      'description': pageDesc,
      'url':        pageUrl,
      'publisher': {
        '@type': 'Organization',
        'name':  brand,
        'url':   base
      },
      'inLanguage': 'ar'
    };

    var script       = document.createElement('script');
    script.type      = 'application/ld+json';
    script.id        = 'jsonld-collection';
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  }

  // ── DOM Cache ──

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

  // ── Filters Engine ──

  function readFilters() {
    if (!state.filtersEl) return { categories: [], level: 'All', minRating: 0, search: '' };
    var cats = U.qsa('input[data-filter="category"]:checked', state.filtersEl).map(function (e) { return e.value; });
    var lv   = (U.qs('input[name="level-filter"]:checked', state.filtersEl) || {}).value || 'All';
    var rt   = parseInt((U.qs('input[name="rating-filter"]:checked', state.filtersEl) || {}).value || '0', 10);
    var s    = DOM.search ? DOM.search.value.toLowerCase().trim() : '';
    return { categories: cats, level: lv, minRating: rt, search: s };
  }

  function filterExceptCategory(courses, f) {
    return courses.filter(function (c) {
      if (c.rating < f.minRating) return false;
      if (f.level && f.level !== 'All' && c.level !== f.level) return false;
      if (f.search) {
        var s = f.search;
        if (c.title.toLowerCase().indexOf(s) === -1 &&
          !(Array.isArray(c.tags) && c.tags.some(function (t) { return t.toLowerCase().indexOf(s) !== -1; })) &&
          !(c.description && c.description.toLowerCase().indexOf(s) !== -1) &&
          !(c.instructor && c.instructor.toLowerCase().indexOf(s) !== -1)) return false;
      }
      return true;
    });
  }

  function filterByCategory(courses, cats) {
    return (!cats || !cats.length) ? courses : courses.filter(function (c) { return cats.indexOf(c.category) !== -1; });
  }

  function countCategories(courses) {
    var m = {};
    courses.forEach(function (c) { m[c.category] = (m[c.category] || 0) + 1; });
    return m;
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

  // ── Card Builder ──

  function buildCard(course, idx) {
    var price = course.price === 0 ? 'مجاني' : U.formatNumberAr(course.price) + ' ج.م';
    var href  = './course-details/index.html?id=' + course.id;

    var img = U.el('img', {
      className: 'card-img-top course-card-img',
      src:       '../assets/img/' + course.image,
      alt:       course.title,
      loading:   idx < 3 ? 'eager' : 'lazy',
      decoding:  'async'
    });

    var badgeColor = (DATA.categories[course.category] || {}).color || 'emerald';
    var badge = U.el('span', { className: 'course-badge course-badge--' + badgeColor, textContent: course.category });
    var imgWrap = U.el('div',  { className: 'course-card-visual' }, [img, badge]);

    var titleEl = U.el('h3', { className: 'course-card-title', textContent: course.title });
    var descAttrs = { className: 'course-card-desc', textContent: course.description };
    if (course.language === 'ar') { descAttrs.dir = 'rtl'; descAttrs.lang = 'ar'; descAttrs.style = { textAlign: 'right' }; }
    var desc = U.el('p', descAttrs);
    var instructor = U.el('span', { className: 'course-card-instructor' }, [
      U.el('i', { className: 'bi bi-person-fill ms-1', aria: { hidden: 'true' } }),
      course.instructor
    ]);

    var statsRow = U.el('div', { className: 'course-card-stats' }, [
      U.el('span', null, [U.el('i', { className: 'bi bi-people-fill ms-1', aria: { hidden: 'true' } }), U.formatNumberAr(course.students)]),
      U.el('span', null, [U.el('i', { className: 'bi bi-book-fill ms-1',   aria: { hidden: 'true' } }), U.formatNumberAr(course.lessons) + ' درس']),
      U.el('span', null, [U.el('i', { className: 'bi bi-star-fill ms-1',   aria: { hidden: 'true' } }), U.formatNumberAr(course.rating)])
    ]);

    var priceEl = U.el('span', {
      className:   'course-card-price' + (course.price === 0 ? ' free' : ''),
      textContent: price
    });
    var btn    = U.el('a',   { className: 'course-card-btn', href: href, textContent: 'عرض الكورس' });
    var footer = U.el('div', { className: 'course-card-footer' }, [priceEl, btn]);

    var body = U.el('div', { className: 'course-card-body' }, [titleEl, desc, instructor, statsRow, footer]);

    var card = U.el('div', {
      className: 'course-card',
      style:     { animationDelay: (idx * 0.08) + 's' },
      dataset:   { category: course.category, level: course.level, rating: String(course.rating) }
    }, [imgWrap, body]);

    return U.el('div', { className: 'col-12 col-md-6 col-xl-4 mb-4' }, [card]);
  }

  function buildEmpty() {
    return U.el('div', { className: 'col-12 text-center py-5' }, [
      U.el('i',      { className: 'bi bi-search empty-icon', aria: { hidden: 'true' } }),
      U.el('h3',     { className: 'empty-title', textContent: 'مفيش كورسات' }),
      U.el('p',      { className: 'empty-text',  textContent: 'جرّب تغيّر الفلاتر أو كلمة البحث' }),
      U.el('button', { className: 'btn-reset', type: 'button', textContent: 'إعادة ضبط الفلاتر', events: { click: resetAll } })
    ]);
  }

  // ── Filter UI Builder ──

  function buildFiltersDOM() {
    var root = U.el('div', { id: 'filters-root', className: 'filters-panel' });

    root.appendChild(U.el('h2', { className: 'filters-title d-none d-lg-block', textContent: 'الفلاتر' }));

    root.appendChild(U.el('h3', { className: 'filters-heading', textContent: 'الفصول' }));
    var catList   = U.el('div', { className: 'filter-group', id: 'category-filter-list' });
    var allCounts = countCategories(DATA.courses);

    VALID_CATEGORIES.forEach(function (cat) {
      var count = allCounts[cat] || 0;
      var id    = 'cat-' + cat.replace(/\s+/g, '-').toLowerCase();
      var cb    = U.el('input', { className: 'filter-checkbox', type: 'checkbox', id: id, value: cat, dataset: { filter: 'category' } });
      var label = U.el('label', { className: 'filter-label', textContent: cat });
      label.setAttribute('for', id);
      var countEl = U.el('span', { className: 'filter-count', textContent: U.formatNumberAr(count) });
      catList.appendChild(U.el('div', { className: 'filter-item' }, [cb, label, countEl]));
    });
    root.appendChild(catList);

    root.appendChild(U.el('h3', { className: 'filters-heading', textContent: 'المستوى' }));
    var levelGroup = U.el('div', { className: 'filter-group' });
    VALID_LEVELS.forEach(function (lv) {
      var id    = 'level-' + lv.toLowerCase();
      var r     = U.el('input', { className: 'filter-radio', type: 'radio', id: id, name: 'level-filter', value: lv });
      if (lv === 'All') r.checked = true;
      var label = U.el('label', { className: 'filter-label', textContent: LEVEL_LABELS[lv] || lv });
      label.setAttribute('for', id);
      levelGroup.appendChild(U.el('div', { className: 'filter-item' }, [r, label]));
    });
    root.appendChild(levelGroup);

    root.appendChild(U.el('h3', { className: 'filters-heading', textContent: 'التقييم' }));
    var ratingGroup = U.el('div', { className: 'filter-group' });
    [
      { v: 0, t: 'كل التقييمات' },
      { v: 1, t: '★ وأعلى'      },
      { v: 2, t: '★★ وأعلى'     },
      { v: 3, t: '★★★ وأعلى'    },
      { v: 4, t: '★★★★ وأعلى'   }
    ].forEach(function (o) {
      var id    = 'rating-' + o.v;
      var r     = U.el('input', { className: 'filter-radio', type: 'radio', id: id, name: 'rating-filter', value: String(o.v) });
      if (o.v === 0) r.checked = true;
      var label = U.el('label', { className: 'filter-label' + (o.v > 0 ? ' rating-label' : ''), textContent: o.t });
      label.setAttribute('for', id);
      ratingGroup.appendChild(U.el('div', { className: 'filter-item' }, [r, label]));
    });
    root.appendChild(ratingGroup);

    var applyBtn = U.el('button', {
      className: 'filter-btn-apply', type: 'button', textContent: 'تطبيق الفلاتر',
      events: { click: function () { closeMobile(); render(true); } }
    });
    var resetBtn = U.el('button', {
      className: 'filter-btn-reset', type: 'button', textContent: 'إعادة الضبط',
      events: { click: function () { resetAll(); closeMobile(); } }
    });
    root.appendChild(U.el('div', { className: 'filter-actions' }, [applyBtn, resetBtn]));

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

  // ── Filter Transfer ──

  function toDesktop() { if (state.filtersEl && DOM.desktopSlot && !DOM.desktopSlot.contains(state.filtersEl)) DOM.desktopSlot.appendChild(state.filtersEl); }
  function toMobile()  { if (state.filtersEl && DOM.mobileSlot  && !DOM.mobileSlot.contains(state.filtersEl))  DOM.mobileSlot.appendChild(state.filtersEl);  }
  function closeMobile() {
    if (!DOM.offcanvas) return;
    try { var i = bootstrap.Offcanvas.getInstance(DOM.offcanvas); if (i) i.hide(); } catch (e) {}
  }

  function setupTransfer() {
    if (!DOM.offcanvas) return;
    DOM.offcanvas.addEventListener('show.bs.offcanvas',   toMobile);
    DOM.offcanvas.addEventListener('hidden.bs.offcanvas', toDesktop);
    var mq = window.matchMedia('(min-width: 992px)');
    mq.addEventListener('change', function (e) { if (e.matches) { closeMobile(); toDesktop(); } });
  }

  // ── Pagination ──

  function buildPagination(total) {
    if (!DOM.pagination) return;
    while (DOM.pagination.firstChild) DOM.pagination.removeChild(DOM.pagination.firstChild);
    var pages = Math.ceil(total / CONFIG.CARDS_PER_PAGE);
    if (pages <= 1) return;
    if (state.currentPage > pages) state.currentPage = pages;
    if (state.currentPage < 1)     state.currentPage = 1;

    var frag = document.createDocumentFragment();

    function mkPage(label, page, opts) {
      opts = opts || {};
      var li = U.el('li', { className: 'page-item' + (opts.disabled ? ' disabled' : '') + (opts.active ? ' active' : '') });
      var a  = U.el('a',  { className: 'page-link', href: '#', textContent: String(label), aria: { label: opts.ariaLabel || 'صفحة ' + U.formatNumberAr(page) } });
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

    frag.appendChild(mkPage('›', state.currentPage - 1, { disabled: state.currentPage === 1, ariaLabel: 'الصفحة السابقة' }));
    var d = 2, range = [];
    for (var i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= state.currentPage - d && i <= state.currentPage + d)) range.push(i);
    }
    var last = 0;
    range.forEach(function (p) {
      if (p - last > 1) {
        var ell = U.el('li', { className: 'page-item disabled' });
        ell.appendChild(U.el('span', { className: 'page-link', textContent: '…' }));
        frag.appendChild(ell);
      }
      frag.appendChild(mkPage(U.formatNumberAr(p), p, { active: p === state.currentPage }));
      last = p;
    });
    frag.appendChild(mkPage('‹', state.currentPage + 1, { disabled: state.currentPage === pages, ariaLabel: 'الصفحة التالية' }));
    DOM.pagination.appendChild(frag);
  }

  // ── Sort ──

  function buildSort() {
    if (!DOM.sortMenu) return;
    while (DOM.sortMenu.firstChild) DOM.sortMenu.removeChild(DOM.sortMenu.firstChild);
    SORT_OPTIONS.forEach(function (o) {
      var a = U.el('a', {
        className: 'dropdown-item' + (o.key === state.currentSort ? ' active' : ''),
        href:      '#',
        textContent: o.label,
        dataset:   { sortKey: o.key }
      });
      a.addEventListener('click', function (e) {
        e.preventDefault();
        state.currentSort = o.key;
        updateSortLabel();
        highlightSort();
        render(true);
      });
      DOM.sortMenu.appendChild(U.el('li', null, [a]));
    });
    updateSortLabel();
  }

  function updateSortLabel() {
    if (!DOM.sortBtn) return;
    var lbl = U.qs('.sort-label', DOM.sortBtn);
    var m   = SORT_OPTIONS.filter(function (o) { return o.key === state.currentSort; })[0];
    if (lbl) lbl.textContent = m ? m.label : 'الأعلى تقييماً';
  }

  function highlightSort() {
    if (!DOM.sortMenu) return;
    U.qsa('.dropdown-item', DOM.sortMenu).forEach(function (i) {
      i.classList.toggle('active', i.dataset.sortKey === state.currentSort);
    });
  }

  // ── URL ──

  function writeURL() {
    var f = readFilters(), p = new URLSearchParams();
    if (f.categories.length)          p.set('categories', f.categories.join(','));
    if (f.minRating > 0)              p.set('rating',     String(f.minRating));
    if (f.level !== 'All')            p.set('level',      f.level);
    if (f.search)                     p.set('search',     f.search);
    if (state.currentSort !== 'average ratings') p.set('sort', state.currentSort);
    if (state.currentPage > 1)        p.set('page',       String(state.currentPage));
    history.replaceState(null, '', p.toString() ? location.pathname + '?' + p : location.pathname);
  }

  function readURL() {
    var p = new URLSearchParams(location.search);
    if (!p.toString()) return;
    var cats = (p.get('categories') || '').split(',').filter(function (c) { return VALID_CATEGORIES.indexOf(c) !== -1; });
    if (cats.length && state.filtersEl) {
      U.qsa('input[data-filter="category"]', state.filtersEl).forEach(function (cb) { cb.checked = cats.indexOf(cb.value) !== -1; });
    }
    var rt = parseInt(p.get('rating'), 10);
    if (VALID_RATINGS.indexOf(rt) !== -1 && state.filtersEl) {
      var ri = U.qs('input[name="rating-filter"][value="' + rt + '"]', state.filtersEl);
      if (ri) ri.checked = true;
    }
    var lv = p.get('level');
    if (VALID_LEVELS.indexOf(lv) !== -1 && state.filtersEl) {
      var li = U.qs('input[name="level-filter"][value="' + lv + '"]', state.filtersEl);
      if (li) li.checked = true;
    }
    if (p.get('search') && DOM.search) DOM.search.value = p.get('search');
    var st = p.get('sort');
    if (VALID_SORT_KEYS.indexOf(st) !== -1) state.currentSort = st;
    var pg = parseInt(p.get('page'), 10);
    if (!isNaN(pg) && pg >= 1) state.currentPage = pg;
  }

  // ── Schema ──

  function updateSchema(courses) {
    var el = document.getElementById('jsonld-courses');
    if (el) el.remove();
    if (!courses.length) return;
    var schema = {
      '@context':    'https://schema.org',
      '@type':       'ItemList',
      'name':        DATA.BRAND_NAME + ' \u2014 الكورسات',
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
    };
    var s       = document.createElement('script');
    s.type      = 'application/ld+json';
    s.id        = 'jsonld-courses';
    s.textContent = JSON.stringify(schema);
    document.head.appendChild(s);
  }

  // ── Main Render ──

  function render(resetPage) {
    if (resetPage) state.currentPage = 1;
    var f        = readFilters();
    var pre      = filterExceptCategory(DATA.courses, f);
    updateCategoryCounts(countCategories(pre));
    var filtered = filterByCategory(pre, f.categories);
    var sorted   = sortCourses(filtered);
    state.filteredCourses = sorted;
    var total = sorted.length,
        start = (state.currentPage - 1) * CONFIG.CARDS_PER_PAGE,
        end   = Math.min(start + CONFIG.CARDS_PER_PAGE, total);
    var page = sorted.slice(start, end);

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
    if (DOM.results) {
      DOM.results.textContent = 'عرض ' + U.formatNumberAr(total ? start + 1 : 0) + '\u2013' + U.formatNumberAr(end) + ' من ' + U.formatNumberAr(total) + ' نتيجة';
    }
    buildPagination(total);
    updateSchema(state.filteredCourses);
    writeURL();
    U.announce(U.formatNumberAr(total) + ' كورس');
  }

  // ── Reset ──

  function resetAll() {
    if (DOM.search) DOM.search.value = '';
    if (state.filtersEl) {
      U.qsa('input[data-filter="category"]', state.filtersEl).forEach(function (c) { c.checked = false; });
      var al = U.qs('input[name="level-filter"][value="All"]', state.filtersEl); if (al) al.checked = true;
      var ar = U.qs('input[name="rating-filter"][value="0"]',  state.filtersEl); if (ar) ar.checked = true;
    }
    state.currentSort = 'average ratings';
    updateSortLabel();
    highlightSort();
    render(true);
  }

  // ── Events ──

  function bindEvents() {
    if (DOM.search) {
      DOM.search.addEventListener('input', U.debounce(function () { render(true); }, CONFIG.DEBOUNCE_DELAY));
    }
    if (state.filtersEl) {
      state.filtersEl.addEventListener('change', function (e) {
        if (e.target.matches('input[data-filter="category"], input[name="level-filter"], input[name="rating-filter"]')) render(true);
      });
    }
    if (DOM.fab) {
      var lastY = window.scrollY;
      window.addEventListener('scroll', U.throttle(function () {
        var y = window.scrollY;
        DOM.fab.classList.toggle('is-hidden', y > 100 && y > lastY);
        lastY = y;
      }, CONFIG.SCROLL_THROTTLE));
    }
    setupTransfer();
  }

  // ── Init ──

  function init() {
    injectSEO();
    cacheDom();
    if (DOM.contentArea) DOM.contentArea.style.position = 'relative';
    state.filtersEl = buildFiltersDOM();
    toDesktop();
    buildSort();
    readURL();
    bindEvents();
    render(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
