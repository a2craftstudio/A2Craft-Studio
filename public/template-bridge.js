/**
 * A2Craft template bridge.
 *
 * Runs inside a template page and lets the customize editor (the parent window)
 * read and rewrite the page's text and images over postMessage. It only ever
 * touches text node values, `img` sources and background images — nothing it
 * receives is executed — so it is safe to ship inside a template served from
 * another origin.
 *
 * Templates served from this app get it injected by the editor. Templates hosted
 * elsewhere must include it themselves:
 *
 *   <script src="https://a2craft-studio.onrender.com/template-bridge.js"></script>
 *
 * Protocol, parent -> template:
 *   { type: 'a2:scan' }                              re-read the page
 *   { type: 'a2:apply', text: {}, images: {} }       override slots by id
 * Template -> parent:
 *   { type: 'a2:ready' }
 *   { type: 'a2:slots', slots: [...], images: [...] }
 */
(function () {
  if (window.__a2Bridge) return;

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, TITLE: 1 };
  var DATE_RE = /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})|((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?,?\s*\d{0,4})|(\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{0,4})/i;
  var VENUE_RE = /\b(hall|palace|hotel|resort|garden|farm|banquet|lawn|villa|club|temple|church|gurudwara|venue|road|street|marg|nagar)\b/i;
  var NAME_RE = /\s(&|and|weds|y)\s/i;

  /** Text nodes and images, keyed by a stable id, with the page's own value kept for reset. */
  var texts = [];   // { id, node, original, text, tag, size, role }
  var images = [];  // { id, el, kind, original }
  var overrideText = {};
  var overrideImage = {};
  var scanTimer = null;
  var applying = false;

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return false;
    var s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  }

  function roleOf(text, size, index) {
    if (DATE_RE.test(text)) return 'date';
    if (NAME_RE.test(text) && text.length <= 60 && size >= 22) return 'names';
    if (VENUE_RE.test(text)) return 'venue';
    if (size >= 30 && index < 12) return 'heading';
    return 'text';
  }

  function scan() {
    texts = [];
    images = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p || SKIP[p.tagName]) return NodeFilter.FILTER_REJECT;
        if (p.closest('[data-a2-ignore]')) return NodeFilter.FILTER_REJECT;
        return visible(p) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    var n, i = 0;
    while ((n = walker.nextNode())) {
      var p = n.parentElement;
      var size = parseFloat(getComputedStyle(p).fontSize) || 16;
      // The page's own wording, not a value we wrote on an earlier pass.
      var original = n.__a2Original !== undefined ? n.__a2Original : n.nodeValue;
      var id = 't' + i++;
      texts.push({ id: id, node: n, original: original, tag: p.tagName.toLowerCase(), size: size });
    }
    texts.sort(function (a, b) { return b.size - a.size; });
    texts.forEach(function (t, idx) { t.role = roleOf(t.original.trim(), t.size, idx); });

    var j = 0;
    Array.prototype.forEach.call(document.images, function (img) {
      if (!visible(img)) return;
      var original = img.__a2Original !== undefined ? img.__a2Original : img.currentSrc || img.src;
      images.push({ id: 'i' + j++, el: img, kind: 'img', original: original });
    });
    Array.prototype.forEach.call(document.querySelectorAll('*'), function (el) {
      var bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === 'none' || bg.indexOf('url(') !== 0) return;
      if (!visible(el)) return;
      var original = el.__a2Original !== undefined ? el.__a2Original : bg;
      images.push({ id: 'b' + j++, el: el, kind: 'background', original: original });
    });
  }

  function apply() {
    applying = true;
    texts.forEach(function (t) {
      if (t.node.__a2Original === undefined) t.node.__a2Original = t.original;
      var next = Object.prototype.hasOwnProperty.call(overrideText, t.id) ? overrideText[t.id] : t.original;
      if (t.node.nodeValue !== next) t.node.nodeValue = next;
    });
    images.forEach(function (im) {
      if (im.el.__a2Original === undefined) im.el.__a2Original = im.original;
      var next = overrideImage[im.id];
      if (im.kind === 'img') {
        var want = next || im.original;
        if (im.el.getAttribute('src') !== want) {
          im.el.removeAttribute('srcset');
          im.el.setAttribute('src', want);
        }
      } else {
        im.el.style.backgroundImage = next ? 'url("' + next + '")' : im.original;
      }
    });
    applying = false;
  }

  function payload() {
    return {
      type: 'a2:slots',
      slots: texts.map(function (t) {
        return { id: t.id, text: t.original, tag: t.tag, size: Math.round(t.size), role: t.role };
      }),
      images: images.map(function (im) { return { id: im.id, kind: im.kind, src: im.original }; }),
    };
  }

  function send(msg) {
    if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
  }

  function rescan() {
    scan();
    apply();
    send(payload());
  }

  /** The SPA templates hydrate and re-render, so a settled DOM is re-read and re-applied. */
  var observer = new MutationObserver(function () {
    if (applying) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(rescan, 250);
  });

  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'a2:scan') return rescan();
    if (d.type === 'a2:apply') {
      overrideText = d.text && typeof d.text === 'object' ? d.text : {};
      overrideImage = d.images && typeof d.images === 'object' ? d.images : {};
      apply();
    }
  });

  function start() {
    rescan();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    send({ type: 'a2:ready' });
    // A late hydration pass can land after the first scan.
    setTimeout(rescan, 900);
    setTimeout(rescan, 2500);
  }

  window.__a2Bridge = { rescan: rescan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
