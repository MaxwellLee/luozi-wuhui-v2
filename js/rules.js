/* =============================================================
 * 《落子无悔》· 围棋规则引擎（中国规则 · 数子法）
 * 经典脚本，挂载 window.GoRules；无 DOM 依赖，可在 Node 中运行。
 * 坐标：x 为列（0 起，从左到右），y 为行（0 起，从上到下）；
 *       交叉点编号 i = y * size + x；颜色 1=黑 2=白。
 * ============================================================= */
(function (g) {
  'use strict';
  var MAX = 19;
  var COORD_LETTERS = 'ABCDEFGHJKLMNOPQRST'; // 围棋惯例省略 I

  /* Zobrist 哈希表（确定性伪随机，跨平台一致） */
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s;
    };
  }
  var zrng = makeRng(0x2E6F71);
  var Z = new Uint32Array(MAX * MAX * 2 + 1);
  for (var zi = 0; zi < Z.length; zi++) Z[zi] = zrng() >>> 0;
  var Z_TOMOVE = MAX * MAX * 2;
  function zIdx(x, y, color) { return (y * MAX + x) * 2 + (color - 1); }

  /* 邻居表（各规格预计算） */
  var NB = [];
  for (var ns = 1; ns <= MAX; ns++) {
    var arr = [];
    for (var ny = 0; ny < ns; ny++) for (var nx = 0; nx < ns; nx++) {
      var nb = [];
      if (nx > 0) nb.push(ny * ns + nx - 1);
      if (nx < ns - 1) nb.push(ny * ns + nx + 1);
      if (ny > 0) nb.push((ny - 1) * ns + nx);
      if (ny < ns - 1) nb.push((ny + 1) * ns + nx);
      arr.push(nb);
    }
    NB.push(arr);
  }

  /* ---------- 局面 ---------- */
  function create(size, komi) {
    if (size === undefined) size = 19;
    if (komi === undefined) komi = 7.5;
    return {
      size: size, komi: komi,
      board: new Uint8Array(size * size),
      toMove: 1, caps: [0, 0], passes: 0, moves: 0,
      lastMove: -1, captured: 0, hash: 0, prevHash: 0, handicap: 0
    };
  }
  function clone(pos) {
    var p = create(pos.size, pos.komi);
    p.board.set(pos.board);
    p.toMove = pos.toMove; p.caps = pos.caps.slice();
    p.passes = pos.passes; p.moves = pos.moves; p.lastMove = pos.lastMove;
    p.captured = pos.captured; p.hash = pos.hash; p.prevHash = pos.prevHash;
    p.handicap = pos.handicap;
    return p;
  }
  function neighbors(pos, i) { return NB[pos.size - 1][i]; }
  function idx(x, y, size) { return y * size + x; }
  function xy(i, size) { return [i % size, (i / size) | 0]; }
  function display(i, size) {
    var c = xy(i, size);
    return COORD_LETTERS[c[0]] + (size - c[1]);
  }
  function parseCoord(s, size) {
    if (!s) return -1;
    s = String(s).trim().toUpperCase();
    var x = COORD_LETTERS.indexOf(s[0]);
    var num = parseInt(s.slice(1), 10);
    if (x < 0 || x >= size || !isFinite(num)) return -1;
    var y = size - num;
    if (y < 0 || y >= size) return -1;
    return y * size + x;
  }
  function computeHash(pos) {
    var h = 0, size = pos.size;
    for (var i = 0; i < size * size; i++) {
      var v = pos.board[i];
      if (v) {
        var x = i % size, y = (i / size) | 0;
        h ^= Z[zIdx(x, y, v)];
      }
    }
    if (pos.toMove === 2) h ^= Z[Z_TOMOVE];
    return h >>> 0;
  }

  /* ---------- 块与眼 ---------- */
  function group(pos, i) {
    var size = pos.size, color = pos.board[i];
    if (!color) return { color: 0, stones: [], liberties: [] };
    var stones = [i], libs = [];
    var seen = new Uint8Array(size * size);
    seen[i] = 1;
    for (var k = 0; k < stones.length; k++) {
      var nb = neighbors(pos, stones[k]);
      for (var m = 0; m < nb.length; m++) {
        var n = nb[m];
        if (seen[n]) continue;
        var v = pos.board[n];
        if (v === 0) { seen[n] = 1; libs.push(n); }
        else if (v === color) { seen[n] = 1; stones.push(n); }
      }
    }
    return { color: color, stones: stones, liberties: libs };
  }
  /* 眼（简单定义）：空点且所有邻居都是自己或边界 */
  function isEye(pos, i, color) {
    if (pos.board[i] !== 0) return false;
    var nb = neighbors(pos, i);
    for (var m = 0; m < nb.length; m++) {
      if (pos.board[nb[m]] !== color) return false;
    }
    return true;
  }
  /* 某方所有只剩一口气的块（被打吃状态） */
  function atariGroups(pos, color) {
    var size = pos.size, out = [];
    var seen = new Uint8Array(size * size);
    for (var i = 0; i < size * size; i++) {
      if (seen[i] || pos.board[i] !== color) continue;
      var gr = group(pos, i);
      for (var k = 0; k < gr.stones.length; k++) seen[gr.stones[k]] = 1;
      if (gr.liberties.length === 1) out.push(gr);
    }
    return out;
  }

  /* ---------- 行棋 ---------- */
  /* 合法性检查（不改局面） */
  function checkMove(pos, i) {
    if (i < 0) return { ok: true, code: 'pass' };
    if (i >= pos.size * pos.size) return { ok: false, code: 'outside' };
    if (pos.board[i] !== 0) return { ok: false, code: 'occupied' };
    var color = pos.toMove, opp = 3 - color, size = pos.size;
    var cap = [];
    var nb = neighbors(pos, i);
    for (var m = 0; m < nb.length; m++) {
      var n = nb[m];
      if (pos.board[n] === opp) {
        var gr = group(pos, n);
        if (gr.liberties.length === 1 && gr.liberties[0] === i) cap.push.apply(cap, gr.stones);
      }
    }
    pos.board[i] = color;                 // 临时放子求气
    var own = group(pos, i);
    pos.board[i] = 0;
    if (own.liberties.length === 0 && cap.length === 0) return { ok: false, code: 'suicide' };
    var x = i % size, y = (i / size) | 0;
    var h = pos.hash ^ Z[zIdx(x, y, color)] ^ Z[Z_TOMOVE];
    for (var u = 0; u < cap.length; u++) {
      var s = cap[u];
      h ^= Z[zIdx(s % size, (s / size) | 0, opp)];
    }
    if ((h >>> 0) === (pos.prevHash >>> 0)) return { ok: false, code: 'ko' };
    return { ok: true, code: 'ok' };
  }
  /* 落子（原地修改；传入 log 数组则记录回溯信息）；i<0 表示停一手 */
  function applyMove(pos, i, log) {
    var rec = {
      i: i, captured: [], hash: pos.hash, prevHash: pos.prevHash,
      toMove: pos.toMove, caps: pos.caps.slice(), passes: pos.passes,
      moves: pos.moves, lastMove: pos.lastMove, capturedCnt: pos.captured
    };
    if (i < 0) {
      var oldH = pos.hash;
      pos.toMove = 3 - pos.toMove;
      pos.passes++; pos.moves++; pos.lastMove = -1; pos.captured = 0;
      pos.hash ^= Z[Z_TOMOVE];             // V2 增量哈希：toMove 翻转
      pos.prevHash = oldH;
      if (log) log.push(rec);
      return true;
    }
    if (i >= pos.size * pos.size || pos.board[i] !== 0) return false;
    var color = pos.toMove, opp = 3 - color, size2 = pos.size;
    pos.board[i] = color;
    pos.hash ^= Z[zIdx(i % size2, (i / size2) | 0, color)];   // V2 增量：落子
    var nb = neighbors(pos, i);
    for (var m = 0; m < nb.length; m++) {
      var n = nb[m];
      if (pos.board[n] === opp) {
        var gr = group(pos, n);
        if (gr.liberties.length === 0) {
          for (var t = 0; t < gr.stones.length; t++) {
            pos.board[gr.stones[t]] = 0;
            pos.hash ^= Z[zIdx(gr.stones[t] % size2, (gr.stones[t] / size2) | 0, opp)];  // V2 增量：提子
            rec.captured.push(gr.stones[t]);
          }
        }
      }
    }
    pos.caps[color - 1] += rec.captured.length;
    var own = group(pos, i);
    if (own.liberties.length === 0) {      // 禁着（自杀）
      pos.board[i] = 0;
      pos.hash ^= Z[zIdx(i % size2, (i / size2) | 0, color)];
      for (var u1 = 0; u1 < rec.captured.length; u1++) {
        pos.board[rec.captured[u1]] = opp;
        pos.hash ^= Z[zIdx(rec.captured[u1] % size2, (rec.captured[u1] / size2) | 0, opp)];
      }
      pos.caps[color - 1] -= rec.captured.length;
      return false;
    }
    pos.toMove = opp; pos.passes = 0; pos.moves++;
    pos.lastMove = i; pos.captured = rec.captured.length;
    pos.hash ^= Z[Z_TOMOVE];               // V2 增量：toMove 翻转
    if (pos.hash === pos.prevHash) {       // 劫（同形禁手）
      pos.board[i] = 0;
      pos.hash ^= Z[zIdx(i % size2, (i / size2) | 0, color)] ^ Z[Z_TOMOVE];
      for (var u2 = 0; u2 < rec.captured.length; u2++) {
        pos.board[rec.captured[u2]] = opp;
        pos.hash ^= Z[zIdx(rec.captured[u2] % size2, (rec.captured[u2] / size2) | 0, opp)];
      }
      pos.caps[color - 1] -= rec.captured.length;
      pos.toMove = rec.toMove; pos.passes = rec.passes; pos.moves = rec.moves;
      pos.lastMove = rec.lastMove; pos.captured = rec.capturedCnt;
      pos.hash = rec.hash;
      return false;
    }
    pos.prevHash = rec.hash;
    if (log) log.push(rec);
    return true;
  }
  function undoMove(pos, log) {
    var rec = log.pop();
    if (!rec) return false;
    if (rec.i >= 0) {
      pos.board[rec.i] = 0;
      for (var k = 0; k < rec.captured.length; k++) pos.board[rec.captured[k]] = 3 - rec.toMove;
    }
    pos.toMove = rec.toMove; pos.caps = rec.caps; pos.passes = rec.passes;
    pos.moves = rec.moves; pos.lastMove = rec.lastMove; pos.captured = rec.capturedCnt;
    pos.hash = rec.hash; pos.prevHash = rec.prevHash;
    return true;
  }
  /* 直接摆子（复盘/导入/教学摆子），不判合法性 */
  function placeRaw(pos, i, color) {
    if (i < 0 || i >= pos.size * pos.size || pos.board[i] !== 0) return false;
    pos.board[i] = color;
    pos.hash = computeHash(pos);
    return true;
  }
  function setup(pos, stones) {
    for (var k = 0; k < stones.length; k++) placeRaw(pos, stones[k].y * pos.size + stones[k].x, stones[k].c || 1);
  }

  /* ---------- 星位与让子 ---------- */
  function starPoints(size) {
    if (size === 9) return [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]];
    if (size === 13) return [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]];
    return [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]];
  }
  /* 让子摆法（黑方视角，右上/左下优先） */
  function handicapStones(size, n) {
    var corners, sides, center;
    if (size === 9) {
      corners = [[6, 2], [2, 6], [6, 6], [2, 2]];
      sides = [[4, 2], [2, 4], [6, 4], [4, 6]];
      center = [4, 4];
      n = Math.min(n, 5);
    } else if (size === 13) {
      corners = [[9, 3], [3, 9], [9, 9], [3, 3]];
      sides = [[6, 3], [3, 6], [9, 6], [6, 9]];
      center = [6, 6];
    } else {
      corners = [[15, 3], [3, 15], [15, 15], [3, 3]];
      sides = [[9, 3], [3, 9], [15, 9], [9, 15]];
      center = [9, 9];
    }
    var seq;
    if (n <= 4) seq = corners.slice(0, n);
    else if (n === 5) seq = corners.concat([center]);
    else if (n === 6) seq = corners.concat([sides[1], sides[2]]);
    else if (n === 7) seq = corners.concat([sides[1], sides[2], center]);
    else if (n === 8) seq = corners.concat([sides[1], sides[2], sides[0], sides[3]]);
    else seq = corners.concat([sides[1], sides[2], sides[0], sides[3], center]);
    return seq;
  }

  /* ---------- 终局数子（中国规则） ---------- */
  /* 空点归属：1=黑空 2=白空 3=中立（单官）；死子点按空点参与洪泛 */
  function territoryMap(pos, deadSet) {
    var size = pos.size;
    var t = new Uint8Array(size * size);
    for (var i = 0; i < size * size; i++) {
      if (t[i] !== 0) continue;
      if (pos.board[i] !== 0 && !(deadSet && deadSet.has(i))) continue;
      var region = [], stack = [i], b = false, w = false;
      t[i] = 9;
      while (stack.length) {
        var s = stack.pop();
        region.push(s);
        var nb = neighbors(pos, s);
        for (var m = 0; m < nb.length; m++) {
          var n = nb[m];
          var v = pos.board[n];
          var dead = deadSet && deadSet.has(n);
          if (v === 0 || dead) {
            if (t[n] === 0) { t[n] = 9; stack.push(n); }
          } else if (v === 1) b = true;
          else w = true;
        }
      }
      var val = (b && w) ? 3 : (b ? 1 : 2);
      for (var r = 0; r < region.length; r++) t[region[r]] = val;
    }
    return t;
  }
  function score(pos, deadSet) {
    var t = territoryMap(pos, deadSet);
    var size = pos.size;
    var black = 0, white = 0;
    for (var i = 0; i < size * size; i++) {
      var v = pos.board[i];
      var dead = deadSet && deadSet.has(i);
      if (v === 0 || dead) {
        if (t[i] === 1) black++;
        else if (t[i] === 2) white++;
      } else if (v === 1) black++;
      else white++;
    }
    var whiteTotal = white + pos.komi;
    var diff = black - whiteTotal;
    return {
      black: black, white: white, komi: pos.komi, whiteTotal: whiteTotal,
      diff: diff, winner: diff > 0 ? 1 : (diff < 0 ? 2 : 0), territory: t
    };
  }
  /* 死子启发式：将该块视为空后，其所有气口若只接触对方活子且眼数 ≤1，判为死子（供自动标记参考） */
  function autoDeadCandidates(pos) {
    var size = pos.size, out = new Set();
    var visited = new Uint8Array(size * size);
    for (var i = 0; i < size * size; i++) {
      if (visited[i] || pos.board[i] === 0) continue;
      var gr = group(pos, i);
      for (var k = 0; k < gr.stones.length; k++) visited[gr.stones[k]] = 1;
      var opp = 3 - gr.color;
      if (gr.liberties.length === 0 || gr.stones.length > 8) continue;
      var ignore = new Set();
      for (var s0 = 0; s0 < gr.stones.length; s0++) ignore.add(gr.stones[s0]);
      var t0 = territoryMap(pos, ignore);
      var allOpp = true, eyes = 0;
      for (var m = 0; m < gr.liberties.length; m++) {
        var L = gr.liberties[m];
        if (t0[L] !== opp) { allOpp = false; break; }
        var isEyePt = true;
        var nb = neighbors(pos, L);
        for (var q = 0; q < nb.length; q++) {
          var v = pos.board[nb[q]];
          if (v !== 0 && v !== gr.color) { isEyePt = false; break; }
        }
        if (isEyePt) eyes++;
      }
      if (allOpp && eyes <= 1) {
        for (var s2 = 0; s2 < gr.stones.length; s2++) out.add(gr.stones[s2]);
      }
    }
    return out;
  }

  g.GoRules = {
    MAX: MAX, create: create, clone: clone, neighbors: neighbors,
    idx: idx, xy: xy, display: display, parseCoord: parseCoord,
    computeHash: computeHash, group: group, isEye: isEye, atariGroups: atariGroups,
    checkMove: checkMove, applyMove: applyMove, undoMove: undoMove,
    placeRaw: placeRaw, setup: setup, starPoints: starPoints,
    handicapStones: handicapStones, territoryMap: territoryMap,
    score: score, autoDeadCandidates: autoDeadCandidates
  };
})(typeof window !== 'undefined' ? window : globalThis);
