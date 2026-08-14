/* =============================================================
 * 《落子无悔》· AI 引擎
 * 启发式战术 + 蒙特卡洛 UCT 搜索，四档难度；
 * 附带：落子点评讲解、玩家危险落子提醒、请指教提示。
 * 依赖 window.GoRules。
 * ============================================================= */
(function (g) {
  'use strict';
  var R = g.GoRules;

  var DIFFS = [
    { id: 'beginner', name: '启蒙', desc: '轻松体验，AI 下棋随意' },
    { id: 'easy', name: '入门', desc: '新手友好，掌握规则后能赢' },
    { id: 'medium', name: '进阶', desc: '需要一定的吃子与死活技巧' },
    { id: 'hard', name: '挑战', desc: '认真对局，AI 会全力思考' },
    { id: 'master', name: '巅峰', desc: '最高难度：全力思考，棋力大增' }
  ];
  var BUDGET = {
    medium: { 9: 700, 13: 450, 19: 250 },
    hard: { 9: 1600, 13: 1000, 19: 500 },
    master: { 9: 4000, 13: 2200, 19: 800 }
  };
  var HINT_BUDGET = 260;

  function ctxOf(pos) { return { color: pos.toMove, opp: 3 - pos.toMove, size: pos.size, moves: pos.moves, lastMove: pos.lastMove }; }

  /* ---------- 启发式评分 ---------- */
  function heuristic(pos, i, ctx) {
    var s = 0, reasons = [];
    var nb = R.neighbors(pos, i);
    var capCount = 0;
    for (var m = 0; m < nb.length; m++) {
      var n = nb[m];
      if (pos.board[n] === ctx.opp) {
        var gr = R.group(pos, n);
        if (gr.liberties.length === 1 && gr.liberties[0] === i) capCount += gr.stones.length;
        else if (gr.liberties.length === 2 && gr.liberties.indexOf(i) >= 0) { s += 70; if (reasons.indexOf('atari') < 0) reasons.push('atari'); }
        else if (gr.liberties.length === 2) s += 22;
        else if (gr.liberties.length === 3) s += 8;
      }
    }
    if (capCount > 0) { s += 480 + capCount * 180; reasons.push('capture:' + capCount); }
    var savedKey = {};
    var saves = 0;
    for (var m2 = 0; m2 < nb.length; m2++) {
      var n2 = nb[m2];
      if (pos.board[n2] !== ctx.color) continue;
      var gr2 = R.group(pos, n2);
      if (savedKey[gr2.stones[0]]) continue;
      savedKey[gr2.stones[0]] = 1;
      if (gr2.liberties.length === 1) saves += gr2.stones.length;
    }
    if (saves > 0) { s += 260 + saves * 70; reasons.push('save:' + saves); }
    if (capCount === 0 && R.isEye(pos, i, ctx.color)) { s -= 280; reasons.push('eye'); }
    var ownNb = 0;
    for (var m3 = 0; m3 < nb.length; m3++) if (pos.board[nb[m3]] === ctx.color) ownNb++;
    if (ownNb > 0 && saves === 0 && capCount === 0) s += 26 + ownNb * 7;
    if (ctx.moves < 14) {
      var x = i % ctx.size, y = (i / ctx.size) | 0;
      var cx = Math.min(x, ctx.size - 1 - x), cy = Math.min(y, ctx.size - 1 - y);
      var corner = Math.max(cx, cy);
      if (ctx.size === 9) s += (4 - corner) * 34;
      else s += Math.max(0, 6 - corner) * 17;
      var d = Math.min(
        Math.abs(x - 2) + Math.abs(y - 2), Math.abs(x - 3) + Math.abs(y - 3),
        Math.abs(x - 3) + Math.abs(y - 4), Math.abs(x - 4) + Math.abs(y - 3),
        Math.abs(x - (ctx.size - 3)) + Math.abs(y - 2), Math.abs(x - (ctx.size - 4)) + Math.abs(y - 3),
        Math.abs(x - (ctx.size - 4)) + Math.abs(y - 4), Math.abs(x - (ctx.size - 3)) + Math.abs(y - 3),
        Math.abs(x - 2) + Math.abs(y - (ctx.size - 3)), Math.abs(x - 3) + Math.abs(y - (ctx.size - 4)),
        Math.abs(x - 4) + Math.abs(y - (ctx.size - 4)), Math.abs(x - 3) + Math.abs(y - (ctx.size - 3))
      );
      if (d <= 1) s += 46 - d * 12;
    }
    var near = 0;
    for (var m4 = 0; m4 < nb.length; m4++) if (pos.board[nb[m4]] !== 0) near++;
    if (near >= 2) s += 12;
    // V2：四周对方子多且自己无接应 → 危险点轻罚（避免送吃）
    if (capCount === 0) {
      var oppN = 0, ownN = 0;
      for (var m5 = 0; m5 < nb.length; m5++) {
        if (pos.board[nb[m5]] === ctx.opp) oppN++;
        else if (pos.board[nb[m5]] === ctx.color) ownN++;
      }
      if (oppN >= 3 && ownN === 0) s -= 40;
    }
    // V2：靠近对方最后一手 → 局部应手更积极
    if (ctx.lastMove >= 0) {
      var lx = ctx.lastMove % ctx.size, ly = (ctx.lastMove / ctx.size) | 0;
      var mx = i % ctx.size, my = (i / ctx.size) | 0;
      var dd = Math.max(Math.abs(mx - lx), Math.abs(my - ly));
      if (dd <= 1) s += 26;
      else if (dd <= 2) s += 10;
    }
    s += (Math.random() * 26) | 0;
    return { score: s, reasons: reasons };
  }

  /* ---------- 候选点 ---------- */
  function candidates(pos) {
    var size = pos.size;
    var list = [], mark = new Uint8Array(size * size);
    function add(i) { if (pos.board[i] === 0 && !mark[i]) { mark[i] = 1; list.push(i); } }
    var hasStone = false;
    for (var i = 0; i < size * size; i++) if (pos.board[i]) { hasStone = true; break; }
    if (!hasStone) {
      var sp = R.starPoints(size);
      for (var k = 0; k < sp.length; k++) add(sp[k][1] * size + sp[k][0]);
      return list;
    }
    for (var i2 = 0; i2 < size * size; i2++) {
      if (!pos.board[i2]) continue;
      var x = i2 % size, y = (i2 / size) | 0;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
        var nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) add(ny * size + nx);
      }
    }
    return list;
  }

  /* ---------- 蒙特卡洛盘面模拟 ---------- */
  /* 轻量评分：只做提子/眼/占角判断（快） */
  function cheapScore(p, i, ctx) {
    var s = 0;
    var nb = R.neighbors(p, i);
    for (var m = 0; m < nb.length; m++) {
      var n = nb[m];
      if (p.board[n] === ctx.opp) {
        var gr = R.group(p, n);
        if (gr.liberties.length === 1 && gr.liberties[0] === i) s += 900;
        else if (gr.liberties.length === 2) s += 40;
      }
    }
    if (R.isEye(p, i, ctx.color)) s -= 300;
    if (ctx.moves < 10) {
      var x = i % ctx.size, y = (i / ctx.size) | 0;
      var cx = Math.min(x, ctx.size - 1 - x), cy = Math.min(y, ctx.size - 1 - y);
      s += Math.max(0, 4 - Math.max(cx, cy)) * 25;
    }
    return s;
  }
  function playoutMove(p, rng, log) {
    var cands = candidates(p);
    if (!cands.length) return -1;
    var ctx = ctxOf(p);
    for (var f0 = 0; f0 < cands.length; f0++) {
      var j0 = (rng() * (cands.length - f0)) | 0;
      var t0 = cands[f0]; cands[f0] = cands[f0 + j0]; cands[f0 + j0] = t0;
    }
    var evalN = Math.min(5, cands.length);
    var scored = [];
    for (var k = 0; k < evalN; k++) scored.push({ i: cands[k], s: cheapScore(p, cands[k], ctx) });
    scored.sort(function (a, b) { return b.s - a.s; });
    var top = scored.slice(0, 2);
    for (var t2 = 0; t2 < top.length; t2++) top[t2].s = heuristic(p, top[t2].i, ctx).score;
    top.sort(function (a, b) { return b.s - a.s; });
    var total = 0;
    for (var t = 0; t < top.length; t++) { top[t].w = Math.max(1, top[t].s - top[top.length - 1].s + 22); total += top[t].w; }
    var r = rng() * total, acc = 0;
    for (var u = 0; u < top.length; u++) {
      acc += top[u].w;
      if (r <= acc && R.applyMove(p, top[u].i, log)) return top[u].i;
    }
    for (var f = evalN; f < cands.length; f++) {
      var j = (rng() * (cands.length - f)) | 0;
      var tmp = cands[f]; cands[f] = cands[f + j]; cands[f + j] = tmp;
    }
    for (var f2 = 0; f2 < cands.length; f2++) if (R.applyMove(p, cands[f2], log)) return cands[f2];
    return -1;
  }
  /* 快速胜负：子数差 + 提子差 + 贴目（比领地洪泛快得多，适合蒙特卡洛统计） */
  function quickWin(p) {
    var black = p.caps[0], white = p.caps[1];
    for (var i = 0; i < p.size * p.size; i++) {
      if (p.board[i] === 1) black++;
      else if (p.board[i] === 2) white++;
    }
    return black >= white + p.komi ? 1 : 0;
  }
  function playout(pos, rng) {
    var p = R.clone(pos);
    var log = [];
    var passes = 0;
    var limit = pos.size === 19 ? 110 : (pos.size === 13 ? 80 : 60);
    while (passes < 2 && (p.moves - pos.moves) < limit && log.length < 4000) {
      var mv = playoutMove(p, rng, log);
      if (mv < 0) passes++; else passes = 0;
    }
    return quickWin(p); // 黑胜=1
  }

  /* ---------- UCT ---------- */
  function uctRoot(pos) {
    var ctx = ctxOf(pos);
    var cands = candidates(pos);
    var legal = [];
    for (var k = 0; k < cands.length; k++) {
      var c = cands[k];
      var he = heuristic(pos, c, ctx);
      var test = R.clone(pos), lg = [];
      if (R.applyMove(test, c, lg)) legal.push({ i: c, prior: he.score, plays: 0, wins: 0 });
    }
    if (!legal.length) return null;
    var minP = Infinity, maxP = -Infinity;
    for (var q = 0; q < legal.length; q++) { minP = Math.min(minP, legal[q].prior); maxP = Math.max(maxP, legal[q].prior); }
    for (var q2 = 0; q2 < legal.length; q2++) legal[q2].prior = (maxP === minP ? 1 : (legal[q2].prior - minP) / (maxP - minP)) + 0.08;
    return { pos: pos, legal: legal, total: 0 };
  }

  async function uctSearch(pos, budget, rng, onProgress) {
    var root = uctRoot(pos);
    if (!root) return -1;
    // 每个子节点先模拟一次
    for (var c3 = 0; c3 < root.legal.length; c3++) {
      var p2 = R.clone(pos), lg2 = [];
      R.applyMove(p2, root.legal[c3].i, lg2);
      var w = playout(p2, rng);
      root.legal[c3].plays++;
      root.legal[c3].wins += (pos.toMove === 1 ? w : 1 - w);
      root.total++;
    }
    var C = 1.15, CHUNK = 140;
    while (root.total < budget) {
      var end = Math.min(root.total + CHUNK, budget);
      for (; root.total < end; root.total++) {
        var best = -1, bestU = -Infinity;
        for (var s4 = 0; s4 < root.legal.length; s4++) {
          var n = root.legal[s4];
          var u = n.wins / n.plays + C * Math.sqrt(Math.log(root.total + 1) / n.plays) + 0.35 * n.prior / (1 + n.plays);
          if (u > bestU) { bestU = u; best = s4; }
        }
        var sel = root.legal[best];
        var p3 = R.clone(pos), lg3 = [];
        R.applyMove(p3, sel.i, lg3);
        var w3 = playout(p3, rng);
        sel.plays++;
        sel.wins += (pos.toMove === 1 ? w3 : 1 - w3);
      }
      if (onProgress) onProgress(root.total / budget);
      await new Promise(function (r2) { setTimeout(r2, 0); });
    }
    var bestM = root.legal[0];
    for (var f2 = 1; f2 < root.legal.length; f2++) {
      var a = root.legal[f2], b = bestM;
      var ma = a.wins / a.plays, mb = b.wins / b.plays;
      if (ma > mb || (ma === mb && a.plays > b.plays)) bestM = a;
    }
    return { idx: bestM.i, rate: bestM.wins / bestM.plays, root: root };
  }

  /* ---------- 对外：AI 思考 ---------- */
  function think(pos, difficulty, opts) {
    opts = opts || {};
    var budget = opts.budget != null ? opts.budget : (BUDGET[difficulty] && BUDGET[difficulty][pos.size]);
    var rng = Math.random;
    return new Promise(function (resolve) {
      var mv = -1;
      if (difficulty === 'beginner') {
        var cands = candidates(pos);
        var caps = [];
        for (var k = 0; k < cands.length; k++) {
          var t = R.clone(pos), lg = [];
          if (R.applyMove(t, cands[k], lg) && t.captured > 0) caps.push(cands[k]);
        }
        var pool = (caps.length && rng() < 0.72) ? caps : cands;
        for (var f = 0; f < pool.length; f++) {
          var j = (rng() * (pool.length - f)) | 0;
          var tmp = pool[f]; pool[f] = pool[f + j]; pool[f + j] = tmp;
        }
        for (var f2 = 0; f2 < pool.length; f2++) {
          var t2 = R.clone(pos), lg2 = [];
          if (R.applyMove(t2, pool[f2], lg2)) { mv = pool[f2]; break; }
        }
        setTimeout(function () { resolve(mv); }, 380 + rng() * 480);
        return;
      }
      if (difficulty === 'easy') {
        var ctx = ctxOf(pos);
        var scored = [];
        var cands2 = candidates(pos);
        for (var k2 = 0; k2 < cands2.length; k2++) {
          var t3 = R.clone(pos), lg3 = [];
          if (R.applyMove(t3, cands2[k2], lg3)) scored.push({ i: cands2[k2], s: heuristic(pos, cands2[k2], ctx).score });
        }
        scored.sort(function (a, b) { return b.s - a.s; });
        if (scored.length) {
          var topN = Math.min(3, scored.length);
          var pick = topN - 1;
          if (rng() < 0.55) pick = 0;
          else if (rng() < 0.85) pick = Math.min(1, topN - 1);
          mv = scored[pick].i;
        }
        setTimeout(function () { resolve(mv); }, 420 + rng() * 520);
        return;
      }
      uctSearch(pos, budget, rng, opts.onProgress).then(function (res) {
        if (res === -1) { resolve(-1); return; }
        var heBest = res.idx >= 0 ? heuristic(pos, res.idx, ctxOf(pos)) : null;
        var passTh = difficulty === 'master' ? 0.16 : (difficulty === 'hard' ? 0.22 : 0.24);
        if (heBest && res.rate < passTh && heBest.reasons.length === 0 && pos.moves > 24) resolve(-1);
        else resolve(res.idx);
      });
    });
  }

  /* ---------- 请指教：推荐一手 + 讲解 ---------- */
  function hint(pos, difficulty) {
    var d = (difficulty === 'beginner' || difficulty === 'easy') ? 'easy' : difficulty;
    return new Promise(function (resolve) {
      if (d === 'easy') {
        var ctx = ctxOf(pos);
        var cands = candidates(pos);
        var best = -1, bestS = -Infinity;
        for (var k = 0; k < cands.length; k++) {
          var t = R.clone(pos), lg = [];
          if (!R.applyMove(t, cands[k], lg)) continue;
          var s = heuristic(pos, cands[k], ctx).score;
          if (s > bestS) { bestS = s; best = cands[k]; }
        }
        resolve({ idx: best, text: best >= 0 ? explainMove(pos, best) : '没有可下的棋了，可以选择停一手。' });
      } else {
        uctSearch(pos, HINT_BUDGET, Math.random, null).then(function (res) {
          if (res === -1) { resolve({ idx: -1, text: '没有可下的棋了，可以选择停一手。' }); return; }
          resolve({ idx: res.idx, text: explainMove(pos, res.idx) });
        });
      }
    });
  }

  /* ---------- 落子讲解 ---------- */
  function explainMove(pos, i) {
    if (i < 0) return '盘面已经定型，停一手进入收官。';
    var color = pos.board[i] || (3 - pos.toMove);
    var ctx = { color: color, opp: 3 - color, size: pos.size, moves: pos.moves - 1 };
    var he = heuristic(pos, i, ctx);
    var r = he.reasons;
    for (var k = 0; k < r.length; k++) {
      if (r[k].indexOf('capture') === 0) {
        var n = parseInt(r[k].split(':')[1], 10) || 1;
        return '提吃对方 ' + n + ' 子，收获实利！';
      }
      if (r[k].indexOf('save') === 0) {
        var m = parseInt(r[k].split(':')[1], 10) || 1;
        return '救出被打吃的 ' + m + ' 子，这块棋安全了。';
      }
    }
    if (r.indexOf('atari') >= 0) return '打吃！对方这块棋只剩一口气，需要马上应对。';
    if (r.indexOf('eye') >= 0) return '护住眼位，确保棋形安定。';
    var x = i % ctx.size, y = (i / ctx.size) | 0;
    var cx = Math.min(x, ctx.size - 1 - x), cy = Math.min(y, ctx.size - 1 - y);
    if (ctx.moves < 12 && Math.max(cx, cy) <= 2) return '开局抢占角部要点——「金角银边草肚皮」。';
    var nb = R.neighbors(pos, i);
    var own = 0;
    for (var m2 = 0; m2 < nb.length; m2++) if (pos.board[nb[m2]] === ctx.color) own++;
    if (own >= 2) return '连接己方棋子，阵势更厚实。';
    if (own === 1) return '延展己方阵势，稳步推进。';
    return '占据要点，限制对方发展。';
  }

  /* ---------- 玩家落子前的检查：禁着说明 / 危险提醒 ---------- */
  function userMoveWarning(pos, i) {
    var chk = R.checkMove(pos, i);
    if (!chk.ok) {
      return {
        block: true, code: chk.code,
        text: chk.code === 'suicide' ? '禁着点：这里落子后自己没有气、又提不掉对方的子，规则不允许下。'
          : chk.code === 'ko' ? '打劫！不能立刻回提——同形禁手。先在他处下一手（找劫材），对方应了才能回来提劫。'
          : chk.code === 'occupied' ? '这里已经有子了。' : '这里不能落子。'
      };
    }
    var he = heuristic(pos, i, ctxOf(pos));
    if (he.reasons.indexOf('eye') >= 0) {
      return { block: false, warn: true, text: '这是你一块棋的「眼」。填掉眼位，这块棋可能会被吃——确定要下这里吗？' };
    }
    return null;
  }

  g.GoAI = { DIFFS: DIFFS, think: think, hint: hint, explainMove: explainMove, userMoveWarning: userMoveWarning };
})(typeof window !== 'undefined' ? window : globalThis);
