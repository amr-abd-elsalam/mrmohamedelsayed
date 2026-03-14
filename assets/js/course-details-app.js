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

  var BRAND_NAME = DATA.BRAND_NAME || 'مستر محمد السيد';
  var DOMAIN     = DATA.DOMAIN     || 'mrmohamedelsayed.com';

  /* ── Chat Config (white-label via COURSE_DATA.META) ── */

  var CHAT_CONFIG = {
    botName:        (DATA.META && DATA.META.chatBotName)        || 'مساعد الكورس',
    welcomeMessage: (DATA.META && DATA.META.chatWelcomeMessage) || 'مرحباً! أنا هنا عشان أساعدك بأي سؤال عن الكورس. اسألني أي حاجة!',
    placeholder:    (DATA.META && DATA.META.chatPlaceholder)    || 'اكتب سؤالك هنا...',
    errorMessage:   (DATA.META && DATA.META.chatErrorMessage)   || 'حصل مشكلة في الاتصال. جرّب تاني.',
    maxMessageLen:  500,
    maxHistory:     20,
    storagePrefix:  'mrelsayed_chat_'
  };

  /* ── Chat State ── */

  var chatState = {
    isOpen:  false,
    sending: false
  };

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

  /* ── SEO Injection ── */

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

    var hreflang = document.getElementById('hreflang-ar') || document.getElementById('hreflang-en');
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
      'inLanguage':       course.language || 'ar',
      'offers': {
        '@type':        'Offer',
        'price':        course.price,
        'priceCurrency': 'EGP',
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

  function buildSchema(course) {
    var base    = 'https://' + DATA.DOMAIN;
    var pageUrl = base + '/course/course-details/?id=' + course.id;
    var schemas = [];

    schemas.push({
      '@context':   'https://schema.org',
      '@type':      'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1,
          'name': 'الرئيسية', 'item': base + '/' },
        { '@type': 'ListItem', 'position': 2,
          'name': 'الكورسات', 'item': base + '/course/' },
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

  function buildWhatsAppLink(course) {
    var phone   = DATA.WHATSAPP_NUMBER || '';
    var price   = course.price > 0
      ? U.formatNumberAr(course.price) + ' ج.م'
      : 'مجاني';
    var message = 'مرحباً، أريد شراء كورس "' +
                  course.title + '" \u2014 السعر: ' + price;
    return 'https://wa.me/' + phone +
           '?text=' + encodeURIComponent(message);
  }

  /* ── Format helpers ── */

  function _formatPrice(price) {
    if (parseFloat(price) === 0) return 'مجاني';
    return U.formatNumberAr(price) + ' ج.م';
  }

  function _formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) { return dateStr; }
  }

  /* ── Error Page ── */

  function renderError(container) {
    document.title = 'الكورس غير موجود | ' + BRAND_NAME;
    setNoIndex();
    container.appendChild(
      U.el('div', { className: 'error-container' }, [
        U.el('i',  { className: 'bi bi-exclamation-triangle error-icon',
                     aria: { hidden: 'true' } }),
        U.el('h1', { className: 'error-title',
                     textContent: 'الكورس غير موجود' }),
        U.el('p',  { className: 'error-text',
                     textContent: 'الكورس اللي بتدور عليه مش موجود. ممكن يكون اتحذف أو الرابط غلط.' }),
        U.el('a',  { className: 'error-btn', href: '../index.html' }, [
          U.el('i', { className: 'bi bi-arrow-right',
                      aria: { hidden: 'true' } }),
          'تصفح الكورسات'
        ])
      ])
    );
  }

  /* ── Breadcrumb ── */

  function buildBreadcrumb(course) {
    var ol = U.el('ol', { className: 'breadcrumb' });

    var li1 = U.el('li', { className: 'breadcrumb-item' });
    li1.appendChild(U.el('a', { href: '../../index.html', textContent: 'الرئيسية' }));
    ol.appendChild(li1);

    var li2 = U.el('li', { className: 'breadcrumb-item' });
    li2.appendChild(U.el('a', { href: '../index.html', textContent: 'الكورسات' }));
    ol.appendChild(li2);

    var li3 = U.el('li', {
      className: 'breadcrumb-item active',
      aria:      { current: 'page' }
    });
    li3.appendChild(U.el('span', { textContent: course.title }));
    ol.appendChild(li3);

    var nav = U.el('nav', {
      className: 'breadcrumb-nav',
      aria:      { label: 'مسار التنقل' }
    }, [ol]);

    return nav;
  }

  /* ── Header ── */

  function buildHeader(course) {
    return U.el('header', {
      className: 'details-header',
      style:     { paddingTop: '0.5rem' }
    }, [
      U.el('div', { className: 'page-container' }, [
        U.el('a', { className: 'back-link', href: '../index.html' }, [
          U.el('i', { className: 'bi bi-arrow-right', aria: { hidden: 'true' } }),
          'العودة للكورسات'
        ]),
        buildBreadcrumb(course),
        U.el('h1', { className: 'page-title', textContent: course.title })
      ])
    ]);
  }

  /* ── Section Title Helper ── */

  function _buildSectionTitle(iconClass, titleText) {
    return U.el('h2', {
      className: 'details-section-title'
    }, [
      U.el('i', { className: iconClass, aria: { hidden: 'true' } }),
      titleText
    ]);
  }

  /* ── Learning Objectives ── */

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
      aria:      { label: 'هتتعلم إيه' }
    }, [
      _buildSectionTitle('bi bi-lightbulb', 'هتتعلم إيه'),
      list
    ]);
  }

  /* ── Curriculum ── */

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
    var durationText = (totalHours > 0 ? U.formatNumberAr(totalHours) + ' ساعة ' : '') + U.formatNumberAr(totalMins) + ' دقيقة';

    var summaryLine = U.el('p', {
      className:   'mb-3 curriculum-summary',
      textContent: U.formatNumberAr(course.curriculum.length) + ' أقسام \u2022 ' +
                   U.formatNumberAr(totalLessons) + ' درس \u2022 ' + durationText
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
        aria:      { expanded: sIdx === 0 ? 'true' : 'false', controls: bodyId }
      });

      var btnContent = U.el('span', { className: 'curriculum-btn-content' });
      btnContent.appendChild(U.el('span', {
        textContent: section.title,
        className:   'curriculum-section-title'
      }));
      btnContent.appendChild(U.el('span', {
        className:   'curriculum-section-meta',
        textContent: U.formatNumberAr(sectionLessons) + ' درس \u2022 ' + U.formatNumberAr(sectionDurMin) + ' د'
      }));
      btn.appendChild(btnContent);

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
            metaEl.appendChild(U.el('span', { className: 'lesson-preview-badge', textContent: 'معاينة' }));
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
      aria:      { label: 'محتوى الكورس' }
    }, [
      _buildSectionTitle('bi bi-journal-text', 'محتوى الكورس'),
      summaryLine,
      accordion
    ]);
  }

  /* ── FAQ ── */

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
      aria:      { label: 'أسئلة شائعة' }
    }, [
      _buildSectionTitle('bi bi-question-circle', 'أسئلة شائعة'),
      accordion
    ]);
  }

  /* ── Price Display Builder ── */

  function _buildPriceDisplay(course) {
    var isFree = parseFloat(course.price) === 0;

    if (isFree) {
      return U.el('div', {
        className: 'price-display'
      }, [
        U.el('span', {
          className:   'price-current free',
          textContent: 'مجاني'
        })
      ]);
    }

    var currentPrice = parseFloat(course.price);
    var originalPrice = parseFloat(course.originalPrice) || 0;
    var hasDiscount = originalPrice > currentPrice && currentPrice > 0;

    if (!hasDiscount) {
      return U.el('div', {
        className: 'price-display',
        aria:      { label: 'السعر: ' + U.formatNumberAr(currentPrice) + ' ج.م' }
      }, [
        U.el('span', {
          className:   'price-current',
          textContent: U.formatNumberAr(currentPrice) + ' ج.م',
          aria:        { hidden: 'true' }
        })
      ]);
    }

    var discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
    var savedAmount     = originalPrice - currentPrice;

    var ariaText = 'السعر الأصلي ' + U.formatNumberAr(originalPrice) + ' ج.م' +
                   '، الآن ' + U.formatNumberAr(currentPrice) + ' ج.م' +
                   '، خصم ' + U.formatNumberAr(discountPercent) + '%، وفرت ' + U.formatNumberAr(savedAmount) + ' ج.م';

    return U.el('div', {
      className: 'price-display',
      aria:      { label: ariaText }
    }, [
      U.el('span', {
        className:   'price-original',
        textContent: U.formatNumberAr(originalPrice) + ' ج.م',
        aria:        { hidden: 'true' }
      }),
      U.el('span', {
        className:   'price-current',
        textContent: U.formatNumberAr(currentPrice) + ' ج.م',
        aria:        { hidden: 'true' }
      }),
      U.el('span', {
        className: 'price-discount',
        aria:      { hidden: 'true' }
      }, [
        'خصم ' + U.formatNumberAr(discountPercent) + '%',
        U.el('span', { className: 'price-discount-dot', textContent: '\u00B7' }),
        'وفر ' + U.formatNumberAr(savedAmount) + ' ج.م'
      ])
    ]);
  }

  /* ── Sidebar Card ── */

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

    var buttonsWrapper = U.el('div', { className: 'sidebar-buttons' });

    if (isFree) {
      var driveUrl = U.sanitizeUrl(course.driveUrl || '');
      buttonsWrapper.appendChild(
        U.el('a', {
          className: 'btn-buy',
          href:      driveUrl || '#',
          target:    driveUrl ? '_blank' : '_self',
          rel:       'noopener noreferrer',
          aria:      { label: 'ابدأ تعلم ' + course.title + ' مجاناً' }
        }, [
          U.el('i', { className: 'bi bi-play-circle-fill', aria: { hidden: 'true' } }),
          ' ابدأ التعلم الآن'
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
            label: 'اشتري كورس ' + course.title +
                   ' بسعر ' + U.formatNumberAr(course.price) + ' ج.م عبر واتساب'
          }
        }, [
          U.el('i', { className: 'bi bi-whatsapp', aria: { hidden: 'true' } }),
          ' اشتري الآن \u2014 ' + U.formatNumberAr(course.price) + ' ج.م'
        ])
      );

      buttonsWrapper.appendChild(
        U.el('a', {
          className: 'btn-enter-course',
          href:      '/course/paid/' + course.id,
          aria:      { label: 'دخول الكورس — تسجيل الدخول للمشتركين' }
        }, [
          U.el('i', { className: 'bi bi-box-arrow-in-left', aria: { hidden: 'true' } }),
          ' اشتريت الكورس\u061F ادخل هنا \u{1F511}'
        ])
      );
    }

    var metaList = U.el('ul', { className: 'course-meta-list' });
    metaList.appendChild(_buildMetaItem('bi-person-fill',    'المدرّس',    course.instructor));
    metaList.appendChild(_buildMetaItem('bi-tag-fill',       'الفصل',     course.category));
    metaList.appendChild(_buildMetaItem('bi-bar-chart-fill', 'المستوى',   course.level));
    metaList.appendChild(_buildMetaItem('bi-people-fill',    'الطلاب',    U.formatNumberAr(course.students)));
    metaList.appendChild(_buildMetaItem('bi-book-fill',      'الدروس',    U.formatNumberAr(course.lessons)));

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

    var content = U.el('div', { className: 'sidebar-content' }, [priceEl, buttonsWrapper, metaList]);
    return U.el('div', { className: 'sidebar-card' }, [img, content]);
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

  /* ── Rating Card ── */

  function buildRatingCard(course) {
    var card = U.el('div', { className: 'rating-card', id: 'rating-card' });

    card.appendChild(U.el('h3', { className: 'rating-card-title',    textContent: 'قيّم الكورس' }));
    card.appendChild(U.el('p',  { className: 'rating-card-subtitle', textContent: 'شاركنا رأيك عشان نحسّن المحتوى' }));

    card.appendChild(U.el('div', { className: 'rating-big-number', id: 'rating-big-number', textContent: '\u2014' }));

    var displayStarsContainer = U.el('div', { id: 'rating-display-stars' });
    if (RS) displayStarsContainer.appendChild(RS.renderStars(0, false));
    card.appendChild(displayStarsContainer);

    card.appendChild(U.el('p', { className: 'rating-count', id: 'rating-count-text', textContent: 'جاري تحميل التقييمات...' }));

    var interactiveContainer = U.el('div', { id: 'rating-interactive-stars' });
    if (RS) {
      var interactiveStars = RS.renderStars(0, true);
      interactiveContainer.appendChild(interactiveStars);
      RS.initializeStarEvents(interactiveStars, function (value) {
        _handleRatingSubmit(course.id, value);
      });
    } else {
      interactiveContainer.appendChild(U.el('p', { className: 'rating-status', textContent: 'نظام التقييم غير متاح حالياً' }));
    }
    card.appendChild(interactiveContainer);
    card.appendChild(U.el('p', { className: 'rating-status', id: 'rating-status-msg' }));

    return card;
  }

  function _handleRatingSubmit(courseId, value) {
    var statusEl             = U.qs('#rating-status-msg');
    var interactiveContainer = U.qs('#rating-interactive-stars .stars-interactive');

    if (statusEl) { statusEl.textContent = 'جاري إرسال تقييمك...'; statusEl.className = 'rating-status'; }
    if (RS && interactiveContainer) RS.disableStars(interactiveContainer);

    RS.submitRating(courseId, value).then(function (result) {
      if (result.status === 'success') {
        if (statusEl) { statusEl.textContent = 'شكراً لتقييمك! \u2764'; statusEl.className = 'rating-status success'; }
        U.showToast('تم إرسال تقييمك بنجاح!', 'success');
        U.announce('تم إرسال التقييم بنجاح');
        _loadAndDisplayRatings(courseId);
      } else {
        if (statusEl) {
          statusEl.textContent = result.message || 'حصل مشكلة. جرّب تاني.';
          statusEl.className   = 'rating-status error';
        }
        _reEnableStars(interactiveContainer);
      }
    }).catch(function () {
      if (statusEl) {
        statusEl.textContent = 'مشكلة في الاتصال. جرّب تاني.';
        statusEl.className = 'rating-status error';
      }
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

      var bigNum = U.qs('#rating-big-number');
      if (bigNum) bigNum.textContent = avg > 0 ? U.formatNumberAr(avg.toFixed(1)) : '\u2014';

      var displayContainer = U.qs('#rating-display-stars');
      if (displayContainer && RS) {
        clearElement(displayContainer);
        displayContainer.appendChild(RS.renderStars(avg, false));
      }

      var countText = U.qs('#rating-count-text');
      if (countText) {
        countText.textContent = count > 0
          ? U.formatNumberAr(count) + ' تقييم'
          : 'مفيش تقييمات لسه \u2014 كن أول من يقيّم!';
      }

      var metaRating = U.qs('#meta-rating-value');
      if (metaRating && RS) {
        clearElement(metaRating);
        var inline = U.el('span', { className: 'meta-rating-inline' });
        inline.appendChild(RS.renderStars(avg, false));
        inline.appendChild(U.el('span', { textContent: ' ' + (avg > 0 ? U.formatNumberAr(avg.toFixed(1)) : '\u2014') }));
        metaRating.appendChild(inline);
      }

      if (count > 0 && !data.error) addRatingToSchema(avg, count);
    });
  }

  /* ── Utilities ── */

  function clearElement(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  /* ── Page Builder ── */

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

  function buildChatFab() {
    var fab = U.el('button', {
      className: 'chat-fab chat-fab--pulse',
      id:        'chat-fab',
      type:      'button',
      aria:      { expanded: 'false', label: 'فتح مساعد الكورس' }
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

  function buildChatWidget(course) {
    /* ── Header — removed the second close button next to name ── */
    var header = U.el('div', { className: 'chat-header', id: 'chat-header' }, [
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

    /* ── Messages ── */
    var messages = U.el('div', {
      className: 'chat-messages',
      id:        'chat-messages',
      role:      'log',
      aria:      { live: 'polite', label: 'محادثة مساعد الكورس' }
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
      aria:      { label: 'إرسال الرسالة' }
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

  function _buildTypingIndicator() {
    return U.el('div', { className: 'chat-typing-dots' }, [
      U.el('span', { className: 'chat-typing-dot' }),
      U.el('span', { className: 'chat-typing-dot' }),
      U.el('span', { className: 'chat-typing-dot' })
    ]);
  }

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
        bubble.appendChild(U.el('p', {
          className:   'chat-bubble-text',
          textContent: line
        }));
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

  function _chatStorageKey(courseId) {
    return CHAT_CONFIG.storagePrefix + courseId;
  }

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

  function _saveChatMessage(courseId, role, text) {
    try {
      var history = _getChatHistory(courseId);
      history.push({ role: role, text: text });
      while (history.length > CHAT_CONFIG.maxHistory) {
        history.shift();
        if (history.length > 0 && history[0].role === 'model') {
          history.shift();
        }
      }
      sessionStorage.setItem(_chatStorageKey(courseId), JSON.stringify(history));
    } catch (e) {}
  }

  function _loadChatHistory(courseId) {
    var history = _getChatHistory(courseId);
    if (history.length === 0) return;
    for (var i = 0; i < history.length; i++) {
      _addChatMessage(history[i].role, history[i].text);
    }
  }

  function _toggleChat() {
    var fab    = U.qs('#chat-fab');
    var widget = U.qs('#chat-widget');
    if (!fab || !widget) return;

    chatState.isOpen = !chatState.isOpen;

    if (chatState.isOpen) {
      widget.classList.add('chat-widget--open');
      fab.classList.add('chat-fab--active');
      fab.setAttribute('aria-expanded', 'true');
      fab.setAttribute('aria-label', 'إغلاق مساعد الكورس');
      fab.classList.remove('chat-fab--pulse');

      var input = U.qs('#chat-input');
      if (input) {
        setTimeout(function () { input.focus(); }, 100);
      }
      _scrollChatToBottom();
    } else {
      widget.classList.remove('chat-widget--open');
      fab.classList.remove('chat-fab--active');
      fab.setAttribute('aria-expanded', 'false');
      fab.setAttribute('aria-label', 'فتح مساعد الكورس');
      fab.focus();
    }
  }

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

    var history = _getChatHistory(courseId);
    if (history.length > 0 && history[history.length - 1].role === 'user') {
      history = history.slice(0, history.length - 1);
    }

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
    textarea.style.height = 'auto';
    var maxHeight = 72;
    var scrollH   = textarea.scrollHeight;
    textarea.style.height = Math.min(scrollH, maxHeight) + 'px';
  }

  function initChatEvents(courseId) {
    var fab      = U.qs('#chat-fab');
    var input    = U.qs('#chat-input');
    var sendBtn  = U.qs('#chat-send-btn');

    if (fab) {
      fab.addEventListener('click', function () {
        _toggleChat();
      });
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

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && chatState.isOpen) {
        _toggleChat();
      }
    });
  }

  /* ── Init ── */

  function init() {
    var app      = U.qs('#app') || document.body;
    var courseId = getCourseIdFromURL();

    if (!courseId) { renderError(app); return; }

    var course = findCourse(courseId);
    if (!course) { renderError(app); return; }

    injectSEO(course);
    buildPage(course, app);

    requestAnimationFrame(function () {
      var titleEl = U.qs('.page-title');
      if (titleEl) {
        titleEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });

    document.body.appendChild(buildChatFab());
    document.body.appendChild(buildChatWidget(course));
    initChatEvents(course.id);

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
