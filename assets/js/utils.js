'use strict';

var Utils = (function () {

  var _ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;', '`': '&#96;' };
  var _ESC_RE = /[&<>"'\/`]/g;

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(_ESC_RE, function (c) { return _ESC_MAP[c]; });
  }

  function escapeAttr(s) {
    if (s == null) return '';
    return String(s).replace(/[^a-zA-Z0-9,.\-_\s]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
  }

  var SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

  function sanitizeUrl(url) {
    if (url == null) return '';
    var s = String(url).trim();
    if (!s) return '';
    if (s[0] === '/' || s.indexOf('./') === 0 || s.indexOf('../') === 0 || s[0] === '#') return s;
    try { var p = new URL(s); if (SAFE_PROTOCOLS.indexOf(p.protocol) !== -1) return s; } catch (e) {}
    return '';
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null) return;
        if (k === 'className') e.className = v;
        else if (k === 'textContent') e.textContent = v;
        else if (k === 'innerHTML') { console.warn('el: innerHTML blocked'); }
        else if (k === 'dataset') { Object.keys(v).forEach(function (dk) { e.dataset[dk] = v[dk]; }); }
        else if (k === 'aria') { Object.keys(v).forEach(function (ak) { e.setAttribute('aria-' + ak, v[ak]); }); }
        else if (k === 'events') { Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); }); }
        else if (k === 'style' && typeof v === 'object') { Object.keys(v).forEach(function (sp) { e.style[sp] = v[sp]; }); }
        else e.setAttribute(k, v);
      });
    }
    if (children) {
      children.forEach(function (c) {
        if (c == null) return;
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else if (c instanceof Node) e.appendChild(c);
      });
    }
    return e;
  }

  function buildSafeLink(href, text, attrs) {
    var safe = sanitizeUrl(href);
    return el('a', Object.assign({}, attrs || {}, { href: safe || '#' }), [text]);
  }

  // Toast
  var _toastHistory = new Map();
  function showToast(msg, type) {
    type = type || 'info';
    var box = document.querySelector('.toast-container');
    if (!box) { box = el('div', { className: 'toast-container position-fixed bottom-0 end-0 p-3' }); document.body.appendChild(box); }
    var key = type + ':' + msg, now = Date.now();
    if (_toastHistory.has(key) && now - _toastHistory.get(key) < 2000) return;
    _toastHistory.set(key, now);
    var existing = box.querySelectorAll('.toast');
    if (existing.length >= 3) { try { bootstrap.Toast.getInstance(existing[0]).hide(); } catch (e) { existing[0].remove(); } }
    var close = el('button', { type: 'button', className: 'btn-close btn-close-white me-2 m-auto', aria: { label: 'Close' } });
    close.setAttribute('data-bs-dismiss', 'toast');
    var t = el('div', { className: 'toast align-items-center text-bg-' + type + ' border-0 show', role: 'alert', aria: { live: 'assertive', atomic: 'true' } }, [el('div', { className: 'd-flex' }, [el('div', { className: 'toast-body', textContent: msg }), close])]);
    box.appendChild(t);
    try { var bt = new bootstrap.Toast(t, { delay: 5000 }); t.addEventListener('hidden.bs.toast', function () { t.remove(); }); bt.show(); }
    catch (e) { setTimeout(function () { if (t.parentNode) t.remove(); }, 5000); }
  }

  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.from((r || document).querySelectorAll(s)); }

  function debounce(fn, d) {
    var t; return function () { var c = this, a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, d); };
  }
  function throttle(fn, l) {
    var w = false; return function () { if (!w) { fn.apply(this, arguments); w = true; setTimeout(function () { w = false; }, l); } };
  }

  function announce(text, priority) {
    priority = priority || 'polite';
    var id = 'sr-' + priority, a = document.getElementById(id);
    if (!a) { a = el('div', { id: id, className: 'visually-hidden', aria: { live: priority, atomic: 'true' }, role: 'status' }); document.body.appendChild(a); }
    a.textContent = '';
    setTimeout(function () { a.textContent = text; }, 100);
  }

  function formatNumber(n) { return (n == null || isNaN(n)) ? '0' : Number(n).toLocaleString('en-US'); }

  return Object.freeze({
    escapeHtml: escapeHtml, escapeAttr: escapeAttr, sanitizeUrl: sanitizeUrl,
    el: el, buildSafeLink: buildSafeLink, showToast: showToast,
    qs: qs, qsa: qsa, debounce: debounce, throttle: throttle,
    announce: announce, formatNumber: formatNumber
  });
})();

if (typeof window !== 'undefined') window.Utils = Utils;
