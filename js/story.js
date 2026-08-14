/* =============================================================
 * 《落子无悔》· 围棋故事：历史时间线 / 名人堂 / 文化馆
 * ============================================================= */
(function (g) {
  'use strict';
  var U = g.GoUtil;
  var H = g.GO_HISTORY;
  var tab = 'timeline';

  function $(id) { return document.getElementById(id); }

  function init() {
    var tabs = document.querySelectorAll('#story-tabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (t) {
        t.addEventListener('click', function () {
          tab = t.getAttribute('data-story');
          for (var k = 0; k < tabs.length; k++) tabs[k].classList.toggle('active', tabs[k] === t);
          render();
        });
      })(tabs[i]);
    }
  }
  function show() { render(); }
  function render() {
    $('timeline').classList.toggle('hidden', tab !== 'timeline');
    $('figure-grid').classList.toggle('hidden', tab !== 'figures');
    $('culture-wrap').classList.toggle('hidden', tab !== 'culture');
    if (tab === 'timeline') renderTimeline();
    else if (tab === 'figures') renderFigures();
    else renderCulture();
  }
  function figureById(id) {
    for (var i = 0; i < H.figures.length; i++) if (H.figures[i].id === id) return H.figures[i];
    return null;
  }
  function renderTimeline() {
    var box = $('timeline');
    box.innerHTML = '';
    var intro = U.el('div', { class: 'story-intro', html: H.intro });
    box.appendChild(intro);
    var row1 = U.el('div', { class: 'timeline-row' });
    for (var i = 0; i < H.eras.length; i++) {
      (function (era) {
        var card = U.el('div', { class: 'era-card' });
        card.appendChild(U.el('div', { class: 'era-dot' }));
        card.appendChild(U.el('div', { class: 'era-name', text: era.name }));
        card.appendChild(U.el('div', { class: 'era-period', text: era.period }));
        card.appendChild(U.el('div', { class: 'era-tagline', text: era.tagline }));
        card.appendChild(U.el('div', { class: 'muted small', text: '点击了解详情 →' }));
        card.addEventListener('click', function () { openEra(era); });
        row1.appendChild(card);
      })(H.eras[i]);
    }
    box.appendChild(row1);
    var bt = U.el('div', { class: 'story-intro', html: '<strong>传奇名局</strong> —— 点击查看对局背后的故事' });
    box.appendChild(bt);
    var row2 = U.el('div', { class: 'timeline-row' });
    for (var b = 0; b < H.battles.length; b++) {
      (function (bat) {
        var card = U.el('div', { class: 'era-card' });
        card.appendChild(U.el('div', { class: 'era-dot' }));
        card.appendChild(U.el('div', { class: 'era-name', text: bat.title }));
        card.appendChild(U.el('div', { class: 'era-period', text: bat.year + (bat.subtitle ? ' · ' + bat.subtitle : '') }));
        card.appendChild(U.el('div', { class: 'era-tagline', text: '点击查看名局故事' }));
        card.addEventListener('click', function () {
          g.App.modal({
            title: bat.title,
            body: '<p class="muted small">' + bat.year + (bat.subtitle ? ' · ' + U.esc(bat.subtitle) : '') + '</p>' + bat.html,
            actions: [{ label: '关闭', cls: 'primary' }]
          });
        });
        row2.appendChild(card);
      })(H.battles[b]);
    }
    box.appendChild(row2);
  }
  function openEra(era) {
    var figs = '';
    if (era.figureIds && era.figureIds.length) {
      figs = '<p><strong>相关棋手</strong></p><p>' + era.figureIds.map(function (id) {
        var f = figureById(id);
        return f ? '<button class="btn small ghost era-fig" data-fig="' + id + '">' + U.esc(f.name) + '</button>' : '';
      }).join('') + '</p>';
    }
    var events = '';
    if (era.events && era.events.length) {
      events = '<p><strong>大事记</strong></p><ul>' + era.events.map(function (e) {
        return '<li>' + (e.year ? '<strong>' + U.esc(String(e.year)) + '</strong> ' : '') + U.esc(e.text) + '</li>';
      }).join('') + '</ul>';
    }
    var m = g.App.modal({
      title: era.name,
      body: '<p class="muted small">' + era.period + '</p>' + era.html + events + figs,
      actions: [{ label: '关闭', cls: 'primary' }]
    });
    var figBtns = m.box.querySelectorAll('.era-fig');
    for (var i = 0; i < figBtns.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          var f = figureById(b.getAttribute('data-fig'));
          if (f) openFigure(f);
        });
      })(figBtns[i]);
    }
  }
  function figureImgEl(f, cls) {
    var av = U.el('div', { class: cls || 'figure-avatar' });
    av.textContent = f.name.charAt(0);
    var exts = ['.jpg', '.png'];
    function tryIdx(k) {
      if (k >= exts.length) return;
      var img = U.el('img', { class: 'figure-img', src: 'img/figures/' + f.id + exts[k], alt: f.name });
      img.addEventListener('load', function () { av.textContent = ''; av.appendChild(img); });
      img.addEventListener('error', function () { tryIdx(k + 1); });
      av.appendChild(img);
    }
    tryIdx(0);
    return av;
  }
  function renderFigures() {
    var box = $('figure-grid');
    box.innerHTML = '';
    for (var i = 0; i < H.figures.length; i++) {
      (function (f) {
        var card = U.el('div', { class: 'figure-card' });
        card.appendChild(figureImgEl(f, 'figure-avatar'));
        card.appendChild(U.el('div', { class: 'figure-name', text: f.name }));
        card.appendChild(U.el('div', { class: 'figure-title', text: (f.title || '') + (f.years ? ' · ' + f.years : '') }));
        card.appendChild(U.el('div', { class: 'figure-tagline', text: f.tagline }));
        card.addEventListener('click', function () { openFigure(f); });
        box.appendChild(card);
      })(H.figures[i]);
    }
  }
  function openFigure(f) {
    var m = g.App.modal({
      title: f.name,
      body: '<p class="muted small">' + U.esc((f.title || '') + (f.years ? ' · ' + f.years : '') + (f.period ? ' · ' + f.period : '')) + '</p>' +
        f.html + '<p class="muted small">' + U.esc(f.tagline || '') + '</p>',
      actions: [{ label: '关闭', cls: 'primary' }]
    });
    var first = m.box.querySelector('.modal-body');
    if (first) first.insertBefore(figureImgEl(f, 'figure-avatar figure-avatar-big'), first.firstChild);
  }
  function renderCulture() {
    var box = $('culture-wrap');
    box.innerHTML = '';
    var secs = [
      { title: '成语典故', items: H.culture.idioms.map(function (x) { return { head: x.word, html: '<p>' + U.esc(x.meaning) + '</p>' + (x.story ? '<p>' + U.esc(x.story) + '</p>' : '') }; }) },
      { title: '棋品九品', items: H.culture.grades.map(function (x) { return { head: x.name, html: '<p>' + U.esc(x.desc) + '</p>' }; }) },
      { title: '对弈礼仪', items: H.culture.etiquette.map(function (x) { return { head: x.title, html: '<p>' + U.esc(x.text) + '</p>' }; }) },
      { title: '趣味冷知识', items: H.culture.trivia.map(function (x) { return { head: x.title, html: '<p>' + U.esc(x.text) + '</p>' }; }) }
    ];
    for (var i = 0; i < secs.length; i++) {
      (function (sec) {
        var s = U.el('div', { class: 'culture-section' });
        s.appendChild(U.el('h3', { text: sec.title }));
        for (var k = 0; k < sec.items.length; k++) {
          var item = U.el('div', { class: 'culture-item' });
          item.appendChild(U.el('div', { class: 'word', text: sec.items[k].head }));
          item.innerHTML += sec.items[k].html;
          s.appendChild(item);
        }
        box.appendChild(s);
      })(secs[i]);
    }
  }
  g.Story = { init: init, show: show };
})(window);
