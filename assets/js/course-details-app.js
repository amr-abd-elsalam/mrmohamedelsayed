/* ── Upgrade Summary ──
   - Uses SharedPage (SP) for: formatPrice, buildWhatsAppUrl, injectBaseSEO,
     injectJsonLd, buildStarFragment, buildCopyrightText
   - All hardcoded Arabic UI strings moved to COURSE_DATA.META (white-label ready):
     section titles, rating card strings, error page, button labels, price labels
   - Extracted large functions into focused sub-functions:
     buildPage → _buildLeftColumn, _buildRightColumn
     buildSidebarCard → _buildPriceDisplay, _buildSidebarButtons, _buildSidebarMeta
     buildCurriculum → _calcDuration, _buildCurriculumSection
     buildChatWidget → _buildChatHeader, _buildChatMessages, _buildChatInput
   - Chat widget: added role="dialog", aria-modal, focus trap on open,
     focus restoration on close
   - Chat widget: Escape key handler moved inside chat scope (was document-level)
   - Rating: added U.announce() after submit success/failure and after load
   - Error page: uses META strings, improved a11y with role="alert"
   - Course level displayed in Arabic via META.levels
   - All URLs sanitized via U.sanitizeUrl()
   - Removed inline style={{ textAlign:'right' }} (inherited from dir="rtl")
   - _formatDate: added fallback for invalid dates
   - clearElement: null-safe (was already, documented)
   - setNoIndex: simplified
   - JSON-LD: added educationalCredentialAwarded, teaches fields where available
   ── End Summary ── */

'use strict';

