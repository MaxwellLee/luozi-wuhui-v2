/* =============================================================
 * 《落子无悔》· 工具函数
 * 经典脚本，挂载 window.GoUtil；toast 等 DOM 函数在 Node 中自动跳过。
 * ============================================================= */
(function (g) {
  'use strict';

  /* 可选种子的伪随机数发生器（用于可复现演示） */
  function rng(seed) {
    if (seed === undefined) return Math.random;
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function shuffle(arr, r) {
    r = r || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (r() * (i + 1)) | 0;
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* 简易 DOM 构建 */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    if (children != null) {
      if (!Array.isArray(children)) children = [children];
      for (var i = 0; i < children.length; i++) if (children[i] != null) node.appendChild(children[i]);
    }
    return node;
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(target, ev, fn) {
    target.addEventListener(ev, fn);
    return function () { target.removeEventListener(ev, fn); };
  }
  /* 全局小提示 */
  function toast(msg, type) {
    if (typeof document === 'undefined') return;
    var root = document.getElementById('toast-root');
    if (!root) { root = document.createElement('div'); root.id = 'toast-root'; document.body.appendChild(root); }
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast-' + type : '');
    t.textContent = msg;
    root.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 450);
    }, 3600);
  }
  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  g.GoUtil = { rng: rng, shuffle: shuffle, clamp: clamp, pad2: pad2, fmtDate: fmtDate, esc: esc, el: el, qs: qs, qsa: qsa, on: on, toast: toast, debounce: debounce };
})(typeof window !== 'undefined' ? window : globalThis);
