/* =============================================================
 * 《落子无悔》· 棋盘渲染器（SVG）
 * 木纹滤镜、三套皮肤装饰纹样、落子/提子动画、数子领地高亮、
 * 标记/提示/最后一手、悬停落子预览。
 * 依赖 window.GoRules 与 window.GO_SKINS。
 * ============================================================= */
(function (g) {
  'use strict';
  var R = g.GoRules;
  var SKINS = g.GO_SKINS;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var uid = 0;
  var COORD_LETTERS = 'ABCDEFGHJKLMNOPQRST';

  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function hexRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  /* 樱花花瓣簇 */
  function petalCluster(layer, cx, cy, r, rot, color, opacity) {
    var elG = svgEl('g', { transform: 'translate(' + cx + ',' + cy + ') rotate(' + rot + ')', opacity: String(opacity) });
    for (var k = 0; k < 5; k++) {
      elG.appendChild(svgEl('ellipse', { cx: 0, cy: -r, rx: r * 0.52, ry: r * 1.02, fill: color, transform: 'rotate(' + (k * 72) + ')' }));
    }
    elG.appendChild(svgEl('circle', { r: r * 0.26, fill: '#f5d68d' }));
    layer.appendChild(elG);
  }
  /* 祥云（三圆 + 基线） */
  function cloud(layer, x, y, s, color, opacity) {
    var elG = svgEl('g', { transform: 'translate(' + x + ',' + y + ') scale(' + s + ')', stroke: color, fill: 'none', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: String(opacity) });
    elG.appendChild(svgEl('circle', { cx: 0, cy: 4, r: 8 }));
    elG.appendChild(svgEl('circle', { cx: 15, cy: -2, r: 11 }));
    elG.appendChild(svgEl('circle', { cx: 31, cy: 3, r: 8 }));
    elG.appendChild(svgEl('line', { x1: -10, y1: 9, x2: 42, y2: 9 }));
    layer.appendChild(elG);
  }
  var MAPLE = 'M0,-13 C3,-9 7,-10 8,-12 C10,-6 15,-4 12,0 C16,1 17,6 12,8 C15,12 10,16 6,14 C6,18 2,20 -1,17 C-3,20 -7,19 -8,15 C-12,16 -16,12 -13,7 C-17,5 -17,-1 -12,-1 C-14,-5 -10,-8 -8,-11 C-6,-9 -3,-9 0,-13 Z';
  function mapleLeaf(layer, cx, cy, s, rot, color, opacity) {
    layer.appendChild(svgEl('path', { d: MAPLE, fill: color, opacity: String(opacity), transform: 'translate(' + cx + ',' + cy + ') scale(' + s + ') rotate(' + rot + ')' }));
  }
  /* 四角星 */
  function sparkle(layer, x, y, r, opacity) {
    var d = 'M' + x + ',' + (y - r) + ' L' + (x + r * 0.32) + ',' + (y - r * 0.32) + ' L' + (x + r) + ',' + y + ' L' + (x + r * 0.32) + ',' + (y + r * 0.32) + ' L' + x + ',' + (y + r) + ' L' + (x - r * 0.32) + ',' + (y + r * 0.32) + ' L' + (x - r) + ',' + y + ' L' + (x - r * 0.32) + ',' + (y - r * 0.32) + ' Z';
    layer.appendChild(svgEl('path', { d: d, fill: '#ffffff', opacity: String(opacity) }));
  }
  function crescent(layer, x, y, r, color, opacity) {
    layer.appendChild(svgEl('path', {
      d: 'M' + (x - r * 0.55) + ',' + (y - r) + ' a' + r + ',' + r + ' 0 1 0 ' + (r * 1.05) + ',' + (r * 0.6) + ' a' + (r * 0.85) + ',' + (r * 0.85) + ' 0 1 1 ' + (-r * 1.05) + ',' + (-r * 0.6) + ' z',
      fill: color, opacity: String(opacity)
    }));
  }
  function bamboo(layer, W, color, color2) {
    var g1 = svgEl('g', { stroke: color2, fill: 'none', 'stroke-linecap': 'round' });
    g1.appendChild(svgEl('path', { d: 'M' + (W - 26) + ',' + (W - 62) + ' v40', 'stroke-width': 3, opacity: .8 }));
    g1.appendChild(svgEl('line', { x1: W - 30, y1: W - 52, x2: W - 22, y2: W - 52, 'stroke-width': 1.6, opacity: .8 }));
    g1.appendChild(svgEl('line', { x1: W - 30, y1: W - 40, x2: W - 22, y2: W - 40, 'stroke-width': 1.6, opacity: .8 }));
    g1.appendChild(svgEl('path', { d: 'M' + (W - 12) + ',' + (W - 70) + ' v44', 'stroke-width': 2.2, opacity: .5 }));
    g1.appendChild(svgEl('line', { x1: W - 16, y1: W - 60, x2: W - 8, y2: W - 60, 'stroke-width': 1.4, opacity: .5 }));
    g1.appendChild(svgEl('line', { x1: W - 16, y1: W - 46, x2: W - 8, y2: W - 46, 'stroke-width': 1.4, opacity: .5 }));
    layer.appendChild(g1);
    var lf = svgEl('g', { fill: color, opacity: .65 });
    lf.appendChild(svgEl('path', { d: 'M' + (W - 26) + ',' + (W - 52) + ' q14,-9 26,-3 q-4,9 -26,3 z' }));
    lf.appendChild(svgEl('path', { d: 'M' + (W - 12) + ',' + (W - 60) + ' q12,-7 21,-2 q-3,7 -21,2 z' }));
    layer.appendChild(lf);
  }

  function drawDecor(layer, skin, W) {
    var d = skin.decor;
    if (d === 'sakura') {
      petalCluster(layer, 30, 30, 8, 0, skin.decorColor, .85);
      petalCluster(layer, 58, 21, 6, 34, skin.decorColor, .55);
      petalCluster(layer, 21, 58, 5.5, -28, skin.decorColor, .5);
      petalCluster(layer, W - 30, W - 30, 7, 12, skin.decorColor, .75);
      petalCluster(layer, W - 56, W - 22, 5, -20, skin.decorColor, .5);
      cloud(layer, 44, 22, .62, skin.decorColor2, .5);
      cloud(layer, W - 96, W - 30, .5, skin.decorColor2, .4);
    } else if (d === 'maple') {
      mapleLeaf(layer, 31, 32, 1.15, -18, skin.decorColor, .85);
      mapleLeaf(layer, 60, 22, .7, 26, skin.decorColor, .5);
      mapleLeaf(layer, W - 30, W - 31, 1.0, 150, skin.decorColor, .8);
      mapleLeaf(layer, W - 58, W - 20, .6, -40, skin.decorColor2, .5);
      var mt = svgEl('path', {
        d: 'M' + (W - 88) + ',' + (W - 14) + ' L' + (W - 62) + ',' + (W - 42) + ' L' + (W - 40) + ',' + (W - 20) + ' L' + (W - 12) + ',' + (W - 46) + ' L' + (W - 4) + ',' + (W - 12),
        stroke: skin.decorColor2, fill: 'none', 'stroke-width': 2, opacity: .5, 'stroke-linecap': 'round'
      });
      layer.appendChild(mt);
      layer.appendChild(svgEl('circle', { cx: W - 30, cy: 26, r: 10, stroke: skin.decorColor2, fill: 'none', 'stroke-width': 1.8, opacity: .55 }));
    } else {
      crescent(layer, 34, 33, 11, skin.decorColor, .9);
      sparkle(layer, 60, 22, 6, .75);
      sparkle(layer, 46, 48, 4, .5);
      sparkle(layer, 70, 40, 3.4, .6);
      bamboo(layer, W, skin.decorColor, skin.decorColor2);
    }
  }

  class GoBoard {
    constructor(container, opts) {
      opts = opts || {};
      this.container = container;
      this.size = opts.size || 9;
      this.skin = opts.skin || 'warm';
      this.interactive = !!opts.interactive;
      this.showCoords = opts.showCoords !== false;
      this.onClick = opts.onClick || null;
      this.uid = 'gb' + (++uid);
      this.stones = [];
      this.lastMove = -1;
      this.hintIdx = -1;
      this.ghostColor = 0;
      this._build();
    }
    _build() {
      var size = this.size;
      this.cell = 700 / (size - 0.5);
      this.origin = 40 + this.cell / 2;
      var W = 780;
      this.W = W;
      var svg = svgEl('svg', { class: 'goban' + (this.interactive ? ' interactive' : ''), viewBox: '0 0 ' + W + ' ' + W });
      this.svg = svg;
      this.defs = svgEl('defs', {}); svg.appendChild(this.defs);
      this.frameEl = svgEl('rect', { class: 'goban-frame' }); svg.appendChild(this.frameEl);
      this.frameInnerEl = svgEl('rect', { class: 'goban-frame-inner' }); svg.appendChild(this.frameInnerEl);
      this.surfaceEl = svgEl('rect', { class: 'goban-surface' }); svg.appendChild(this.surfaceEl);
      this.grainEl = svgEl('rect', { class: 'goban-grain' }); svg.appendChild(this.grainEl);
      this.decorLayer = svgEl('g', { class: 'goban-decor' }); svg.appendChild(this.decorLayer);
      this.gridLayer = svgEl('g', { class: 'goban-grid' }); svg.appendChild(this.gridLayer);
      this.starLayer = svgEl('g', { class: 'goban-stars' }); svg.appendChild(this.starLayer);
      this.terrLayer = svgEl('g', { class: 'goban-territory' }); svg.appendChild(this.terrLayer);
      this.coordLayer = svgEl('g', { class: 'goban-coords' }); svg.appendChild(this.coordLayer);
      this.stoneLayer = svgEl('g', { class: 'goban-stones' }); svg.appendChild(this.stoneLayer);
      this.markLayer = svgEl('g', { class: 'goban-marks' }); svg.appendChild(this.markLayer);
      this.container.innerHTML = '';
      this.container.appendChild(svg);
      this._buildStatic();
      this._applySkin();
      var self = this;
      svg.addEventListener('click', function (e) {
        if (!self.interactive || !self.onClick) return;
        var p = self.pointFromEvent(e);
        if (p >= 0) self.onClick(p);
      });
      svg.addEventListener('mousemove', function (e) {
        if (!self.interactive || !self.ghostColor) { self.ghostEl.classList.add('hidden'); return; }
        var p = self.pointFromEvent(e);
        if (p >= 0 && self.stones[p].color === 0) {
          var c = self.xyOf(p);
          self.ghostEl.setAttribute('transform', 'translate(' + c.x + ',' + c.y + ')');
          self.ghostEl.classList.remove('hidden');
        } else self.ghostEl.classList.add('hidden');
      });
      svg.addEventListener('mouseleave', function () { self.ghostEl.classList.add('hidden'); });
    }
    xyOf(i) {
      var size = this.size;
      return { x: this.origin + (i % size) * this.cell, y: this.origin + ((i / size) | 0) * this.cell };
    }
    pointFromEvent(e) {
      var svg = this.svg;
      var pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      var m = svg.getScreenCTM();
      if (!m) return -1;
      var p = pt.matrixTransform(m.inverse());
      var size = this.size, cell = this.cell, o = this.origin;
      var x = Math.round((p.x - o) / cell), y = Math.round((p.y - o) / cell);
      if (x < 0 || x >= size || y < 0 || y >= size) return -1;
      var dx = p.x - (o + x * cell), dy = p.y - (o + y * cell);
      if (dx * dx + dy * dy > cell * cell * 0.3) return -1;
      return y * size + x;
    }
    _buildStatic() {
      var size = this.size, o = this.origin, cell = this.cell;
      for (var k = 0; k < size; k++) {
        this.gridLayer.appendChild(svgEl('line', { class: 'grid-line', x1: o, y1: o + k * cell, x2: o + (size - 1) * cell, y2: o + k * cell }));
        this.gridLayer.appendChild(svgEl('line', { class: 'grid-line', x1: o + k * cell, y1: o, x2: o + k * cell, y2: o + (size - 1) * cell }));
      }
      var sp = R.starPoints(size);
      for (var s = 0; s < sp.length; s++) {
        this.starLayer.appendChild(svgEl('circle', { class: 'star-point', cx: o + sp[s][0] * cell, cy: o + sp[s][1] * cell, r: cell * 0.09 }));
      }
      if (this.showCoords) {
        for (var k2 = 0; k2 < size; k2++) {
          var tx = svgEl('text', { x: o + k2 * cell, y: 23, 'text-anchor': 'middle', 'font-size': Math.max(10, cell * 0.3) });
          tx.textContent = COORD_LETTERS[k2];
          var ty = svgEl('text', { x: 21, y: o + k2 * cell + Math.max(10, cell * 0.3) * 0.36, 'text-anchor': 'middle', 'font-size': Math.max(10, cell * 0.3) });
          ty.textContent = String(size - k2);
          this.coordLayer.appendChild(tx);
          this.coordLayer.appendChild(ty);
        }
      }
      for (var i = 0; i < size * size; i++) {
        var c = this.xyOf(i);
        var elG = svgEl('g', { class: 'stone hidden', transform: 'translate(' + c.x + ',' + c.y + ')' });
        elG.setAttribute('style', 'filter: drop-shadow(1px 2.5px 1.5px rgba(0,0,0,.4))');
        var base = svgEl('circle', { class: 'stone-base', r: cell * 0.47 });
        var hi = svgEl('circle', { class: 'stone-hi', r: cell * 0.47 });
        elG.appendChild(base);
        elG.appendChild(hi);
        this.stoneLayer.appendChild(elG);
        this.stones[i] = { g: elG, base: base, hi: hi, color: 0 };
      }
      // 悬停落子预览
      this.ghostEl = svgEl('g', { class: 'hidden', opacity: .5 });
      this.ghostEl.appendChild(svgEl('circle', { r: cell * 0.47 }));
      this.stoneLayer.appendChild(this.ghostEl);
    }
    _applySkin() {
      var s = SKINS[this.skin] || SKINS.warm;
      var W = this.W;
      var defs = this.defs;
      defs.innerHTML = '';
      var fg = svgEl('linearGradient', { id: this.uid + '-frame', x1: '0', y1: '0', x2: '1', y2: '1' });
      fg.appendChild(svgEl('stop', { offset: '0', 'stop-color': s.frameLight }));
      fg.appendChild(svgEl('stop', { offset: '.5', 'stop-color': s.frame }));
      fg.appendChild(svgEl('stop', { offset: '1', 'stop-color': s.frameDark }));
      defs.appendChild(fg);
      var sg = svgEl('linearGradient', { id: this.uid + '-surface', x1: '0', y1: '0', x2: '1', y2: '1' });
      sg.appendChild(svgEl('stop', { offset: '0', 'stop-color': s.surfaceLight }));
      sg.appendChild(svgEl('stop', { offset: '1', 'stop-color': s.surface }));
      defs.appendChild(sg);
      var gf = svgEl('filter', { id: this.uid + '-grain', x: '0', y: '0', width: '100%', height: '100%' });
      gf.appendChild(svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: s.grainFreq, numOctaves: '3', seed: String(s.grainSeed) }));
      var rgb = hexRgb(s.grain);
      gf.appendChild(svgEl('feColorMatrix', { type: 'matrix', values: '0 0 0 0 ' + rgb[0].toFixed(3) + ' 0 0 0 0 ' + rgb[1].toFixed(3) + ' 0 0 0 0 ' + rgb[2].toFixed(3) + ' 0 0 0 0 ' + s.grainOpacity }));
      gf.appendChild(svgEl('feComposite', { operator: 'in', in2: 'SourceGraphic' }));
      defs.appendChild(gf);
      var bk = svgEl('radialGradient', { id: this.uid + '-black', cx: '.35', cy: '.3', r: '.95' });
      bk.appendChild(svgEl('stop', { offset: '0', 'stop-color': s.black.c1 }));
      bk.appendChild(svgEl('stop', { offset: '.55', 'stop-color': s.black.c1 }));
      bk.appendChild(svgEl('stop', { offset: '1', 'stop-color': s.black.c2 }));
      defs.appendChild(bk);
      var wh = svgEl('radialGradient', { id: this.uid + '-white', cx: '.35', cy: '.3', r: '.95' });
      wh.appendChild(svgEl('stop', { offset: '0', 'stop-color': s.white.c1 }));
      wh.appendChild(svgEl('stop', { offset: '.6', 'stop-color': s.white.c1 }));
      wh.appendChild(svgEl('stop', { offset: '1', 'stop-color': s.white.c2 }));
      defs.appendChild(wh);
      var hi = svgEl('radialGradient', { id: this.uid + '-hi', cx: '.3', cy: '.24', r: '.65' });
      hi.appendChild(svgEl('stop', { offset: '0', 'stop-color': 'rgba(255,255,255,.95)' }));
      hi.appendChild(svgEl('stop', { offset: '1', 'stop-color': 'rgba(255,255,255,0)' }));
      defs.appendChild(hi);
      this.frameEl.setAttribute('x', 4); this.frameEl.setAttribute('y', 4);
      this.frameEl.setAttribute('width', W - 8); this.frameEl.setAttribute('height', W - 8);
      this.frameEl.setAttribute('rx', 16); this.frameEl.setAttribute('fill', 'url(#' + this.uid + '-frame)');
      this.frameInnerEl.setAttribute('x', 14); this.frameInnerEl.setAttribute('y', 14);
      this.frameInnerEl.setAttribute('width', W - 28); this.frameInnerEl.setAttribute('height', W - 28);
      this.frameInnerEl.setAttribute('rx', 10); this.frameInnerEl.setAttribute('fill', 'none');
      this.frameInnerEl.setAttribute('stroke', s.line); this.frameInnerEl.setAttribute('stroke-width', 1.6); this.frameInnerEl.setAttribute('opacity', .8);
      this.surfaceEl.setAttribute('x', 32); this.surfaceEl.setAttribute('y', 32);
      this.surfaceEl.setAttribute('width', W - 64); this.surfaceEl.setAttribute('height', W - 64);
      this.surfaceEl.setAttribute('rx', 6); this.surfaceEl.setAttribute('fill', 'url(#' + this.uid + '-surface)');
      this.grainEl.setAttribute('x', 32); this.grainEl.setAttribute('y', 32);
      this.grainEl.setAttribute('width', W - 64); this.grainEl.setAttribute('height', W - 64);
      this.grainEl.setAttribute('rx', 6); this.grainEl.setAttribute('fill', '#fff');
      this.grainEl.setAttribute('filter', 'url(#' + this.uid + '-grain)');
      var lines = this.gridLayer.querySelectorAll('.grid-line');
      for (var l = 0; l < lines.length; l++) { lines[l].setAttribute('stroke', s.line); lines[l].setAttribute('stroke-width', 1.15); }
      var stars = this.starLayer.querySelectorAll('.star-point');
      for (var st2 = 0; st2 < stars.length; st2++) stars[st2].setAttribute('fill', s.star);
      var texts = this.coordLayer.querySelectorAll('text');
      for (var tx2 = 0; tx2 < texts.length; tx2++) texts[tx2].setAttribute('fill', s.labelColor);
      for (var i2 = 0; i2 < this.stones.length; i2++) {
        var st = this.stones[i2];
        if (st.color === 0) continue;
        st.base.setAttribute('fill', 'url(#' + this.uid + (st.color === 1 ? '-black' : '-white') + ')');
        st.base.setAttribute('stroke', st.color === 1 ? s.black.edge : s.white.edge);
        st.hi.setAttribute('fill', 'url(#' + this.uid + '-hi)');
      }
      this.ghostEl.firstChild.setAttribute('fill', 'url(#' + this.uid + '-black)');
      this.decorLayer.innerHTML = '';
      drawDecor(this.decorLayer, s, W);
    }
    /* ---------- 棋子 ---------- */
    setStone(i, color, animate) {
      var st = this.stones[i];
      if (st.color === color) return;
      var s = SKINS[this.skin] || SKINS.warm;
      if (color === 0) {
        st.color = 0;
        st.g.classList.remove('dead-stone');
        if (animate) {
          st.g.classList.remove('hidden');
          st.g.classList.add('dying');
          (function (elG) { setTimeout(function () { elG.classList.add('hidden'); elG.classList.remove('dying'); }, 330); })(st.g);
        } else st.g.classList.add('hidden');
      } else {
        st.color = color;
        st.base.setAttribute('fill', 'url(#' + this.uid + (color === 1 ? '-black' : '-white') + ')');
        st.base.setAttribute('stroke', color === 1 ? s.black.edge : s.white.edge);
        st.hi.setAttribute('fill', 'url(#' + this.uid + '-hi)');
        st.g.classList.remove('hidden', 'dying');
        if (animate) {
          st.g.classList.remove('placing');
          void st.g.getBBox();
          st.g.classList.add('placing');
        }
      }
    }
    removeStones(idxs, animate) {
      for (var k = 0; k < idxs.length; k++) this.setStone(idxs[k], 0, animate);
    }
    syncPosition(pos) {
      for (var i = 0; i < pos.size * pos.size; i++) this.setStone(i, pos.board[i], false);
    }
    clear() { for (var i = 0; i < this.stones.length; i++) this.setStone(i, 0, false); }
    setGhostColor(color) {
      this.ghostColor = color || 0;
      if (!this.ghostColor) this.ghostEl.classList.add('hidden');
      else this.ghostEl.firstChild.setAttribute('fill', 'url(#' + this.uid + (color === 1 ? '-black' : '-white') + ')');
    }
    /* ---------- 标记 ---------- */
    setLastMove(i) {
      this.lastMove = i;
      this._renderMarks();
    }
    setHint(i) { this.hintIdx = i; this._renderMarks(); }
    clearHint() { this.hintIdx = -1; this._renderMarks(); }
    _renderMarks() {
      var old = this.markLayer.querySelectorAll('.last-move-dot, .hint-mark');
      for (var k = 0; k < old.length; k++) old[k].parentNode.removeChild(old[k]);
      if (this.lastMove >= 0) {
        var c = this.xyOf(this.lastMove);
        var color = this.stones[this.lastMove].color === 1 ? '#f4f8ff' : '#20242c';
        this.markLayer.appendChild(svgEl('circle', { class: 'last-move-dot', cx: c.x, cy: c.y, r: this.cell * 0.14, fill: color, opacity: .9 }));
      }
      if (this.hintIdx >= 0) {
        var c2 = this.xyOf(this.hintIdx);
        this.markLayer.appendChild(svgEl('circle', { class: 'hint-mark', cx: c2.x, cy: c2.y, r: this.cell * 0.4, fill: 'none', stroke: '#2e9e5b', 'stroke-width': 3.2 }));
      }
    }
    setMarks(marks) {
      this.markLayer.innerHTML = '';
      if (!marks) { this._renderMarks(); return; }
      var cell = this.cell;
      for (var key in marks) {
        var m = marks[key];
        var i = parseInt(key, 10);
        var c = this.xyOf(i);
        var color = m.color || '#c0392b';
        var elG = svgEl('g', { class: 'mark' });
        if (m.type === 'circle') {
          elG.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: cell * 0.3, fill: 'none', stroke: color, 'stroke-width': 2.6 }));
        } else if (m.type === 'cross') {
          elG.appendChild(svgEl('line', { x1: c.x - cell * 0.28, y1: c.y - cell * 0.28, x2: c.x + cell * 0.28, y2: c.y + cell * 0.28, stroke: color, 'stroke-width': 2.6 }));
          elG.appendChild(svgEl('line', { x1: c.x + cell * 0.28, y1: c.y - cell * 0.28, x2: c.x - cell * 0.28, y2: c.y + cell * 0.28, stroke: color, 'stroke-width': 2.6 }));
        } else if (m.type === 'triangle') {
          var r = cell * 0.32;
          elG.appendChild(svgEl('polygon', { points: (c.x) + ',' + (c.y - r) + ' ' + (c.x + r) + ',' + (c.y + r * 0.7) + ' ' + (c.x - r) + ',' + (c.y + r * 0.7), fill: 'none', stroke: color, 'stroke-width': 2.6 }));
        } else if (m.type === 'label') {
          var t = svgEl('text', { x: c.x, y: c.y + cell * 0.16, 'text-anchor': 'middle', 'font-size': cell * 0.5, fill: color, 'font-weight': 'bold' });
          t.textContent = m.label || '?';
          elG.appendChild(t);
        } else {
          elG.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: cell * 0.14, fill: color }));
        }
        this.markLayer.appendChild(elG);
      }
      this._renderMarks();
    }
    /* ---------- 数子高亮 ---------- */
    setTerritory(t, deadSet) {
      this.terrLayer.innerHTML = '';
      var cell = this.cell, size = this.size;
      for (var i = 0; i < size * size; i++) {
        var st = this.stones[i];
        var isDead = deadSet && deadSet.has(i);
        if (isDead) st.g.classList.add('dead-stone');
        else st.g.classList.remove('dead-stone');
        if (isDead || st.color === 0) {
          var v = isDead ? (st.color === 1 ? 2 : 1) : t[i];
          var cls = v === 1 ? 'terr-b' : (v === 2 ? 'terr-w' : 'terr-n');
          var c = this.xyOf(i);
          var rect = svgEl('rect', {
            class: 'terr ' + cls, x: c.x - cell * 0.47, y: c.y - cell * 0.47,
            width: cell * 0.94, height: cell * 0.94, rx: cell * 0.1
          });
          this.terrLayer.appendChild(rect);
          if (isDead) {
            var g2 = svgEl('g', { class: 'dead-mark' });
            g2.appendChild(svgEl('line', { class: 'dead-x-ghost', x1: c.x - cell * 0.24, y1: c.y - cell * 0.24, x2: c.x + cell * 0.24, y2: c.y + cell * 0.24 }));
            g2.appendChild(svgEl('line', { class: 'dead-x-ghost', x1: c.x + cell * 0.24, y1: c.y - cell * 0.24, x2: c.x - cell * 0.24, y2: c.y + cell * 0.24 }));
            g2.appendChild(svgEl('line', { class: 'dead-x', x1: c.x - cell * 0.24, y1: c.y - cell * 0.24, x2: c.x + cell * 0.24, y2: c.y + cell * 0.24 }));
            g2.appendChild(svgEl('line', { class: 'dead-x', x1: c.x + cell * 0.24, y1: c.y - cell * 0.24, x2: c.x - cell * 0.24, y2: c.y + cell * 0.24 }));
            this.terrLayer.appendChild(g2);
          }
        }
      }
    }
    clearTerritory() {
      this.terrLayer.innerHTML = '';
      for (var i = 0; i < this.stones.length; i++) this.stones[i].g.classList.remove('dead-stone');
    }
    /* ---------- 其它 ---------- */
    setSkin(id) { this.skin = id; this._applySkin(); }
    setInteractive(b) {
      this.interactive = !!b;
      if (b) this.svg.classList.add('interactive'); else this.svg.classList.remove('interactive');
    }
    setShowCoords(b) { this.showCoords = !!b; }
    destroy() { this.container.innerHTML = ''; }
  }
  g.GoBoard = GoBoard;
})(typeof window !== 'undefined' ? window : globalThis);