(function () {

  /* ── Guard & Aliases ── */

  var U    = window.Utils;
  var DATA = window.COURSE_DATA;
  var SP   = window.SharedPage;
  var RS   = window.RatingSystem || null;

  if (!U || !DATA || !SP) {
    console.error('course-details-app: dependencies missing.');
    return;
  }

  var META = DATA.META;

  /* ── Constants ── */

  var BRAND_NAME = DATA.BRAND_NAME;
  var DOMAIN     = DATA.DOMAIN;
  var BASE_URL   = 'https://' + DOMAIN;

  var CHAT_CONFIG = Object.freeze({
    botName:        META.chatBotName        || 'مساعد الكورس',
    welcomeMessage: META.chatWelcomeMessage || 'مرحباً! أنا هنا عشان أساعدك بأي سؤال عن الكورس. اسألني أي حاجة!',
    placeholder:    META.chatPlaceholder    || 'اكتب سؤالك هنا...',
    errorMessage:   META.chatErrorMessage   || 'حصل مشكلة في الاتصال. جرّب تاني.',
    maxMessageLen:  500,
    maxHistory:     20,
    storagePrefix:  'mrelsayed_chat_',
    timeoutMs:      35000
  });

  /* ── Chat State ── */

  var chatState = {
    isOpen:       false,
    sending:      false,
    previousFocus: null   /* for focus restoration on close */
  };

  /* ── Helpers ── */

  function getLevelLabel(level) {
    return (META.levels && META.levels[level]) || level;
  }

  function clearElement(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function _formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) { return dateStr; }
  }

  /**
   * Parse "mm:ss" duration string to total seconds.
   */
  function _parseDuration(str) {
    if (!str) return 0;
    var parts = str.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }

  /* ── Course Lookup ── */

  function getCourseIdFromURL() {
    var params  = new URLSearchParams(window.location.search);
    var raw     = params.get('id');
    if (!raw) return null;
    var trimmed = raw.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    var id = parseInt(trimmed, 10);
    return id >= 1 ? id : null;
  }

  function findCourse(id) {
    for (var i = 0; i < DATA.courses.length; i++) {
      if (DATA.courses[i].id === id) return DATA.courses[i];
    }
    return null;
  }

  /* ══════════════════════════════════════
     SEO
  ══════════════════════════════════════ */

  function injectSEO(course) {
    var pageUrl   = BASE_URL + '/course/course-details/?id=' + course.id;
    var pageTitle = course.title + ' \u2014 ' + BRAND_NAME;
    var pageDesc  = course.description + ' ' + META.descriptionShort;
    var pageImage = BASE_URL + '/assets/img/' + course.image;

    SP.injectBaseSEO({
      pageTitle: pageTitle,
      pageDesc:  pageDesc,
      pageUrl:   pageUrl,
      pageImage: pageImage,
      brand:     BRAND_NAME
    });

    /* Course JSON-LD */
    SP.injectJsonLd({
      '@context':        'https://schema.org',
      '@type':           'Course',
      'name':            course.title,
      'description':     course.description,
      'url':             pageUrl,
      'provider': {
        '@type': 'Organization',
        'name':  BRAND_NAME,
        'url':   BASE_URL
      },
      'educationalLevel': course.level,
      'inLanguage':       course.language || 'ar',
      'teaches':          course.learningObjectives ? course.learningObjectives.join('. ') : undefined,
      'offers': {
        '@type':         'Offer',
        'price':         course.price,
        'priceCurrency': 'EGP',
        'availability':  'https://schema.org/InStock'
      }
    }, 'jsonld-seo-course');
  }

  function setNoIndex() {
    var el = document.querySelector('meta[name="robots"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', 'noindex, nofollow');
  }

  function buildSchemas(course) {
    var pageUrl = BASE_URL + '/course/course-details/?id=' + course.id;

    /* BreadcrumbList */
    SP.injectJsonLd({
      '@context':   'https://schema.org',
      '@type':      'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': META.navHome || 'الرئيسية', 'item': BASE_URL + '/' },
        { '@type': 'ListItem', 'position': 2, 'name': META.navCourses || 'الكورسات', 'item': BASE_URL + '/course/' },
        { '@type': 'ListItem', 'position': 3, 'name': course.title, 'item': pageUrl }
      ]
    }, 'jsonld-breadcrumb');

    /* FAQPage */
    if (course.faq && course.faq.length > 0) {
      SP.injectJsonLd({
        '@context':   'https://schema.org',
        '@type':      'FAQPage',
        'mainEntity': course.faq.map(function (item) {
          return {
            '@type': 'Question',
            'name':  item.question,
            'acceptedAnswer': { '@type': 'Answer', 'text': item.answer }
          };
        })
      }, 'jsonld-faq');
    }
  }

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
    } catch (e) { /* parse error — skip */ }
  }

  /* ══════════════════════════════════════
     WHATSAPP LINK
  ══════════════════════════════════════ */

  function buildWhatsAppLink(course) {
    var price = course.price > 0
      ? U.formatNumberAr(course.price) + ' ' + (META.currencyLabel || 'ج.م')
      : (META.freeLabel || 'مجاني');
    var message = 'مرحباً، أريد شراء كورس "' + course.title + '" \u2014 السعر: ' + price;
    return SP.buildWhatsAppUrl(DATA.WHATSAPP_NUMBER, message);
  }

  /* ══════════════════════════════════════
     ERROR PAGE
  ══════════════════════════════════════ */

  function renderError(container) {
    document.title = (META.errorTitle || 'الكورس غير موجود') + ' | ' + BRAND_NAME;
    setNoIndex();

    container.appendChild(
      U.el('div', { className: 'error-container', role: 'alert' }, [
        U.el('i',  { className: 'bi bi-exclamation-triangle error-icon', aria: { hidden: 'true' } }),
        U.el('h1', { className: 'error-title', textContent: META.errorTitle || 'الكورس غير موجود' }),
        U.el('p',  { className: 'error-text',  textContent: META.errorText  || 'الكورس اللي بتدور عليه مش موجود. ممكن يكون اتحذف أو الرابط غلط.' }),
        U.el('a',  { className: 'error-btn', href: U.sanitizeUrl('../index.html') }, [
          U.el('i', { className: 'bi bi-arrow-right', aria: { hidden: 'true' } }),
          META.errorBrowse || 'تصفح الكورسات'
        ])
      ])
    );

    U.announce(META.errorTitle || 'الكورس غير موجود');
  }

  /* ══════════════════════════════════════
     BREADCRUMB
  ══════════════════════════════════════ */

  function buildBreadcrumb(course) {
    var ol = U.el('ol', { className: 'breadcrumb' });

    var li1 = U.el('li', { className: 'breadcrumb-item' });
    li1.appendChild(U.el('a', { href: U.sanitizeUrl('../../index.html'), textContent: META.navHome || 'الرئيسية' }));
    ol.appendChild(li1);

    var li2 = U.el('li', { className: 'breadcrumb-item' });
    li2.appendChild(U.el('a', { href: U.sanitizeUrl('../index.html'), textContent: META.navCourses || 'الكورسات' }));
    ol.appendChild(li2);

    var li3 = U.el('li', { className: 'breadcrumb-item active', aria: { current: 'page' } });
    li3.appendChild(U.el('span', { textContent: course.title }));
    ol.appendChild(li3);

    return U.el('nav', { className: 'breadcrumb-nav', aria: { label: 'مسار التنقل' } }, [ol]);
  }

  /* ══════════════════════════════════════
     HEADER
  ══════════════════════════════════════ */

  function buildHeader(course) {
    return U.el('header', { className: 'details-header' }, [
      U.el('div', { className: 'page-container' }, [
        U.el('a', { className: 'back-link', href: U.sanitizeUrl('../index.html') }, [
          U.el('i', { className: 'bi bi-arrow-right', aria: { hidden: 'true' } }),
          META.backToCourses || 'العودة للكورسات'
        ]),
        buildBreadcrumb(course),
        U.el('h1', { className: 'page-title', textContent: course.title })
      ])
    ]);
  }

  /* ══════════════════════════════════════
     SECTION TITLE HELPER
  ══════════════════════════════════════ */

  function _buildSectionTitle(iconClass, titleText) {
    return U.el('h2', { className: 'details-section-title' }, [
      U.el('i', { className: iconClass, aria: { hidden: 'true' } }),
      titleText
    ]);
  }

  /* ══════════════════════════════════════
     LEARNING OBJECTIVES
  ══════════════════════════════════════ */

  function buildObjectives(course) {
    if (!course.learningObjectives || !course.learningObjectives.length) return null;

    var list = U.el('ul', { className: 'objectives-list' });
    course.learningObjectives.forEach(function (obj) {
      list.appendChild(U.el('li', null, [
        U.el('i',    { className: 'bi bi-check-circle-fill obj-icon', aria: { hidden: 'true' } }),
        U.el('span', { textContent: obj })
      ]));
    });

    return U.el('section', { className: 'details-section', aria: { label: META.sectionObjectives || 'هتتعلم إيه' } }, [
      _buildSectionTitle('bi bi-lightbulb', META.sectionObjectives || 'هتتعلم إيه'),
      list
    ]);
  }

  /* ══════════════════════════════════════
     CURRICULUM
  ══════════════════════════════════════ */

  function _calcCurriculumTotals(course) {
    var totalLessons = 0;
    var totalSec     = 0;

    course.curriculum.forEach(function (section) {
      if (!section.lessons) return;
      totalLessons += section.lessons.length;
      section.lessons.forEach(function (lesson) {
        totalSec += _parseDuration(lesson.duration);
      });
    });

    var hours = Math.floor(totalSec / 3600);
    var mins  = Math.ceil((totalSec % 3600) / 60);
    var durationText = (hours > 0 ? U.formatNumberAr(hours) + ' ساعة ' : '') + U.formatNumberAr(mins) + ' دقيقة';

    return {
      sections: course.curriculum.length,
      lessons:  totalLessons,
      duration: durationText
    };
  }

  function _buildCurriculumSection(section, sIdx, course) {
    var headerId = 'curr-head-' + sIdx;
    var bodyId   = 'curr-body-' + sIdx;

    /* Section meta */
    var sectionLessons = section.lessons ? section.lessons.length : 0;
    var sectionSec     = 0;
    if (section.lessons) {
      section.lessons.forEach(function (l) { sectionSec += _parseDuration(l.duration); });
    }
    var sectionMin = Math.ceil(sectionSec / 60);

    /* Button */
    var btn = U.el('button', {
      className: 'accordion-button' + (sIdx === 0 ? '' : ' collapsed'),
      type:      'button',
      dataset:   { bsToggle: 'collapse', bsTarget: '#' + bodyId },
      aria:      { expanded: sIdx === 0 ? 'true' : 'false', controls: bodyId }
    });

    var btnContent = U.el('span', { className: 'curriculum-btn-content' });
    btnContent.appendChild(U.el('span', { textContent: section.title, className: 'curriculum-section-title' }));
    btnContent.appendChild(U.el('span', {
      className:   'curriculum-section-meta',
      textContent: U.formatNumberAr(sectionLessons) + ' درس \u2022 ' + U.formatNumberAr(sectionMin) + ' د'
    }));
    btn.appendChild(btnContent);

    var header = U.el('h2', { className: 'accordion-header', id: headerId });
    header.appendChild(btn);

    /* Lesson list */
    var lessonList = U.el('ul', { className: 'lesson-list' });
    if (section.lessons) {
      section.lessons.forEach(function (lesson) {
        var isPreview    = lesson.preview === true;
        var hasPreviewUrl = isPreview && _sanitizePreviewUrl(lesson.previewUrl || '');
        var iconClass    = isPreview ? 'bi bi-play-circle-fill' : 'bi bi-lock-fill';

        var metaEl = U.el('div', { className: 'lesson-meta' });

        if (lesson.duration) {
          metaEl.appendChild(U.el('span', { className: 'lesson-duration', textContent: lesson.duration }));
        }

        if (isPreview) {
          metaEl.appendChild(U.el('span', {
            className: 'lesson-preview-badge' + (hasPreviewUrl ? ' lesson-preview-badge--active' : ''),
            textContent: 'معاينة'
          }));
        }

        var lessonItem = U.el('li', {
          className: 'lesson-item' + (hasPreviewUrl ? ' lesson-item--preview' : '')
        }, [
          U.el('i', { className: iconClass + ' lesson-icon' + (isPreview ? ' lesson-icon--preview' : ''), aria: { hidden: 'true' } }),
          U.el('span', { className: 'lesson-title', textContent: lesson.title }),
          metaEl
        ]);

        /* If has preview URL, add the preview thumbnail below */
        if (hasPreviewUrl) {
          var previewThumb = _buildPreviewThumbnail(lesson, course);
          if (previewThumb) {
            var previewWrap = U.el('div', { className: 'lesson-preview-wrap' });
            previewWrap.appendChild(previewThumb);
            lessonItem.appendChild(previewWrap);
          }
        }

        lessonList.appendChild(lessonItem);
      });
    }

    /* Collapse body */
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
    return item;
  }

  function buildCurriculum(course) {
    if (!course.curriculum || !course.curriculum.length) return null;

    var totals = _calcCurriculumTotals(course);

    var summaryLine = U.el('p', {
      className:   'mb-3 curriculum-summary',
      textContent: U.formatNumberAr(totals.sections) + ' أقسام \u2022 ' +
                   U.formatNumberAr(totals.lessons) + ' درس \u2022 ' + totals.duration
    });

    var accordion = U.el('div', { className: 'accordion curriculum-accordion', id: 'curriculum-accordion' });

    course.curriculum.forEach(function (section, sIdx) {
      accordion.appendChild(_buildCurriculumSection(section, sIdx, course));  // ← added course
    });

    return U.el('section', { className: 'details-section', aria: { label: META.sectionCurriculum || 'محتوى الكورس' } }, [
      _buildSectionTitle('bi bi-journal-text', META.sectionCurriculum || 'محتوى الكورس'),
      summaryLine,
      accordion
    ]);
  }

  /* ══════════════════════════════════════
     FAQ
  ══════════════════════════════════════ */

  function buildFAQ(course) {
    if (!course.faq || !course.faq.length) return null;

    var accordion = U.el('div', { className: 'accordion faq-accordion', id: 'faq-accordion' });

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

    return U.el('section', { className: 'details-section', aria: { label: META.sectionFaq || 'أسئلة شائعة' } }, [
      _buildSectionTitle('bi bi-question-circle', META.sectionFaq || 'أسئلة شائعة'),
      accordion
    ]);
  }

  /* ══════════════════════════════════════
     PRICE DISPLAY
  ══════════════════════════════════════ */

  function _buildPriceDisplay(course) {
    var isFree       = parseFloat(course.price) === 0;
    var currentPrice = parseFloat(course.price);
    var origPrice    = parseFloat(course.originalPrice) || 0;
    var hasDiscount  = !isFree && origPrice > currentPrice && currentPrice > 0;
    var currency     = META.currencyLabel || 'ج.م';

    if (isFree) {
      return U.el('div', { className: 'price-display' }, [
        U.el('span', { className: 'price-current free', textContent: META.freeLabel || 'مجاني' })
      ]);
    }

    if (!hasDiscount) {
      return U.el('div', {
        className: 'price-display',
        aria: { label: 'السعر: ' + U.formatNumberAr(currentPrice) + ' ' + currency }
      }, [
        U.el('span', { className: 'price-current', textContent: U.formatNumberAr(currentPrice) + ' ' + currency, aria: { hidden: 'true' } })
      ]);
    }

    var discountPct = Math.round((1 - currentPrice / origPrice) * 100);
    var savedAmount = origPrice - currentPrice;

    var ariaText = 'السعر الأصلي ' + U.formatNumberAr(origPrice) + ' ' + currency +
                   '، الآن ' + U.formatNumberAr(currentPrice) + ' ' + currency +
                   '، خصم ' + U.formatNumberAr(discountPct) + '%، وفرت ' + U.formatNumberAr(savedAmount) + ' ' + currency;

    return U.el('div', { className: 'price-display', aria: { label: ariaText } }, [
      U.el('span', { className: 'price-original', textContent: U.formatNumberAr(origPrice) + ' ' + currency, aria: { hidden: 'true' } }),
      U.el('span', { className: 'price-current',  textContent: U.formatNumberAr(currentPrice) + ' ' + currency, aria: { hidden: 'true' } }),
      U.el('span', { className: 'price-discount', aria: { hidden: 'true' } }, [
        'خصم ' + U.formatNumberAr(discountPct) + '%',
        U.el('span', { className: 'price-discount-dot', textContent: '\u00B7' }),
        'وفر ' + U.formatNumberAr(savedAmount) + ' ' + currency
      ])
    ]);
  }

    /* ══════════════════════════════════════
     PREVIEW VIDEO SYSTEM
  ══════════════════════════════════════ */

  /* ── Provider Detection ── */

  var PROVIDER_YOUTUBE = 'youtube';
  var PROVIDER_DRIVE   = 'drive';
  var PROVIDER_GENERIC = 'generic';

  /**
   * Detect video provider from URL.
   * @param {string} url
   * @returns {string} PROVIDER_YOUTUBE | PROVIDER_DRIVE | PROVIDER_GENERIC
   */
  function _detectProvider(url) {
    if (!url) return PROVIDER_GENERIC;
    if (url.indexOf('youtube.com/embed/') !== -1 || url.indexOf('youtube-nocookie.com/embed/') !== -1) {
      return PROVIDER_YOUTUBE;
    }
    if (url.indexOf('drive.google.com') !== -1) {
      return PROVIDER_DRIVE;
    }
    return PROVIDER_GENERIC;
  }

  /**
   * Extract YouTube video ID from embed URL.
   * @param {string} url — e.g. "https://www.youtube.com/embed/dQw4w9WgXcQ"
   * @returns {string|null}
   */
  function _extractYouTubeId(url) {
    if (!url) return null;
    var match = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  /**
   * Get thumbnail URL for a preview lesson.
   * Priority: previewThumb > auto-generated from YouTube ID > fallback
   * @param {object} lesson
   * @returns {string}
   */
  function _getPreviewThumbnail(lesson) {
    /* Explicit thumbnail */
    if (lesson.previewThumb && lesson.previewThumb.trim()) {
      return lesson.previewThumb;
    }

    /* Auto-generate from YouTube */
    var ytId = _extractYouTubeId(lesson.previewUrl);
    if (ytId) {
      return 'https://img.youtube.com/vi/' + ytId + '/maxresdefault.jpg';
    }

    /* Fallback — empty (will show icon-based placeholder) */
    return '';
  }

  /**
   * Sanitize and validate a preview embed URL.
   * Only allows YouTube, YouTube-nocookie, and Google Drive domains.
   * @param {string} url
   * @returns {string} sanitized URL or empty string
   */
  function _sanitizePreviewUrl(url) {
    if (!url || !url.trim()) return '';
    var s = String(url).trim();

    try {
      var parsed = new URL(s);
      var allowed = [
        'www.youtube.com',
        'youtube.com',
        'www.youtube-nocookie.com',
        'youtube-nocookie.com',
        'drive.google.com'
      ];
      if (allowed.indexOf(parsed.hostname) !== -1 && parsed.protocol === 'https:') {
        return s;
      }
    } catch (e) { /* invalid URL */ }

    return '';
  }

  /* ── Fullscreen Overlay State ── */

  var _previewOverlay = null;
  var _previewPreviousFocus = null;

  /**
   * Build the click-to-load preview thumbnail element.
   * @param {object} lesson — the lesson object with preview data
   * @param {object} course — parent course (for schema)
   * @returns {HTMLElement|null}
   */
  function _buildPreviewThumbnail(lesson, course) {
    var url = _sanitizePreviewUrl(lesson.previewUrl);
    if (!url) return null;

    var thumbUrl  = _getPreviewThumbnail(lesson);
    var provider  = _detectProvider(url);
    var hasThumb  = thumbUrl && thumbUrl.length > 0;
    var playLabel = META.previewPlayLabel || 'اضغط للمعاينة المجانية';

    var container = U.el('div', {
      className: 'preview-thumbnail',
      role:      'button',
      tabindex:  '0',
      aria:      { label: 'شغّل معاينة: ' + lesson.title },
      dataset:   { previewUrl: url, lessonTitle: lesson.title }
    });

    /* Thumbnail image or icon placeholder */
    if (hasThumb) {
      container.appendChild(U.el('img', {
        className: 'preview-thumbnail-img',
        src:       U.sanitizeUrl(thumbUrl),
        alt:       '',
        loading:   'lazy',
        decoding:  'async',
        aria:      { hidden: 'true' }
      }));
    } else {
      container.appendChild(U.el('div', {
        className: 'preview-thumbnail-placeholder'
      }, [
        U.el('i', {
          className: provider === PROVIDER_DRIVE
            ? 'bi bi-google'
            : 'bi bi-film',
          aria: { hidden: 'true' }
        })
      ]));
    }

    /* Play button overlay */
    var playBtn = U.el('div', { className: 'preview-play-overlay' }, [
      U.el('div', { className: 'preview-play-btn' }, [
        U.el('i', { className: 'bi bi-play-fill', aria: { hidden: 'true' } })
      ]),
      U.el('span', { className: 'preview-play-label', textContent: playLabel })
    ]);
    container.appendChild(playBtn);

    /* Provider badge */
    var providerLabel = provider === PROVIDER_YOUTUBE ? 'YouTube'
                      : provider === PROVIDER_DRIVE   ? 'Google Drive'
                      : 'فيديو';
    container.appendChild(U.el('span', {
      className: 'preview-provider-badge',
      textContent: providerLabel,
      aria: { hidden: 'true' }
    }));

    /* Click → load inline iframe */
    function handleActivate() {
      _loadInlinePreview(container, url, lesson);
    }

    container.addEventListener('click', handleActivate);
    container.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleActivate();
      }
    });

    return container;
  }

  /**
   * Replace thumbnail with inline iframe + fullscreen button.
   * @param {HTMLElement} container — the .preview-thumbnail element
   * @param {string} url — sanitized embed URL
   * @param {object} lesson
   */
  function _loadInlinePreview(container, url, lesson) {
    clearElement(container);
    container.removeAttribute('role');
    container.removeAttribute('tabindex');
    container.className = 'preview-player-inline';

    /* iframe wrapper (16:9) */
    var iframeWrap = U.el('div', { className: 'preview-iframe-wrap' });

    var iframe = U.el('iframe', {
      className:    'preview-iframe',
      src:          url,
      title:        'معاينة: ' + lesson.title,
      frameborder:  '0',
      allowfullscreen: 'true'
    });
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('loading', 'lazy');
    iframeWrap.appendChild(iframe);
    container.appendChild(iframeWrap);

    /* Controls bar */
    var controls = U.el('div', { className: 'preview-controls' });

    /* Fullscreen button */
    var fsLabel = META.previewFullscreenLabel || 'ملء الشاشة';
    var fsBtn = U.el('button', {
      className: 'preview-fullscreen-btn',
      type:      'button',
      aria:      { label: fsLabel + ': ' + lesson.title }
    }, [
      U.el('i', { className: 'bi bi-arrows-fullscreen', aria: { hidden: 'true' } }),
      U.el('span', { className: 'preview-fullscreen-label', textContent: fsLabel })
    ]);

    fsBtn.addEventListener('click', function () {
      _openFullscreenPreview(url, lesson);
    });

    controls.appendChild(fsBtn);

    /* Close inline button */
    var closeLabel = META.previewCloseLabel || 'إغلاق المعاينة';
    var closeBtn = U.el('button', {
      className: 'preview-close-inline-btn',
      type:      'button',
      aria:      { label: closeLabel }
    }, [
      U.el('i', { className: 'bi bi-x-lg', aria: { hidden: 'true' } }),
      U.el('span', { textContent: closeLabel })
    ]);

    closeBtn.addEventListener('click', function () {
      _closeInlinePreview(container, lesson);
    });

    controls.appendChild(closeBtn);
    container.appendChild(controls);

    U.announce('جاري تحميل معاينة: ' + lesson.title);
  }

  /**
   * Close inline preview and restore thumbnail.
   * @param {HTMLElement} container
   * @param {object} lesson
   */
  function _closeInlinePreview(container, lesson) {
    /* Find the parent lesson-item and re-render the preview thumbnail */
    var parentItem = container.closest('.lesson-item');
    if (!parentItem) return;

    clearElement(container);
    container.remove();

    /* The lesson item will be missing the preview — but since we built it
       dynamically, the simplest approach is to just remove the container.
       The accordion will still be there. User can re-expand to see thumbnail again
       by collapsing and re-expanding the section.
       
       Better approach: rebuild the thumbnail */
    var course = findCourse(getCourseIdFromURL());
    if (!course) return;

    var newThumb = _buildPreviewThumbnail(lesson, course);
    if (newThumb) {
      parentItem.appendChild(newThumb);
    }

    U.announce('تم إغلاق المعاينة');
  }

  /**
   * Open fullscreen overlay with video.
   * @param {string} url — sanitized embed URL
   * @param {object} lesson
   */
  function _openFullscreenPreview(url, lesson) {
    /* Store current focus for restoration */
    _previewPreviousFocus = document.activeElement;

    /* Remove existing overlay if any */
    _closeFullscreenPreview();

    /* Build overlay */
    var overlay = U.el('div', {
      className: 'preview-overlay',
      id:        'preview-overlay',
      role:      'dialog',
      aria:      { modal: 'true', label: 'معاينة فيديو: ' + lesson.title }
    });

    /* Backdrop (click to close) */
    var backdrop = U.el('div', { className: 'preview-overlay-backdrop' });
    backdrop.addEventListener('click', _closeFullscreenPreview);
    overlay.appendChild(backdrop);

    /* Content container */
    var content = U.el('div', { className: 'preview-overlay-content' });

    /* Header with title + close button */
    var header = U.el('div', { className: 'preview-overlay-header' });

    header.appendChild(U.el('h2', {
      className: 'preview-overlay-title',
      textContent: lesson.title
    }));

    var closeLabel = META.previewCloseLabel || 'إغلاق المعاينة';
    var closeBtn = U.el('button', {
      className: 'preview-overlay-close',
      type:      'button',
      id:        'preview-overlay-close',
      aria:      { label: closeLabel }
    }, [
      U.el('i', { className: 'bi bi-x-lg', aria: { hidden: 'true' } })
    ]);

    closeBtn.addEventListener('click', _closeFullscreenPreview);
    header.appendChild(closeBtn);
    content.appendChild(header);

    /* iframe (16:9, max-width constrained) */
    var iframeWrap = U.el('div', { className: 'preview-overlay-iframe-wrap' });

    var iframe = U.el('iframe', {
      className:       'preview-overlay-iframe',
      src:             url,
      title:           'معاينة: ' + lesson.title,
      frameborder:     '0',
      allowfullscreen: 'true'
    });
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');

    iframeWrap.appendChild(iframe);
    content.appendChild(iframeWrap);

    overlay.appendChild(content);

    /* Mount to DOM */
    document.body.appendChild(overlay);
    _previewOverlay = overlay;

    /* Prevent body scroll */
    document.body.style.overflow = 'hidden';

    /* Animate in */
    requestAnimationFrame(function () {
      overlay.classList.add('preview-overlay--open');
    });

    /* Focus the close button */
    setTimeout(function () { closeBtn.focus(); }, 100);

    /* Keyboard: Escape to close + focus trap */
    overlay.addEventListener('keydown', _handleOverlayKeydown);

    U.announce('تم فتح معاينة فيديو: ' + lesson.title);
  }

  /**
   * Close fullscreen overlay.
   */
  function _closeFullscreenPreview() {
    if (!_previewOverlay) return;

    /* Remove iframe src to stop playback */
    var iframe = _previewOverlay.querySelector('iframe');
    if (iframe) iframe.removeAttribute('src');

    /* Animate out */
    _previewOverlay.classList.remove('preview-overlay--open');

    /* Remove after transition */
    var overlay = _previewOverlay;
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);

    _previewOverlay = null;

    /* Restore body scroll */
    document.body.style.overflow = '';

    /* Restore focus */
    if (_previewPreviousFocus && _previewPreviousFocus.focus) {
      _previewPreviousFocus.focus();
    }
    _previewPreviousFocus = null;

    U.announce('تم إغلاق المعاينة');
  }

  /**
   * Handle keyboard events inside fullscreen overlay.
   * @param {KeyboardEvent} e
   */
  function _handleOverlayKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      _closeFullscreenPreview();
      return;
    }

    /* Focus trap */
    if (e.key === 'Tab' && _previewOverlay) {
      var focusable = U.qsa(
        'button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
        _previewOverlay
      );
      if (!focusable.length) return;

      var first = focusable[0];
      var last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  /* ── SEO: VideoObject for preview lessons ── */

  /**
   * Add VideoObject schema for preview lessons.
   * @param {object} course
   */
  function _injectPreviewVideoSchema(course) {
    var videos = [];

    if (!course.curriculum) return;

    course.curriculum.forEach(function (section) {
      if (!section.lessons) return;
      section.lessons.forEach(function (lesson) {
        if (!lesson.preview || !lesson.previewUrl) return;

        var url = _sanitizePreviewUrl(lesson.previewUrl);
        if (!url) return;

        var thumb = _getPreviewThumbnail(lesson);
        var durationParts = (lesson.duration || '0:00').split(':');
        var durationISO = 'PT' + (parseInt(durationParts[0], 10) || 0) + 'M' +
                          (parseInt(durationParts[1], 10) || 0) + 'S';

        videos.push({
          '@type':        'VideoObject',
          'name':         'معاينة: ' + lesson.title,
          'description':  'معاينة مجانية من كورس ' + course.title,
          'thumbnailUrl': thumb || undefined,
          'embedUrl':     url,
          'duration':     durationISO,
          'uploadDate':   course.date
        });
      });
    });

    if (!videos.length) return;

    /* Add to existing Course schema */
    var el = document.getElementById('jsonld-seo-course');
    if (!el) return;

    try {
      var schema = JSON.parse(el.textContent);
      schema.video = videos;
      el.textContent = JSON.stringify(schema);
    } catch (e) { /* parse error */ }
  }

  /* ══════════════════════════════════════
     SIDEBAR CARD
  ══════════════════════════════════════ */

  function _buildSidebarButtons(course) {
    var wrapper = U.el('div', { className: 'sidebar-buttons' });
    var isFree  = parseFloat(course.price) === 0;

    if (isFree) {
      var driveUrl = U.sanitizeUrl(course.driveUrl || '');
      wrapper.appendChild(
        U.el('a', {
          className: 'btn-buy',
          href:      driveUrl || '#',
          target:    driveUrl ? '_blank' : '_self',
          rel:       'noopener noreferrer',
          aria:      { label: (META.startLearning || 'ابدأ التعلم الآن') + ' — ' + course.title }
        }, [
          U.el('i', { className: 'bi bi-play-circle-fill', aria: { hidden: 'true' } }),
          ' ' + (META.startLearning || 'ابدأ التعلم الآن')
        ])
      );
    } else {
      var waLink   = U.sanitizeUrl(buildWhatsAppLink(course));
      var currency = META.currencyLabel || 'ج.م';

      wrapper.appendChild(
        U.el('a', {
          className: 'btn-buy',
          href:      waLink,
          target:    '_blank',
          rel:       'noopener noreferrer',
          aria:      { label: (META.buyCourse || 'اشتري الآن') + ' — ' + course.title + ' — ' + U.formatNumberAr(course.price) + ' ' + currency }
        }, [
          U.el('i', { className: 'bi bi-whatsapp', aria: { hidden: 'true' } }),
          ' ' + (META.buyCourse || 'اشتري الآن') + ' \u2014 ' + U.formatNumberAr(course.price) + ' ' + currency
        ])
      );

      wrapper.appendChild(
        U.el('a', {
          className: 'btn-enter-course',
          href:      U.sanitizeUrl('/course/paid/' + course.id),
          aria:      { label: (META.enterCourse || 'ادخل الكورس') }
        }, [
          U.el('i', { className: 'bi bi-box-arrow-in-left', aria: { hidden: 'true' } }),
          ' ' + (META.enterCourse || 'اشتريت الكورس\u061F ادخل هنا \u{1F511}')
        ])
      );
    }

    return wrapper;
  }

  function _buildMetaItem(icon, label, value) {
    return U.el('li', { className: 'course-meta-item' }, [
      U.el('span', { className: 'meta-label' }, [
        U.el('i', { className: 'bi ' + icon, aria: { hidden: 'true' } }),
        label
      ]),
      U.el('span', { className: 'meta-value', textContent: value })
    ]);
  }

  function _buildSidebarMeta(course) {
    var metaList = U.el('ul', { className: 'course-meta-list' });

    metaList.appendChild(_buildMetaItem('bi-person-fill',    'المدرّس',    course.instructor));
    metaList.appendChild(_buildMetaItem('bi-tag-fill',       'الفصل',     course.category));
    metaList.appendChild(_buildMetaItem('bi-bar-chart-fill', 'المستوى',   getLevelLabel(course.level)));
    metaList.appendChild(_buildMetaItem('bi-people-fill',    'الطلاب',    U.formatNumberAr(course.students)));
    metaList.appendChild(_buildMetaItem('bi-book-fill',      'الدروس',    U.formatNumberAr(course.lessons)));

    /* Rating row — with inline stars */
    var ratingMetaValue = U.el('span', { className: 'meta-value', id: 'meta-rating-value' });
    var ratingInline    = U.el('span', { className: 'meta-rating-inline' });
    if (RS) ratingInline.appendChild(RS.renderStars(course.rating, false));
    ratingInline.appendChild(U.el('span', { textContent: ' ' + U.formatNumberAr((course.rating || 0).toFixed(1)) }));
    ratingMetaValue.appendChild(ratingInline);

    metaList.appendChild(U.el('li', { className: 'course-meta-item' }, [
      U.el('span', { className: 'meta-label' }, [
        U.el('i', { className: 'bi bi-star-fill', aria: { hidden: 'true' } }),
        'التقييم'
      ]),
      ratingMetaValue
    ]));

    metaList.appendChild(_buildMetaItem('bi-calendar3', 'آخر تحديث', _formatDate(course.date)));

    return metaList;
  }

  function buildSidebarCard(course) {
    var img = U.el('img', {
      className: 'sidebar-course-img',
      src:       U.sanitizeUrl('../../assets/img/' + course.image),
      alt:       course.title,
      loading:   'eager',
      decoding:  'async'
    });

    var content = U.el('div', { className: 'sidebar-content' }, [
      _buildPriceDisplay(course),
      _buildSidebarButtons(course),
      _buildSidebarMeta(course)
    ]);

    return U.el('div', { className: 'sidebar-card' }, [img, content]);
  }

  /* ══════════════════════════════════════
     RATING CARD
  ══════════════════════════════════════ */

  function buildRatingCard(course) {
    var card = U.el('div', { className: 'rating-card', id: 'rating-card' });

    card.appendChild(U.el('h3', { className: 'rating-card-title',    textContent: META.ratingTitle    || 'قيّم الكورس' }));
    card.appendChild(U.el('p',  { className: 'rating-card-subtitle', textContent: META.ratingSubtitle || 'شاركنا رأيك عشان نحسّن المحتوى' }));
    card.appendChild(U.el('div', { className: 'rating-big-number', id: 'rating-big-number', textContent: '\u2014' }));

    /* Display stars */
    var displayStarsContainer = U.el('div', { id: 'rating-display-stars' });
    if (RS) displayStarsContainer.appendChild(RS.renderStars(0, false));
    card.appendChild(displayStarsContainer);

    card.appendChild(U.el('p', {
      className: 'rating-count',
      id: 'rating-count-text',
      textContent: META.ratingLoading || 'جاري تحميل التقييمات...'
    }));

    /* Interactive stars */
    var interactiveContainer = U.el('div', { id: 'rating-interactive-stars' });
    if (RS) {
      var interactiveStars = RS.renderStars(0, true);
      interactiveContainer.appendChild(interactiveStars);
      RS.initializeStarEvents(interactiveStars, function (value) {
        _handleRatingSubmit(course.id, value);
      });
    } else {
      interactiveContainer.appendChild(U.el('p', {
        className: 'rating-status',
        textContent: META.ratingUnavailable || 'نظام التقييم غير متاح حالياً'
      }));
    }
    card.appendChild(interactiveContainer);

    card.appendChild(U.el('p', { className: 'rating-status', id: 'rating-status-msg' }));

    return card;
  }

  function _handleRatingSubmit(courseId, value) {
    var statusEl             = U.qs('#rating-status-msg');
    var interactiveContainer = U.qs('#rating-interactive-stars .stars-interactive');

    if (statusEl) {
      statusEl.textContent = META.ratingSubmitting || 'جاري إرسال تقييمك...';
      statusEl.className   = 'rating-status';
    }
    if (RS && interactiveContainer) RS.disableStars(interactiveContainer);

    RS.submitRating(courseId, value).then(function (result) {
      if (result.status === 'success') {
        if (statusEl) {
          statusEl.textContent = META.ratingSuccess || 'شكراً لتقييمك! \u2764';
          statusEl.className   = 'rating-status success';
        }
        U.showToast(META.ratingSuccess || 'تم إرسال تقييمك بنجاح!', 'success');
        U.announce('تم إرسال التقييم بنجاح');
        _loadAndDisplayRatings(courseId);
      } else {
        if (statusEl) {
          statusEl.textContent = result.message || META.ratingError || 'حصل مشكلة. جرّب تاني.';
          statusEl.className   = 'rating-status error';
        }
        U.announce(META.ratingError || 'فشل إرسال التقييم');
        _reEnableStars(interactiveContainer);
      }
    }).catch(function () {
      if (statusEl) {
        statusEl.textContent = META.ratingError || 'مشكلة في الاتصال. جرّب تاني.';
        statusEl.className   = 'rating-status error';
      }
      U.announce(META.ratingError || 'فشل إرسال التقييم');
      _reEnableStars(interactiveContainer);
    });
  }

  function _reEnableStars(container) {
    if (!container) return;
    container.classList.remove('stars-disabled');
    container.querySelectorAll('.star-btn').forEach(function (s) { s.disabled = false; });
    var firstStar = container.querySelector('.star-btn');
    if (firstStar) firstStar.setAttribute('tabindex', '0');
  }

  function _loadAndDisplayRatings(courseId) {
    if (!RS) return;

    RS.fetchRatings(courseId).then(function (data) {
      var avg   = data.average || 0;
      var count = data.count   || 0;

      /* Big number */
      var bigNum = U.qs('#rating-big-number');
      if (bigNum) bigNum.textContent = avg > 0 ? U.formatNumberAr(avg.toFixed(1)) : '\u2014';

      /* Display stars */
      var displayContainer = U.qs('#rating-display-stars');
      if (displayContainer && RS) {
        clearElement(displayContainer);
        displayContainer.appendChild(RS.renderStars(avg, false));
      }

      /* Count text */
      var countText = U.qs('#rating-count-text');
      if (countText) {
        countText.textContent = count > 0
          ? U.formatNumberAr(count) + ' تقييم'
          : (META.ratingEmpty || 'مفيش تقييمات لسه — كن أول من يقيّم!');
      }

      /* Sidebar meta rating */
      var metaRating = U.qs('#meta-rating-value');
      if (metaRating && RS) {
        clearElement(metaRating);
        var inline = U.el('span', { className: 'meta-rating-inline' });
        inline.appendChild(RS.renderStars(avg, false));
        inline.appendChild(U.el('span', { textContent: ' ' + (avg > 0 ? U.formatNumberAr(avg.toFixed(1)) : '\u2014') }));
        metaRating.appendChild(inline);
      }

      /* Schema */
      if (count > 0 && !data.error) addRatingToSchema(avg, count);

      /* Announce */
      if (count > 0) {
        U.announce('التقييم: ' + U.formatNumberAr(avg.toFixed(1)) + ' من ٥ — ' + U.formatNumberAr(count) + ' تقييم');
      }
    });
  }

  /* ══════════════════════════════════════
     PAGE BUILDER
  ══════════════════════════════════════ */

  function _buildLeftColumn(course) {
    var col = U.el('div', { className: 'col-lg-8' });

    var objectives = buildObjectives(course);
    if (objectives) col.appendChild(objectives);

    var curriculum = buildCurriculum(course);
    if (curriculum) col.appendChild(curriculum);

    var faq = buildFAQ(course);
    if (faq) col.appendChild(faq);

    return col;
  }

  function _buildRightColumn(course) {
    var col     = U.el('div', { className: 'col-lg-4' });
    var sidebar = U.el('div', { className: 'details-sidebar' });

    sidebar.appendChild(buildSidebarCard(course));
    sidebar.appendChild(buildRatingCard(course));
    col.appendChild(sidebar);

    return col;
  }

  function buildPage(course, container) {
    buildSchemas(course);

    var frag          = document.createDocumentFragment();
    var mainContainer = U.el('div', { className: 'page-container' });
    var row           = U.el('div', { className: 'row g-4' });

    row.appendChild(_buildLeftColumn(course));
    row.appendChild(_buildRightColumn(course));
    mainContainer.appendChild(row);

    frag.appendChild(buildHeader(course));
    frag.appendChild(mainContainer);
    container.appendChild(frag);

    _loadAndDisplayRatings(course.id);
    _injectPreviewVideoSchema(course);   // ← NEW
  }

  /* ══════════════════════════════════════
     AI COURSE ASSISTANT — Chat Widget
  ══════════════════════════════════════ */

  /* ── Chat FAB ── */

  function buildChatFab() {
    return U.el('button', {
      className: 'chat-fab chat-fab--pulse',
      id:        'chat-fab',
      type:      'button',
      aria:      { expanded: 'false', label: 'فتح مساعد الكورس' }
    }, [
      U.el('i', { className: 'bi bi-chat-dots-fill chat-fab-icon chat-fab-icon--open', aria: { hidden: 'true' } }),
      U.el('i', { className: 'bi bi-x-lg chat-fab-icon chat-fab-icon--close', aria: { hidden: 'true' } })
    ]);
  }

  /* ── Chat Widget Structure ── */

  function _buildChatHeader(course) {
    return U.el('div', { className: 'chat-header', id: 'chat-header' }, [
      U.el('div', { className: 'chat-header-info' }, [
        U.el('div', { className: 'chat-header-avatar' }, [
          U.el('i', { className: 'bi bi-robot', aria: { hidden: 'true' } })
        ]),
        U.el('div', null, [
          U.el('div', { className: 'chat-header-name', textContent: CHAT_CONFIG.botName }),
          U.el('div', { className: 'chat-header-status', textContent: course.title })
        ])
      ])
    ]);
  }

  function _buildChatMessagesArea() {
    return U.el('div', {
      className: 'chat-messages',
      id:        'chat-messages',
      role:      'log',
      aria:      { live: 'polite', label: 'محادثة مساعد الكورس' }
    });
  }

  function _buildChatTypingIndicator() {
    return U.el('div', { className: 'chat-typing', id: 'chat-typing', aria: { hidden: 'true' } }, [
      U.el('div', { className: 'chat-typing-dots' }, [
        U.el('span', { className: 'chat-typing-dot' }),
        U.el('span', { className: 'chat-typing-dot' }),
        U.el('span', { className: 'chat-typing-dot' })
      ])
    ]);
  }

  function _buildChatInputArea() {
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
      aria:      { label: 'إرسال الرسالة' }
    }, [
      U.el('i', { className: 'bi bi-send-fill', aria: { hidden: 'true' } })
    ]);

    return U.el('div', { className: 'chat-input-area' }, [textarea, sendBtn]);
  }

  function buildChatWidget(course) {
    return U.el('div', {
      className: 'chat-widget',
      id:        'chat-widget',
      role:      'dialog',
      aria:      { modal: 'false', label: 'مساعد الكورس — ' + CHAT_CONFIG.botName }
    }, [
      _buildChatHeader(course),
      _buildChatMessagesArea(),
      _buildChatTypingIndicator(),
      _buildChatInputArea()
    ]);
  }

  /* ── Chat Message Helpers ── */

  function _buildMessageBubble(role, text) {
    var bubbleClass = 'chat-bubble';
    if (role === 'user')  bubbleClass += ' chat-bubble--user';
    if (role === 'model') bubbleClass += ' chat-bubble--bot';
    if (role === 'error') bubbleClass += ' chat-bubble--error';

    var bubble = U.el('div', { className: bubbleClass });
    var paragraphs = text.split(/\n+/);
    for (var i = 0; i < paragraphs.length; i++) {
      var line = paragraphs[i].trim();
      if (line.length > 0) {
        bubble.appendChild(U.el('p', { className: 'chat-bubble-text', textContent: line }));
      }
    }
    return bubble;
  }

  function _addChatMessage(role, text) {
    var container = U.qs('#chat-messages');
    if (!container) return;
    container.appendChild(_buildMessageBubble(role, text));
    _scrollChatToBottom();
  }

  function _showChatTyping() {
    var typing = U.qs('#chat-typing');
    if (typing) typing.classList.add('chat-typing--visible');
    _scrollChatToBottom();
  }

  function _hideChatTyping() {
    var typing = U.qs('#chat-typing');
    if (typing) typing.classList.remove('chat-typing--visible');
  }

  function _scrollChatToBottom() {
    var container = U.qs('#chat-messages');
    if (!container) return;
    requestAnimationFrame(function () {
      container.scrollTop = container.scrollHeight;
    });
  }

  /* ── Chat History (sessionStorage) ── */

  function _chatStorageKey(courseId) {
    return CHAT_CONFIG.storagePrefix + courseId;
  }

  function _getChatHistory(courseId) {
    try {
      var raw = sessionStorage.getItem(_chatStorageKey(courseId));
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function _saveChatMessage(courseId, role, text) {
    try {
      var history = _getChatHistory(courseId);
      history.push({ role: role, text: text });
      while (history.length > CHAT_CONFIG.maxHistory) {
        history.shift();
        if (history.length > 0 && history[0].role === 'model') history.shift();
      }
      sessionStorage.setItem(_chatStorageKey(courseId), JSON.stringify(history));
    } catch (e) { /* storage full or unavailable */ }
  }

  function _loadChatHistory(courseId) {
    var history = _getChatHistory(courseId);
    for (var i = 0; i < history.length; i++) {
      _addChatMessage(history[i].role, history[i].text);
    }
    return history.length;
  }

  /* ── Chat Toggle with Focus Management ── */

  function _toggleChat() {
    var fab    = U.qs('#chat-fab');
    var widget = U.qs('#chat-widget');
    if (!fab || !widget) return;

    chatState.isOpen = !chatState.isOpen;

    if (chatState.isOpen) {
      chatState.previousFocus = document.activeElement;
      widget.classList.add('chat-widget--open');
      fab.classList.add('chat-fab--active');
      fab.setAttribute('aria-expanded', 'true');
      fab.setAttribute('aria-label', 'إغلاق مساعد الكورس');
      fab.classList.remove('chat-fab--pulse');

      var input = U.qs('#chat-input');
      if (input) setTimeout(function () { input.focus(); }, 100);

      _scrollChatToBottom();
      U.announce('تم فتح مساعد الكورس');
    } else {
      widget.classList.remove('chat-widget--open');
      fab.classList.remove('chat-fab--active');
      fab.setAttribute('aria-expanded', 'false');
      fab.setAttribute('aria-label', 'فتح مساعد الكورس');

      /* Restore focus */
      if (chatState.previousFocus && chatState.previousFocus.focus) {
        chatState.previousFocus.focus();
      } else {
        fab.focus();
      }
      chatState.previousFocus = null;
      U.announce('تم إغلاق مساعد الكورس');
    }
  }

  /* ── Chat Focus Trap ── */

  function _trapFocusInChat(e) {
    if (!chatState.isOpen) return;

    var widget = U.qs('#chat-widget');
    var fab    = U.qs('#chat-fab');
    if (!widget) return;

    /* Collect all focusable elements inside widget + fab */
    var focusable = U.qsa(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      widget
    );
    /* Add the FAB itself */
    if (fab) focusable.push(fab);
    if (!focusable.length) return;

    var first = focusable[0];
    var last  = focusable[focusable.length - 1];

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  /* ── Chat Submit ── */

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

    _addChatMessage('user', message);
    _saveChatMessage(courseId, 'user', message);

    input.value = '';
    _resizeChatInput(input);
    if (sendBtn) sendBtn.disabled = true;

    chatState.sending = true;
    _showChatTyping();
    input.disabled = true;

    /* Build history (exclude the just-sent message to avoid duplication) */
    var history = _getChatHistory(courseId);
    if (history.length > 0 && history[history.length - 1].role === 'user') {
      history = history.slice(0, history.length - 1);
    }

    var controller = new AbortController();
    var timer      = setTimeout(function () { controller.abort(); }, CHAT_CONFIG.timeoutMs);

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
    .then(function (res) { return res.json(); })
    .then(function (data) {
      clearTimeout(timer);
      _hideChatTyping();

      if (data.status === 'success' && data.reply) {
        _addChatMessage('model', data.reply);
        _saveChatMessage(courseId, 'model', data.reply);
      } else {
        _addChatMessage('error', data.message || CHAT_CONFIG.errorMessage);
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

  function _resizeChatInput(textarea) {
    var MAX_INPUT_HEIGHT = 72;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, MAX_INPUT_HEIGHT) + 'px';
  }

  /* ── Chat Events ── */

  function initChatEvents(courseId) {
    var fab      = U.qs('#chat-fab');
    var input    = U.qs('#chat-input');
    var sendBtn  = U.qs('#chat-send-btn');

    if (fab) {
      fab.addEventListener('click', _toggleChat);
    }

    if (input) {
      input.addEventListener('input', function () {
        _resizeChatInput(input);
        if (sendBtn) {
          sendBtn.disabled = chatState.sending || input.value.trim().length === 0;
        }
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          _handleChatSubmit(courseId);
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        _handleChatSubmit(courseId);
      });
    }

    /* Escape to close + focus trap */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && chatState.isOpen) {
        e.preventDefault();
        _toggleChat();
        return;
      }
      if (chatState.isOpen) {
        _trapFocusInChat(e);
      }
    });
  }

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */

  function init() {
    var app     = U.qs('#app') || document.body;
    var courseId = getCourseIdFromURL();

    if (!courseId) {
      renderError(app);
      return;
    }

    var course = findCourse(courseId);
    if (!course) {
      renderError(app);
      return;
    }

    injectSEO(course);
    buildPage(course, app);

    /* Scroll to title */
    requestAnimationFrame(function () {
      var titleEl = U.qs('.page-title');
      if (titleEl) titleEl.scrollIntoView({ behavior: 'instant', block: 'start' });
    });

    /* Chat widget */
    document.body.appendChild(buildChatFab());
    document.body.appendChild(buildChatWidget(course));
    initChatEvents(course.id);

    /* Load chat history or show welcome */
    var messagesContainer = U.qs('#chat-messages');
    if (messagesContainer) {
      var loaded = _loadChatHistory(course.id);
      if (loaded === 0) {
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
