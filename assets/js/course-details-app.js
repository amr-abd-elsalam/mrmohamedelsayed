'use strict';

(function () {

  var U    = window.Utils;
  var DATA = window.COURSE_DATA;

  if (!U || !DATA) {
    console.error('course-details-app: Utils or COURSE_DATA missing.');
    return;
  }

  var RS = window.RatingSystem || null;

  /* ── Constants ── */

  var BRAND_NAME = DATA.BRAND_NAME || 'Ai8V';
  var DOMAIN     = DATA.DOMAIN     || 'ai8v.com';

  /* ── Chat Config (white-label via COURSE_DATA.META) ── */

  var CHAT_CONFIG = {
    botName:        (DATA.META && DATA.META.chatBotName)        || '\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0643\u0648\u0631\u0633',
    welcomeMessage: (DATA.META && DATA.META.chatWelcomeMessage) || '\u0645\u0631\u062D\u0628\u0627\u064B! \u0623\u0646\u0627 \u0647\u0646\u0627 \u0639\u0634\u0627\u0646 \u0623\u0633\u0627\u0639\u062F\u0643 \u0628\u0623\u064A \u0633\u0624\u0627\u0644 \u0639\u0646 \u0627\u0644\u0643\u0648\u0631\u0633. \u0627\u0633\u0623\u0644\u0646\u064A \u0623\u064A \u062D\u0627\u062C\u0629!',
    placeholder:    (DATA.META && DATA.META.chatPlaceholder)    || '\u0627\u0643\u062A\u0628 \u0633\u0624\u0627\u0644\u0643 \u0647\u0646\u0627...',
    errorMessage:   (DATA.META && DATA.META.chatErrorMessage)   || '\u062D\u0635\u0644 \u0645\u0634\u0643\u0644\u0629 \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644. \u062C\u0631\u0651\u0628 \u062A\u0627\u0646\u064A.',
    maxMessageLen:  500,
    maxHistory:     20,
    storagePrefix:  'ai8v_chat_'
  };

  /* ── Chat State ── */

  var chatState = {
    isOpen:  false,
    sending: false
  };

  /* ── Course Lookup ── */

  /**
   * Reads the course ID from the URL query string (?id=N).
   * Validates: not empty, digits only, value >= 1.
   *
   * @returns {number|null} the course ID or null if invalid
   */
  function getCourseIdFromURL() {
    var params  = new URLSearchParams(window.location.search);
    var raw     = params.get('id');
    if (!raw) return null;
    var trimmed = raw.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    var id = parseInt(trimmed, 10);
    return id >= 1 ? id : null;
  }

  /**
   * Finds a course object by its numeric ID.
   *
   * @param {number} id — the course ID to find
   * @returns {Object|null} the course object or null
   */
  function findCourse(id) {
    for (var i = 0; i < DATA.courses.length; i++) {
      if (DATA.courses[i].id === id) return DATA.courses[i];
    }
    return null;
  }

  /* ── SEO Injection ── */

  /**
   * Injects all SEO metadata for the course: title, meta tags,
   * canonical, OG, Twitter Card, hreflang, and Course JSON-LD.
   * The Course schema does NOT include aggregateRating initially —
   * it is added asynchronously by addRatingToSchema().
   *
   * @param {Object} course — the course data object
   */
  function injectSEO(course) {
    var brand    = DATA.BRAND_NAME;
    var domain   = DATA.DOMAIN;
    var meta     = DATA.META;
    var base     = 'https://' + domain;
    var pageUrl  = base + '/course/course-details/?id=' + course.id;
    var pageTitle = course.title + ' \u2014 ' + brand;
    var pageDesc  = course.description + ' ' + meta.descriptionShort;
    var pageImage = base + '/assets/img/' + course.image;

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

    var hreflang = document.getElementById('hreflang-en');
    if (hreflang) hreflang.setAttribute('href', pageUrl);

    var schema = {
      '@context': 'https://schema.org',
      '@type':    'Course',
      'name':     course.title,
      'description': course.description,
      'url':      pageUrl,
      'provider': {
        '@type': 'Organization',
        'name':  brand,
        'url':   base
      },
      'educationalLevel': course.level,
      'inLanguage':       course.language || 'en',
      'offers': {
        '@type':        'Offer',
        'price':        course.price,
        'priceCurrency': 'USD',
        'availability': 'https://schema.org/InStock'
      }
    };

    var script       = document.createElement('script');
    script.type      = 'application/ld+json';
    script.id        = 'jsonld-seo-course';
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  }

  /* ── noindex for missing courses ── */

  /**
   * Sets the robots meta tag to noindex/nofollow for courses
   * that do not exist.
   */
  function setNoIndex() {
    var el = document.querySelector('meta[name="robots"]');
    if (el) {
      el.setAttribute('content', 'noindex, nofollow');
    } else {
      el = document.createElement('meta');
      el.setAttribute('name',    'robots');
      el.setAttribute('content', 'noindex, nofollow');
      document.head.appendChild(el);
    }
  }

  /* ── JSON-LD (BreadcrumbList + FAQPage) ── */

  /**
   * Injects BreadcrumbList and FAQPage JSON-LD schemas.
   * Uses canonical URLs constructed from DATA.DOMAIN.
   *
   * @param {Object} course — the course data object
   */
  function buildSchema(course) {
    var base    = 'https://' + DATA.DOMAIN;
    var pageUrl = base + '/course/course-details/?id=' + course.id;
    var schemas = [];

    schemas.push({
      '@context':   'https://schema.org',
      '@type':      'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1,
          'name': 'Home',    'item': base + '/' },
        { '@type': 'ListItem', 'position': 2,
          'name': 'Courses', 'item': base + '/course/' },
        { '@type': 'ListItem', 'position': 3,
          'name': course.title, 'item': pageUrl }
      ]
    });

    if (course.faq && course.faq.length > 0) {
      schemas.push({
        '@context':   'https://schema.org',
        '@type':      'FAQPage',
        'mainEntity': course.faq.map(function (item) {
          return {
            '@type': 'Question',
            'name':  item.question,
            'acceptedAnswer': { '@type': 'Answer', 'text': item.answer }
          };
        })
      });
    }

    schemas.forEach(function (schema, idx) {
      var el         = document.createElement('script');
      el.type        = 'application/ld+json';
      el.id          = 'jsonld-details-' + idx;
      el.textContent = JSON.stringify(schema);
      document.head.appendChild(el);
    });
  }

  /**
   * Adds aggregateRating to the existing Course JSON-LD schema.
   * Called asynchronously after live rating data arrives.
   *
   * @param {number} average — the average rating value
   * @param {number} count — the total number of ratings
   */
  function addRatingToSchema(average, count) {
    var el = document.getElementById('jsonld-seo-course');
    if (!el) return;
    try {
      var schema = JSON.parse(el.textContent);
      schema.aggregateRating = {
        '@type':       'AggregateRating',
        'ratingValue': average.toFixed(1),
        'bestRating':  '5',
        'worstRating': '1',
        'ratingCount': String(count)
      };
      el.textContent = JSON.stringify(schema);
    } catch (e) {}
  }

  /* ── WhatsApp Link ── */

  /**
   * Builds a WhatsApp purchase link for the given course.
   *
   * @param {Object} course — the course data object
   * @returns {string} the wa.me URL with pre-filled message
   */
  function buildWhatsAppLink(course) {
    var phone   = DATA.WHATSAPP_NUMBER || '';
    var price   = course.price > 0
      ? '$' + course.price.toFixed(2)
      : 'Free';
    var message = 'Hello, I want to purchase the course "' +
                  course.title + '" \u2014 Price: ' + price;
    return 'https://wa.me/' + phone +
           '?text=' + encodeURIComponent(message);
  }

  /* ── Error Page ── */

  /**
   * Renders a "Course Not Found" error page inside the container.
   *
   * @param {HTMLElement} container — the parent element (#app or body)
   */
  function renderError(container) {
    document.title = 'Course Not Found | ' + BRAND_NAME;
    setNoIndex();
    container.appendChild(
      U.el('div', { className: 'error-container' }, [
        U.el('i',  { className: 'bi bi-exclamation-triangle error-icon',
                     aria: { hidden: 'true' } }),
        U.el('h1', { className: 'error-title',
                     textContent: 'Course Not Found' }),
        U.el('p',  { className: 'error-text',
                     textContent: 'The course you are looking for does not exist.' }),
        U.el('a',  { className: 'error-btn', href: '../index.html' }, [
          U.el('i', { className: 'bi bi-arrow-left',
                      aria: { hidden: 'true' } }),
          'Browse Courses'
        ])
      ])
    );
  }

  /* ── Breadcrumb ── */

  /**
   * Builds the breadcrumb navigation for the course details page.
   *
   * @param {Object} course — the course data object
   * @returns {HTMLElement} the <nav> breadcrumb element
   */
  function buildBreadcrumb(course) {
    var ol = U.el('ol', { className: 'breadcrumb' });

    var li1 = U.el('li', { className: 'breadcrumb-item' });
    li1.appendChild(U.el('a', { href: '../../index.html', textContent: 'Home' }));
    ol.appendChild(li1);

    var li2 = U.el('li', { className: 'breadcrumb-item' });
    li2.appendChild(U.el('a', { href: '../index.html', textContent: 'Courses' }));
    ol.appendChild(li2);

    var li3 = U.el('li', {
      className: 'breadcrumb-item active',
      aria:      { current: 'page' }
    });
    li3.appendChild(U.el('span', { textContent: course.title }));
    ol.appendChild(li3);

    var nav = U.el('nav', {
      className: 'breadcrumb-nav',
      aria:      { label: 'Breadcrumb' },
      style:     { direction: 'ltr' }
    }, [ol]);

    return nav;
  }

  /* ── Header ── */

  /**
   * Builds the page header with back link, breadcrumb, and h1 title.
   *
   * @param {Object} course — the course data object
   * @returns {HTMLElement} the <header> element
   */
  function buildHeader(course) {
    return U.el('header', {
      className: 'details-header',
      style:     { paddingTop: '0.5rem' }
    }, [
      U.el('div', { className: 'page-container' }, [
        U.el('a', { className: 'back-link', href: '../index.html' }, [
          U.el('i', { className: 'bi bi-arrow-right', aria: { hidden: 'true' } }),
          'Back to Courses'
        ]),
        buildBreadcrumb(course),
        U.el('h1', { className: 'page-title', textContent: course.title })
      ])
    ]);
  }

  /* ── Section Title Helper (LTR: icon then text, aligned left) ── */

  /**
   * Builds a section heading with icon and text, forced LTR.
   *
   * @param {string} iconClass — Bootstrap Icon class
   * @param {string} titleText — the heading text
   * @returns {HTMLElement} the <h2> element
   */
  function _buildSectionTitle(iconClass, titleText) {
    return U.el('h2', {
      className: 'details-section-title',
      style:     { direction: 'ltr', textAlign: 'left' }
    }, [
      U.el('i', { className: iconClass, aria: { hidden: 'true' } }),
      titleText
    ]);
  }

  /* ── Learning Objectives ── */

  /**
   * Builds the "What You'll Learn" section with a grid of objectives.
   *
   * @param {Object} course — the course data object
   * @returns {HTMLElement|null} the section element, or null if no objectives
   */
  function buildObjectives(course) {
    if (!course.learningObjectives || !course.learningObjectives.length) return null;

    var list = U.el('ul', { className: 'objectives-list' });
    course.learningObjectives.forEach(function (obj) {
      list.appendChild(U.el('li', null, [
        U.el('i',    { className: 'bi bi-check-circle-fill obj-icon', aria: { hidden: 'true' } }),
        U.el('span', { textContent: obj })
      ]));
    });

    return U.el('section', {
      className: 'details-section',
      aria:      { label: 'What you will learn' }
    }, [
      _buildSectionTitle('bi bi-lightbulb', "What You'll Learn"),
      list
    ]);
  }

  /* ── Curriculum ── */

  /**
   * Builds the Curriculum section with Bootstrap accordion.
   * Parses MM:SS duration strings, computes totals.
   *
   * @param {Object} course — the course data object
   * @returns {HTMLElement|null} the section element, or null if no curriculum
   */
  function buildCurriculum(course) {
    if (!course.curriculum || !course.curriculum.length) return null;

    var totalLessons     = 0;
    var totalDurationSec = 0;

    course.curriculum.forEach(function (section) {
      if (!section.lessons) return;
      totalLessons += section.lessons.length;
      section.lessons.forEach(function (lesson) {
        if (!lesson.duration) return;
        var parts = lesson.duration.split(':');
        totalDurationSec +=
          (parseInt(parts[0], 10) || 0) * 60 +
          (parseInt(parts[1], 10) || 0);
      });
    });

    var totalHours   = Math.floor(totalDurationSec / 3600);
    var totalMins    = Math.ceil((totalDurationSec % 3600) / 60);
    var durationText = (totalHours > 0 ? totalHours + 'h ' : '') + totalMins + 'm total';

    var summaryLine = U.el('p', {
      className:   'mb-3',
      style:       { color: 'var(--text-muted)', fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' },
      textContent: course.curriculum.length + ' sections \u2022 ' +
                   totalLessons + ' lessons \u2022 ' + durationText
    });

    var accordion = U.el('div', {
      className: 'accordion curriculum-accordion',
      id:        'curriculum-accordion'
    });

    course.curriculum.forEach(function (section, sIdx) {
      var headerId = 'curr-head-' + sIdx;
      var bodyId   = 'curr-body-' + sIdx;

      var sectionLessons = section.lessons ? section.lessons.length : 0;
      var sectionDurSec  = 0;
      if (section.lessons) {
        section.lessons.forEach(function (l) {
          if (!l.duration) return;
          var p = l.duration.split(':');
          sectionDurSec +=
            (parseInt(p[0], 10) || 0) * 60 +
            (parseInt(p[1], 10) || 0);
        });
      }
      var sectionDurMin = Math.ceil(sectionDurSec / 60);

      var btn = U.el('button', {
        className: 'accordion-button' + (sIdx === 0 ? '' : ' collapsed'),
        type:      'button',
        dataset:   { bsToggle: 'collapse', bsTarget: '#' + bodyId },
        aria:      { expanded: sIdx === 0 ? 'true' : 'false', controls: bodyId },
        style:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
      });
      btn.appendChild(U.el('span', {
        textContent: section.title,
        style:       { textAlign: 'right', flex: '1' }
      }));
      btn.appendChild(U.el('span', {
        className:   'curriculum-section-meta',
        textContent: sectionLessons + ' lessons \u2022 ' + sectionDurMin + ' min',
        style:       { direction: 'ltr', whiteSpace: 'nowrap', marginLeft: '0', marginRight: 'auto', paddingLeft: '0.5rem' }
      }));

      var header = U.el('h2', { className: 'accordion-header', id: headerId });
      header.appendChild(btn);

      var lessonList = U.el('ul', { className: 'lesson-list' });

      if (section.lessons) {
        section.lessons.forEach(function (lesson) {
          var iconClass = lesson.preview ? 'bi bi-play-circle-fill' : 'bi bi-lock-fill';
          var metaEl    = U.el('div', { className: 'lesson-meta' });
          if (lesson.duration) {
            metaEl.appendChild(U.el('span', { className: 'lesson-duration', textContent: lesson.duration }));
          }
          if (lesson.preview) {
            metaEl.appendChild(U.el('span', { className: 'lesson-preview-badge', textContent: 'Preview' }));
          }
          lessonList.appendChild(U.el('li', { className: 'lesson-item' }, [
            U.el('i',    { className: iconClass + ' lesson-icon', aria: { hidden: 'true' } }),
            U.el('span', { className: 'lesson-title', textContent: lesson.title }),
            metaEl
          ]));
        });
      }

      var bodyContent = U.el('div', {
        className: 'accordion-collapse collapse' + (sIdx === 0 ? ' show' : ''),
        id:        bodyId,
        aria:      { labelledby: headerId },
        dataset:   { bsParent: '#curriculum-accordion' }
      });
      bodyContent.appendChild(U.el('div', { className: 'accordion-body' }, [lessonList]));

      var item = U.el('div', { className: 'accordion-item' });
      item.appendChild(header);
      item.appendChild(bodyContent);
      accordion.appendChild(item);
    });

    return U.el('section', {
      className: 'details-section',
      aria:      { label: 'Course curriculum' }
    }, [
      _buildSectionTitle('bi bi-journal-text', 'Curriculum'),
      summaryLine,
      accordion
    ]);
  }

  /* ── FAQ ── */

  /**
   * Builds the FAQ section with Bootstrap accordion.
   *
   * @param {Object} course — the course data object
   * @returns {HTMLElement|null} the section element, or null if no FAQ
   */
  function buildFAQ(course) {
    if (!course.faq || !course.faq.length) return null;

    var accordion = U.el('div', {
      className: 'accordion faq-accordion',
      id:        'faq-accordion'
    });

    course.faq.forEach(function (item, idx) {
      var headerId = 'faq-head-' + idx;
      var bodyId   = 'faq-body-' + idx;

      var btn = U.el('button', {
        className:   'accordion-button collapsed',
        type:        'button',
        textContent: item.question,
        dataset:     { bsToggle: 'collapse', bsTarget: '#' + bodyId },
        aria:        { expanded: 'false', controls: bodyId }
      });

      var hdr = U.el('h3', { className: 'accordion-header', id: headerId });
      hdr.appendChild(btn);

      var body = U.el('div', {
        className: 'accordion-collapse collapse',
        id:        bodyId,
        aria:      { labelledby: headerId },
        dataset:   { bsParent: '#faq-accordion' }
      });
      body.appendChild(U.el('div', { className: 'accordion-body', textContent: item.answer }));

      var accItem = U.el('div', { className: 'accordion-item' });
      accItem.appendChild(hdr);
      accItem.appendChild(body);
      accordion.appendChild(accItem);
    });

    return U.el('section', {
      className: 'details-section',
      aria:      { label: 'Frequently asked questions' }
    }, [
      _buildSectionTitle('bi bi-question-circle', 'Frequently Asked Questions'),
      accordion
    ]);
  }

  /* ── Price Display Builder ── */

  /**
   * Builds the price display element with discount awareness.
   * Handles three scenarios: free, paid without discount, paid with discount.
   *
   * @param {Object} course — the course data object
   * @returns {HTMLElement} the .price-display container
   */
  function _buildPriceDisplay(course) {
    var isFree = parseFloat(course.price) === 0;

    /* — Free course — */
    if (isFree) {
      return U.el('div', {
        className: 'price-display',
        style:     { direction: 'ltr' }
      }, [
        U.el('span', {
          className:   'price-current free',
          textContent: 'Free'
        })
      ]);
    }

    var currentPrice = parseFloat(course.price);
    var originalPrice = parseFloat(course.originalPrice) || 0;
    var hasDiscount = originalPrice > currentPrice && currentPrice > 0;

    /* — Paid, no discount — */
    if (!hasDiscount) {
      return U.el('div', {
        className: 'price-display',
        style:     { direction: 'ltr' },
        aria:      { label: 'Price: $' + currentPrice.toFixed(2) }
      }, [
        U.el('span', {
          className:   'price-current',
          textContent: '$' + currentPrice.toFixed(2),
          aria:        { hidden: 'true' }
        })
      ]);
    }

    /* — Paid, with discount — */
    var discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
    var savedAmount     = (originalPrice - currentPrice).toFixed(2);

    var ariaText = 'Original price $' + originalPrice.toFixed(2) +
                   ', now $' + currentPrice.toFixed(2) +
                   ', ' + discountPercent + '% discount, you save $' + savedAmount;

    return U.el('div', {
      className: 'price-display',
      style:     { direction: 'ltr' },
      aria:      { label: ariaText }
    }, [
      U.el('span', {
        className:   'price-original',
        textContent: '$' + originalPrice.toFixed(2),
        aria:        { hidden: 'true' }
      }),
      U.el('span', {
        className:   'price-current',
        textContent: '$' + currentPrice.toFixed(2),
        aria:        { hidden: 'true' }
      }),
      U.el('span', {
        className: 'price-discount',
        aria:      { hidden: 'true' }
      }, [
        discountPercent + '% OFF',
        U.el('span', { className: 'price-discount-dot', textContent: '\u00B7' }),
        'Save $' + savedAmount
      ])
    ]);
  }

  /* ── Sidebar Card ── */

  /**
   * Builds the sidebar card with course image, price, action buttons, and meta list.
   *
   * @param {Object} course — the course data object
   * @returns {HTMLElement} the .sidebar-card element
   */
  function buildSidebarCard(course) {
    var img = U.el('img', {
      className: 'sidebar-course-img',
      src:       '../../assets/img/' + course.image,
      alt:       course.title,
      loading:   'eager',
      decoding:  'async'
    });

    var priceEl = _buildPriceDisplay(course);

    var isFree = parseFloat(course.price) === 0;

    var buttonsWrapper = U.el('div', {
      className: 'sidebar-buttons',
      style:     { direction: 'ltr' }
    });

    if (isFree) {
      var driveUrl = U.sanitizeUrl(course.driveUrl || '');
      buttonsWrapper.appendChild(
        U.el('a', {
          className: 'btn-buy',
          href:      driveUrl || '#',
          target:    driveUrl ? '_blank' : '_self',
          rel:       'noopener noreferrer',
          aria:      { label: 'Start learning ' + course.title + ' for free' }
        }, [
          U.el('i', { className: 'bi bi-play-circle-fill', aria: { hidden: 'true' } }),
          ' Start Learning Now'
        ])
      );
    } else {
      var waLink = U.sanitizeUrl(buildWhatsAppLink(course));
      buttonsWrapper.appendChild(
        U.el('a', {
          className: 'btn-buy',
          href:      waLink,
          target:    '_blank',
          rel:       'noopener noreferrer',
          aria: {
            label: 'Buy ' + course.title +
                   ' for $' + parseFloat(course.price).toFixed(2) +
                   ' via WhatsApp'
          }
        }, [
          U.el('i', { className: 'bi bi-whatsapp', aria: { hidden: 'true' } }),
          ' Buy Now \u2014 $' + parseFloat(course.price).toFixed(2)
        ])
      );

      buttonsWrapper.appendChild(
        U.el('a', {
          className: 'btn-enter-course',
          href:      '/course/paid/' + course.id,
          aria:      { label: 'Access course \u2014 sign in to enter' }
        }, [
          U.el('i', { className: 'bi bi-box-arrow-in-right', aria: { hidden: 'true' } }),
          ' Already Purchased? Enter Course'
        ])
      );
    }

    var metaList = U.el('ul', {
      className: 'course-meta-list',
      style:     { direction: 'ltr' }
    });
    metaList.appendChild(_buildMetaItem('bi-person-fill',    'Instructor', course.instructor));
    metaList.appendChild(_buildMetaItem('bi-tag-fill',       'Category',   course.category));
    metaList.appendChild(_buildMetaItem('bi-bar-chart-fill', 'Level',      course.level));
    metaList.appendChild(_buildMetaItem('bi-people-fill',    'Students',   U.formatNumber(course.students)));
    metaList.appendChild(_buildMetaItem('bi-book-fill',      'Lessons',    String(course.lessons)));

    var ratingMetaValue = U.el('span', { className: 'meta-value', id: 'meta-rating-value' });
    var ratingInline    = U.el('span', { className: 'meta-rating-inline' });
    if (RS) ratingInline.appendChild(RS.renderStars(course.rating, false));
    ratingInline.appendChild(U.el('span', { textContent: ' ' + (course.rating || 0).toFixed(1) }));
    ratingMetaValue.appendChild(ratingInline);

    metaList.appendChild(U.el('li', { className: 'course-meta-item' }, [
      U.el('span', { className: 'meta-label' }, [
        U.el('i', { className: 'bi bi-star-fill', aria: { hidden: 'true' } }),
        'Rating'
      ]),
      ratingMetaValue
    ]));

    metaList.appendChild(_buildMetaItem('bi-calendar3', 'Updated', _formatDate(course.date)));

    var content = U.el('div', { className: 'sidebar-content' }, [priceEl, buttonsWrapper, metaList]);
    return U.el('div', { className: 'sidebar-card' }, [img, content]);
  }

  /**
   * Builds a single meta list item (icon + label + value).
   *
   * @param {string} icon — Bootstrap Icon class (without "bi " prefix)
   * @param {string} label — the label text
   * @param {string} value — the value text
   * @returns {HTMLElement} the <li> element
   */
  function _buildMetaItem(icon, label, value) {
    return U.el('li', { className: 'course-meta-item' }, [
      U.el('span', { className: 'meta-label' }, [
        U.el('i', { className: 'bi ' + icon, aria: { hidden: 'true' } }),
        label
      ]),
      U.el('span', { className: 'meta-value', textContent: value })
    ]);
  }

  /**
   * Formats a date string as a human-readable US English date.
   *
   * @param {string} dateStr — ISO date string
   * @returns {string} formatted date or original string on error
   */
  function _formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) { return dateStr; }
  }

  /* ── Rating Card ── */

  /**
   * Builds the rating card with display stars, interactive stars, and status.
   *
   * @param {Object} course — the course data object
   * @returns {HTMLElement} the .rating-card element
   */
  function buildRatingCard(course) {
    var card = U.el('div', { className: 'rating-card', id: 'rating-card' });

    card.appendChild(U.el('h3', { className: 'rating-card-title',    textContent: 'Rate This Course' }));
    card.appendChild(U.el('p',  { className: 'rating-card-subtitle', textContent: 'Share your experience with other students' }));

    card.appendChild(U.el('div', { className: 'rating-big-number', id: 'rating-big-number', textContent: '\u2014' }));

    var displayStarsContainer = U.el('div', { id: 'rating-display-stars' });
    if (RS) displayStarsContainer.appendChild(RS.renderStars(0, false));
    card.appendChild(displayStarsContainer);

    card.appendChild(U.el('p', { className: 'rating-count', id: 'rating-count-text', textContent: 'Loading ratings...' }));

    var interactiveContainer = U.el('div', { id: 'rating-interactive-stars' });
    if (RS) {
      var interactiveStars = RS.renderStars(0, true);
      interactiveContainer.appendChild(interactiveStars);
      RS.initializeStarEvents(interactiveStars, function (value) {
        _handleRatingSubmit(course.id, value);
      });
    } else {
      interactiveContainer.appendChild(U.el('p', { className: 'rating-status', textContent: 'Rating system not available' }));
    }
    card.appendChild(interactiveContainer);
    card.appendChild(U.el('p', { className: 'rating-status', id: 'rating-status-msg' }));

    return card;
  }

  /**
   * Handles rating submission: disables stars, calls API, updates UI.
   *
   * @param {number} courseId — the course ID
   * @param {number} value — the star value (1-5)
   */
  function _handleRatingSubmit(courseId, value) {
    var statusEl             = U.qs('#rating-status-msg');
    var interactiveContainer = U.qs('#rating-interactive-stars .stars-interactive');

    if (statusEl) { statusEl.textContent = 'Submitting your rating...'; statusEl.className = 'rating-status'; }
    if (RS && interactiveContainer) RS.disableStars(interactiveContainer);

    RS.submitRating(courseId, value).then(function (result) {
      if (result.status === 'success') {
        if (statusEl) { statusEl.textContent = 'Thank you for your rating!'; statusEl.className = 'rating-status success'; }
        U.showToast('Rating submitted successfully!', 'success');
        U.announce('Rating submitted successfully');
        _loadAndDisplayRatings(courseId);
      } else {
        if (statusEl) {
          statusEl.textContent = result.message || 'Failed to submit. Please try again.';
          statusEl.className   = 'rating-status error';
        }
        if (interactiveContainer) {
          interactiveContainer.classList.remove('stars-disabled');
          interactiveContainer.querySelectorAll('.star-btn').forEach(function (s) { s.disabled = false; });
          var firstStar = interactiveContainer.querySelector('.star-btn');
          if (firstStar) firstStar.setAttribute('tabindex', '0');
        }
      }
    }).catch(function () {
      if (statusEl) {
        statusEl.textContent = 'Connection error. Please try again.';
        statusEl.className = 'rating-status error';
      }
      if (interactiveContainer) {
        interactiveContainer.classList.remove('stars-disabled');
        interactiveContainer.querySelectorAll('.star-btn').forEach(function (s) { s.disabled = false; });
        var firstStar = interactiveContainer.querySelector('.star-btn');
        if (firstStar) firstStar.setAttribute('tabindex', '0');
      }
    });
  }

  /**
   * Fetches live ratings and updates the display: big number, stars,
   * count text, sidebar meta, and Course JSON-LD aggregateRating.
   *
   * @param {number} courseId — the course ID
   */
  function _loadAndDisplayRatings(courseId) {
    if (!RS) return;
    RS.fetchRatings(courseId).then(function (data) {
      var avg   = data.average || 0;
      var count = data.count   || 0;

      var bigNum = U.qs('#rating-big-number');
      if (bigNum) bigNum.textContent = avg > 0 ? avg.toFixed(1) : '\u2014';

      var displayContainer = U.qs('#rating-display-stars');
      if (displayContainer && RS) {
        clearElement(displayContainer);
        displayContainer.appendChild(RS.renderStars(avg, false));
      }

      var countText = U.qs('#rating-count-text');
      if (countText) {
        countText.textContent = count > 0
          ? U.formatNumber(count) + ' rating' + (count !== 1 ? 's' : '')
          : 'No ratings yet \u2014 be the first!';
      }

      var metaRating = U.qs('#meta-rating-value');
      if (metaRating && RS) {
        clearElement(metaRating);
        var inline = U.el('span', { className: 'meta-rating-inline' });
        inline.appendChild(RS.renderStars(avg, false));
        inline.appendChild(U.el('span', { textContent: ' ' + (avg > 0 ? avg.toFixed(1) : '\u2014') }));
        metaRating.appendChild(inline);
      }

      if (count > 0 && !data.error) addRatingToSchema(avg, count);
    });
  }

  /* ── Utilities ── */

  /**
   * Removes all child nodes from an element.
   *
   * @param {HTMLElement} el — the element to clear
   */
  function clearElement(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  /* ── Page Builder ── */

  /**
   * Builds the entire course details page content and appends it
   * to the container. Also triggers async rating load.
   *
   * @param {Object} course — the course data object
   * @param {HTMLElement} container — the parent element (#app)
   */
  function buildPage(course, container) {
    buildSchema(course);

    var frag          = document.createDocumentFragment();
    var mainContainer = U.el('div', { className: 'page-container' });
    var row           = U.el('div', { className: 'row g-4' });
    var leftCol       = U.el('div', { className: 'col-lg-8' });
    var rightCol      = U.el('div', { className: 'col-lg-4' });
    var sidebar       = U.el('div', { className: 'details-sidebar' });

    var objectives = buildObjectives(course);
    if (objectives) leftCol.appendChild(objectives);

    var curriculum = buildCurriculum(course);
    if (curriculum) leftCol.appendChild(curriculum);

    var faq = buildFAQ(course);
    if (faq) leftCol.appendChild(faq);

    sidebar.appendChild(buildSidebarCard(course));
    sidebar.appendChild(buildRatingCard(course));
    rightCol.appendChild(sidebar);

    row.appendChild(leftCol);
    row.appendChild(rightCol);
    mainContainer.appendChild(row);

    frag.appendChild(buildHeader(course));
    frag.appendChild(mainContainer);
    container.appendChild(frag);

    _loadAndDisplayRatings(course.id);
  }

  /* ============================================================
     AI COURSE ASSISTANT — Chat Widget
     ============================================================ */

  /**
   * Builds the floating action button (FAB) for the chat widget.
   * Fixed position, toggles chat open/close.
   *
   * @returns {HTMLElement} the FAB button element
   */
  function buildChatFab() {
    var fab = U.el('button', {
      className: 'chat-fab chat-fab--pulse',
      id:        'chat-fab',
      type:      'button',
      aria:      { expanded: 'false', label: 'Open course assistant' }
    }, [
      U.el('i', {
        className: 'bi bi-chat-dots-fill chat-fab-icon chat-fab-icon--open',
        aria:      { hidden: 'true' }
      }),
      U.el('i', {
        className: 'bi bi-x-lg chat-fab-icon chat-fab-icon--close',
        aria:      { hidden: 'true' }
      })
    ]);

    return fab;
  }

  /**
   * Builds the full chat widget container: header, messages area,
   * typing indicator, and input area.
   *
   * @param {Object} course — the course data object
   * @returns {HTMLElement} the chat widget element
   */
  function buildChatWidget(course) {
    /* ── Header ── */
    var header = U.el('div', { className: 'chat-header', id: 'chat-header' }, [
      U.el('div', { className: 'chat-header-info' }, [
        U.el('div', { className: 'chat-header-avatar' }, [
          U.el('i', { className: 'bi bi-robot', aria: { hidden: 'true' } })
        ]),
        U.el('div', null, [
          U.el('div', { className: 'chat-header-name', textContent: CHAT_CONFIG.botName }),
          U.el('div', { className: 'chat-header-status', textContent: course.title })
        ])
      ]),
      U.el('button', {
        className: 'chat-header-close',
        type:      'button',
        aria:      { label: 'Close course assistant' }
      }, [
        U.el('i', { className: 'bi bi-x-lg', aria: { hidden: 'true' } })
      ])
    ]);

    /* ── Messages ── */
    var messages = U.el('div', {
      className: 'chat-messages',
      id:        'chat-messages',
      role:      'log',
      aria:      { live: 'polite', label: 'Course assistant conversation' }
    });

    /* ── Typing indicator ── */
    var typing = U.el('div', {
      className: 'chat-typing',
      id:        'chat-typing',
      aria:      { hidden: 'true' }
    }, [
      _buildTypingIndicator()
    ]);

    /* ── Input area ── */
    var textarea = U.el('textarea', {
      className:   'chat-input',
      id:          'chat-input',
      placeholder: CHAT_CONFIG.placeholder,
      rows:        '1',
      aria:        { label: CHAT_CONFIG.placeholder }
    });
    textarea.setAttribute('maxlength', String(CHAT_CONFIG.maxMessageLen));

    var sendBtn = U.el('button', {
      className: 'chat-send-btn',
      id:        'chat-send-btn',
      type:      'button',
      disabled:  'true',
      aria:      { label: 'Send message' }
    }, [
      U.el('i', { className: 'bi bi-send-fill', aria: { hidden: 'true' } })
    ]);

    var inputArea = U.el('div', { className: 'chat-input-area' }, [
      textarea,
      sendBtn
    ]);

    /* ── Assemble widget ── */
    var widget = U.el('div', {
      className: 'chat-widget',
      id:        'chat-widget'
    }, [
      header,
      messages,
      typing,
      inputArea
    ]);

    return widget;
  }

  /**
   * Builds the 3-dot typing indicator animation element.
   *
   * @returns {HTMLElement} the typing dots container
   */
  function _buildTypingIndicator() {
    return U.el('div', { className: 'chat-typing-dots' }, [
      U.el('span', { className: 'chat-typing-dot' }),
      U.el('span', { className: 'chat-typing-dot' }),
      U.el('span', { className: 'chat-typing-dot' })
    ]);
  }

  /**
   * Builds a single chat message bubble element.
   *
   * @param {string} role — "user", "model", or "error"
   * @param {string} text — the message text
   * @returns {HTMLElement} the message bubble element
   */
  function _buildMessageBubble(role, text) {
    var bubbleClass = 'chat-bubble';
    if (role === 'user')  bubbleClass += ' chat-bubble--user';
    if (role === 'model') bubbleClass += ' chat-bubble--bot';
    if (role === 'error') bubbleClass += ' chat-bubble--error';

    var bubble = U.el('div', { className: bubbleClass });

    /* Split text into paragraphs on double-newline, single-newline becomes <br> equivalent via separate <p> */
    var paragraphs = text.split(/\n+/);
    for (var i = 0; i < paragraphs.length; i++) {
      var line = paragraphs[i].trim();
      if (line.length > 0) {
        bubble.appendChild(U.el('p', {
          className:   'chat-bubble-text',
          textContent: line
        }));
      }
    }

    return bubble;
  }

  /**
   * Adds a message bubble to the chat messages area and scrolls down.
   *
   * @param {string} role — "user", "model", or "error"
   * @param {string} text — the message text
   */
  function _addChatMessage(role, text) {
    var container = U.qs('#chat-messages');
    if (!container) return;

    container.appendChild(_buildMessageBubble(role, text));
    _scrollChatToBottom();
  }

  /**
   * Shows the typing indicator.
   */
  function _showChatTyping() {
    var typing = U.qs('#chat-typing');
    if (typing) typing.classList.add('chat-typing--visible');
    _scrollChatToBottom();
  }

  /**
   * Hides the typing indicator.
   */
  function _hideChatTyping() {
    var typing = U.qs('#chat-typing');
    if (typing) typing.classList.remove('chat-typing--visible');
  }

  /**
   * Scrolls the chat messages area to the bottom smoothly.
   */
  function _scrollChatToBottom() {
    var container = U.qs('#chat-messages');
    if (!container) return;
    requestAnimationFrame(function () {
      container.scrollTop = container.scrollHeight;
    });
  }

  /**
   * Returns the sessionStorage key for a given courseId.
   *
   * @param {number} courseId — the course ID
   * @returns {string} the storage key
   */
  function _chatStorageKey(courseId) {
    return CHAT_CONFIG.storagePrefix + courseId;
  }

  /**
   * Reads the chat history from sessionStorage.
   *
   * @param {number} courseId — the course ID
   * @returns {Array} array of { role, text } objects
   */
  function _getChatHistory(courseId) {
    try {
      var raw = sessionStorage.getItem(_chatStorageKey(courseId));
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      return [];
    }
  }

  /**
   * Saves a single message to the chat history in sessionStorage.
   * Enforces the max history limit by removing the oldest pair
   * when the limit is exceeded.
   *
   * @param {number} courseId — the course ID
   * @param {string} role — "user" or "model"
   * @param {string} text — the message text
   */
  function _saveChatMessage(courseId, role, text) {
    try {
      var history = _getChatHistory(courseId);
      history.push({ role: role, text: text });

      /* Trim to max history — remove oldest pair (2 items) */
      while (history.length > CHAT_CONFIG.maxHistory) {
        history.shift();
        if (history.length > 0 && history[0].role === 'model') {
          history.shift();
        }
      }

      sessionStorage.setItem(_chatStorageKey(courseId), JSON.stringify(history));
    } catch (e) {
      /* sessionStorage full or unavailable — silently degrade */
    }
  }

  /**
   * Loads existing chat history from sessionStorage and rebuilds
   * message bubbles in the chat messages area.
   *
   * @param {number} courseId — the course ID
   */
  function _loadChatHistory(courseId) {
    var history = _getChatHistory(courseId);
    if (history.length === 0) return;

    for (var i = 0; i < history.length; i++) {
      _addChatMessage(history[i].role, history[i].text);
    }
  }

  /**
   * Toggles the chat widget open or closed with CSS transitions.
   * Updates FAB state, aria attributes, and manages focus.
   */
  function _toggleChat() {
    var fab    = U.qs('#chat-fab');
    var widget = U.qs('#chat-widget');
    if (!fab || !widget) return;

    chatState.isOpen = !chatState.isOpen;

    if (chatState.isOpen) {
      widget.classList.add('chat-widget--open');
      fab.classList.add('chat-fab--active');
      fab.setAttribute('aria-expanded', 'true');
      fab.setAttribute('aria-label', 'Close course assistant');

      /* Stop pulse animation once opened */
      fab.classList.remove('chat-fab--pulse');

      /* Focus textarea */
      var input = U.qs('#chat-input');
      if (input) {
        setTimeout(function () { input.focus(); }, 100);
      }

      _scrollChatToBottom();
    } else {
      widget.classList.remove('chat-widget--open');
      fab.classList.remove('chat-fab--active');
      fab.setAttribute('aria-expanded', 'false');
      fab.setAttribute('aria-label', 'Open course assistant');

      /* Return focus to FAB */
      fab.focus();
    }
  }

  /**
   * Handles chat message submission: reads input, validates, sends to
   * /api/chat, and displays the response.
   *
   * @param {number} courseId — the course ID
   */
  function _handleChatSubmit(courseId) {
    if (chatState.sending) return;

    var input   = U.qs('#chat-input');
    var sendBtn = U.qs('#chat-send-btn');
    if (!input) return;

    var message = input.value.trim();
    if (message.length === 0) return;
    if (message.length > CHAT_CONFIG.maxMessageLen) {
      message = message.substring(0, CHAT_CONFIG.maxMessageLen);
    }

    /* Add user bubble */
    _addChatMessage('user', message);
    _saveChatMessage(courseId, 'user', message);

    /* Reset input */
    input.value = '';
    _resizeChatInput(input);
    if (sendBtn) sendBtn.disabled = true;

    /* Show typing + disable input */
    chatState.sending = true;
    _showChatTyping();
    input.disabled = true;

    /* Build API payload */
    var history = _getChatHistory(courseId);
    /* Remove the just-added user message from history sent to API
       (it goes as `message`, not in `history`) */
    if (history.length > 0 && history[history.length - 1].role === 'user') {
      history = history.slice(0, history.length - 1);
    }

    /* Call API */
    var controller = new AbortController();
    var timer      = setTimeout(function () { controller.abort(); }, 35000);

    fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        courseId: courseId,
        message: message,
        history: history
      }),
      signal: controller.signal
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      clearTimeout(timer);
      _hideChatTyping();

      if (data.status === 'success' && data.reply) {
        _addChatMessage('model', data.reply);
        _saveChatMessage(courseId, 'model', data.reply);
      } else {
        var errMsg = data.message || CHAT_CONFIG.errorMessage;
        _addChatMessage('error', errMsg);
      }

      _enableChatInput();
    })
    .catch(function () {
      clearTimeout(timer);
      _hideChatTyping();
      _addChatMessage('error', CHAT_CONFIG.errorMessage);
      _enableChatInput();
    });
  }

  /**
   * Re-enables the chat input and send button after a response.
   * Focuses the textarea.
   */
  function _enableChatInput() {
    chatState.sending = false;
    var input   = U.qs('#chat-input');
    var sendBtn = U.qs('#chat-send-btn');
    if (input) {
      input.disabled = false;
      input.focus();
    }
    if (sendBtn) {
      sendBtn.disabled = !(input && input.value.trim().length > 0);
    }
  }

  /**
   * Resizes the textarea to auto-grow up to 3 lines, or shrink back.
   *
   * @param {HTMLTextAreaElement} textarea — the chat input element
   */
  function _resizeChatInput(textarea) {
    textarea.style.height = 'auto';
    /* Clamp to max 3 lines (~72px at 1.5 line-height * 0.88rem * 3) */
    var maxHeight = 72;
    var scrollH   = textarea.scrollHeight;
    textarea.style.height = Math.min(scrollH, maxHeight) + 'px';
  }

  /**
   * Binds all chat widget events: FAB click, close button, textarea
   * input/keydown, send button, and keyboard escape.
   *
   * @param {number} courseId — the course ID
   */
  function initChatEvents(courseId) {
    var fab      = U.qs('#chat-fab');
    var closeBtn = U.qs('.chat-header-close');
    var input    = U.qs('#chat-input');
    var sendBtn  = U.qs('#chat-send-btn');

    /* FAB toggle */
    if (fab) {
      fab.addEventListener('click', function () {
        _toggleChat();
      });
    }

    /* Header close button */
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        if (chatState.isOpen) _toggleChat();
      });
    }

    /* Textarea auto-grow + send button state */
    if (input) {
      input.addEventListener('input', function () {
        _resizeChatInput(input);
        if (sendBtn) {
          sendBtn.disabled = chatState.sending || input.value.trim().length === 0;
        }
      });

      /* Enter = submit, Shift+Enter = newline */
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          _handleChatSubmit(courseId);
        }
      });
    }

    /* Send button click */
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        _handleChatSubmit(courseId);
      });
    }

    /* Escape key closes chat */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && chatState.isOpen) {
        _toggleChat();
      }
    });
  }

  /* ── Init ── */

  /**
   * Main initialization function. Reads course ID from URL, finds
   * the course, injects SEO, builds the page, scrolls to title,
   * and initializes the chat widget.
   */
  function init() {
    var app      = U.qs('#app') || document.body;
    var courseId = getCourseIdFromURL();

    if (!courseId) { renderError(app); return; }

    var course = findCourse(courseId);
    if (!course) { renderError(app); return; }

    injectSEO(course);
    buildPage(course, app);

    /* Scroll past navigation to course title on initial load */
    requestAnimationFrame(function () {
      var titleEl = U.qs('.page-title');
      if (titleEl) {
        titleEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });

    /* Chat widget — appended to body (fixed overlays, not in content flow) */
    document.body.appendChild(buildChatFab());
    document.body.appendChild(buildChatWidget(course));
    initChatEvents(course.id);

    /* Load previous session messages + add welcome */
    var messagesContainer = U.qs('#chat-messages');
    if (messagesContainer) {
      var existingHistory = _getChatHistory(course.id);
      if (existingHistory.length > 0) {
        _loadChatHistory(course.id);
      } else {
        _addChatMessage('model', CHAT_CONFIG.welcomeMessage);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();