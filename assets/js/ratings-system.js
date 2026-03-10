'use strict';

/**
 * ratings-system.js — Standalone Rating Module
 *
 * Handles fetching, submitting, and rendering course ratings.
 * Communicates with the Cloudflare Worker proxy at /api/ratings.
 * Uses in-memory cache (Map) with 5-minute TTL.
 * Supports half-star display and interactive star input with keyboard navigation.
 *
 * IP detection is handled server-side by the Worker (CF-Connecting-IP).
 *
 * Dependencies: Utils (window.Utils)
 * Exports: window.RatingSystem (frozen) or null if Utils is missing
 */

var RatingSystem = (function () {

  var U = window.Utils;
  if (!U) {
    console.error('RatingSystem: Utils not found.');
    return null;
  }

  /* ── Configuration ── */

  var CONFIG = Object.freeze({
    API_ENDPOINT: '/api/ratings',
    CACHE_TTL: 5 * 60 * 1000,    // 5 minutes in ms
    MAX_RETRIES: 3,
    TIMEOUT: 8000,                // 8 seconds
    RETRY_DELAYS: [1000, 2000, 4000], // Exponential backoff
    MAX_RATING: 5,
    MIN_RATING: 1
  });

  /* ── Cache ── */

  var _cache = new Map();

  /**
   * Get cached ratings for a course
   * @param {number} courseId
   * @returns {object|null} Cached data or null if expired/missing
   */
  function _getCached(courseId) {
    var key = 'ratings_' + courseId;
    if (!_cache.has(key)) return null;
    var entry = _cache.get(key);
    if (Date.now() - entry.timestamp > CONFIG.CACHE_TTL) {
      _cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Store ratings in cache
   * @param {number} courseId
   * @param {object} data - { average, count }
   */
  function _setCache(courseId, data) {
    _cache.set('ratings_' + courseId, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cached ratings for a specific course
   * @param {number} courseId
   */
  function _clearCache(courseId) {
    _cache.delete('ratings_' + courseId);
  }

  /* ── Fetch with Retry & Timeout ── */

  /**
   * Fetch with automatic retry and AbortController timeout
   * @param {string} url
   * @param {object} options - fetch options
   * @param {number} attempt - current attempt number (0-indexed)
   * @param {number} maxRetries - maximum number of attempts (default: CONFIG.MAX_RETRIES)
   * @returns {Promise<Response>}
   */
  function _fetchWithRetry(url, options, attempt, maxRetries) {
    attempt = attempt || 0;
    maxRetries = (maxRetries !== undefined) ? maxRetries : CONFIG.MAX_RETRIES;

    return new Promise(function (resolve, reject) {
      var controller = new AbortController();
      var timeoutId = setTimeout(function () {
        controller.abort();
      }, CONFIG.TIMEOUT);

      var fetchOptions = Object.assign({}, options || {}, {
        signal: controller.signal
      });

      fetch(url, fetchOptions)
        .then(function (response) {
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error('HTTP ' + response.status);
          }
          return response.json();
        })
        .then(resolve)
        .catch(function (err) {
          clearTimeout(timeoutId);
          if (attempt < maxRetries - 1) {
            var delay = CONFIG.RETRY_DELAYS[attempt] || 4000;
            setTimeout(function () {
              _fetchWithRetry(url, options, attempt + 1, maxRetries).then(resolve).catch(reject);
            }, delay);
          } else {
            reject(err);
          }
        });
    });
  }

  /* ── API Methods ── */

  /**
   * Fetch ratings for a course from API (with cache)
   * @param {number} courseId
   * @returns {Promise<{average: number, count: number}>}
   */
  function fetchRatings(courseId) {
    // Check cache first
    var cached = _getCached(courseId);
    if (cached) return Promise.resolve(cached);

    var url = CONFIG.API_ENDPOINT + '?courseId=' + encodeURIComponent(courseId);

    return _fetchWithRetry(url, { method: 'GET' })
      .then(function (data) {
        var result = {
          average: parseFloat(data.average) || 0,
          count: parseInt(data.count, 10) || 0
        };
        _setCache(courseId, result);
        return result;
      })
      .catch(function (err) {
        console.warn('RatingSystem: Failed to fetch ratings for course ' + courseId, err);
        return { average: 0, count: 0, error: true };
      });
  }

  /**
   * Submit a new rating for a course.
   * IP is injected server-side by the Cloudflare Worker.
   * No retries — POST is not idempotent (server-side IP dedup mitigates but does not eliminate risk).
   *
   * @param {number} courseId
   * @param {number} ratingValue - 1 to 5
   * @returns {Promise<{status: string, message?: string}>}
   */
  function submitRating(courseId, ratingValue) {
    // Validate rating
    ratingValue = parseInt(ratingValue, 10);
    if (isNaN(ratingValue) || ratingValue < CONFIG.MIN_RATING || ratingValue > CONFIG.MAX_RATING) {
      return Promise.resolve({
        status: 'error',
        message: 'Invalid rating value: must be between 1 and 5'
      });
    }

    var body = JSON.stringify({
      courseId: courseId,
      rating: ratingValue
    });

    return _fetchWithRetry(CONFIG.API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    }, 0, 1).then(function (data) {
      if (data.status === 'success') {
        // Clear cache so next fetch gets fresh data
        _clearCache(courseId);
      }
      return data;
    }).catch(function (err) {
      console.warn('RatingSystem: Failed to submit rating', err);
      return { status: 'error', message: err.message || 'Failed to submit rating' };
    });
  }

  /* ── Star Rendering ── */

  /**
   * Render star icons (supports half stars for display)
   * @param {number} rating - e.g. 4.5
   * @param {boolean} isInteractive - if true, renders clickable stars
   * @returns {HTMLElement} Container with star elements
   */
  function renderStars(rating, isInteractive) {
    rating = parseFloat(rating) || 0;
    var container = U.el('div', {
      className: 'stars-container' + (isInteractive ? ' stars-interactive' : ' stars-display'),
      role: isInteractive ? 'radiogroup' : 'img',
      aria: isInteractive
        ? { label: 'Rate this course from 1 to 5 stars' }
        : { label: 'Rating: ' + rating.toFixed(1) + ' out of 5 stars' }
    });

    for (var i = 1; i <= CONFIG.MAX_RATING; i++) {
      var starEl;

      if (isInteractive) {
        // Interactive: full stars only, rendered as buttons
        starEl = U.el('button', {
          type: 'button',
          className: 'star-btn',
          dataset: { value: String(i) },
          aria: { label: i + ' star' + (i > 1 ? 's' : '') },
          role: 'radio',
          tabindex: i === 1 ? '0' : '-1'
        }, [
          U.el('i', {
            className: 'bi bi-star',
            aria: { hidden: 'true' }
          })
        ]);
      } else {
        // Display: supports half stars
        var iconClass;
        if (rating >= i) {
          iconClass = 'bi bi-star-fill';
        } else if (rating >= i - 0.5) {
          iconClass = 'bi bi-star-half';
        } else {
          iconClass = 'bi bi-star';
        }
        starEl = U.el('span', { className: 'star-display', aria: { hidden: 'true' } }, [
          U.el('i', { className: iconClass })
        ]);
      }
      container.appendChild(starEl);
    }

    return container;
  }

  /**
   * Initialize interactive star events (hover, click, keyboard)
   * @param {HTMLElement} container - The stars-interactive container
   * @param {function} onClickCallback - Called with rating value (1-5) on selection
   */
  function initializeStarEvents(container, onClickCallback) {
    if (!container) return;

    var stars = Array.from(container.querySelectorAll('.star-btn'));
    if (!stars.length) return;

    // Highlight stars up to a given value
    function highlightUpTo(value) {
      stars.forEach(function (s) {
        var v = parseInt(s.dataset.value, 10);
        var icon = s.querySelector('i');
        if (!icon) return;
        if (v <= value) {
          icon.className = 'bi bi-star-fill';
          s.classList.add('star-active');
        } else {
          icon.className = 'bi bi-star';
          s.classList.remove('star-active');
        }
      });
    }

    // Reset to no highlight
    function resetHighlight() {
      var selected = container.dataset.selectedValue;
      if (selected) {
        highlightUpTo(parseInt(selected, 10));
      } else {
        stars.forEach(function (s) {
          var icon = s.querySelector('i');
          if (icon) icon.className = 'bi bi-star';
          s.classList.remove('star-active');
        });
      }
    }

    // Hover events
    stars.forEach(function (star) {
      star.addEventListener('mouseenter', function () {
        if (container.classList.contains('stars-disabled')) return;
        highlightUpTo(parseInt(star.dataset.value, 10));
      });

      star.addEventListener('mouseleave', function () {
        if (container.classList.contains('stars-disabled')) return;
        resetHighlight();
      });

      // Click event
      star.addEventListener('click', function () {
        if (container.classList.contains('stars-disabled')) return;
        var value = parseInt(star.dataset.value, 10);
        container.dataset.selectedValue = String(value);
        highlightUpTo(value);

        // Update aria-checked for radio role
        stars.forEach(function (s) {
          s.setAttribute('aria-checked', s.dataset.value === String(value) ? 'true' : 'false');
        });

        if (typeof onClickCallback === 'function') {
          onClickCallback(value);
        }
      });
    });

    // Keyboard navigation (Arrow keys + Enter/Space)
    container.addEventListener('keydown', function (e) {
      if (container.classList.contains('stars-disabled')) return;

      var focused = document.activeElement;
      var idx = stars.indexOf(focused);
      if (idx === -1) return;

      var newIdx = idx;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          newIdx = Math.min(idx + 1, stars.length - 1);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          newIdx = Math.max(idx - 1, 0);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          focused.click();
          return;
        default:
          return;
      }

      // Move focus using roving tabindex
      stars[idx].setAttribute('tabindex', '-1');
      stars[newIdx].setAttribute('tabindex', '0');
      stars[newIdx].focus();
      highlightUpTo(parseInt(stars[newIdx].dataset.value, 10));
    });
  }

  /**
   * Disable interactive stars (after submission)
   * @param {HTMLElement} container
   */
  function disableStars(container) {
    if (!container) return;
    container.classList.add('stars-disabled');
    var stars = container.querySelectorAll('.star-btn');
    stars.forEach(function (s) {
      s.disabled = true;
      s.setAttribute('tabindex', '-1');
    });
  }

  /* ── Public API ── */

  return Object.freeze({
    fetchRatings: fetchRatings,
    submitRating: submitRating,
    renderStars: renderStars,
    initializeStarEvents: initializeStarEvents,
    disableStars: disableStars
  });

})();

if (typeof window !== 'undefined' && RatingSystem) window.RatingSystem = RatingSystem;