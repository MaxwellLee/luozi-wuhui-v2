/* =============================================================
 * 《落子无悔》· 对局页控制器
 * 猜先 / 练习 / 让子 / AI 对战 / 提示与点评 / 数子 / 认输 / 悔棋 / 自动存档
 * ============================================================= */
(function (g) {
  'use strict';
  var R = g.GoRules, AI = g.GoAI, U = g.GoUtil, S = g.GoStorage, A = g.GameAudio;

  function $(id) { return document.getElementById(id); }
  var state = null;
  var els = {};

  function init() {
    els = {
      board: $('board-container'), status: $('board-status'),
      speech: $('speech-text'), speechAvatar: $('speech-avatar'),
      log: $('game-log-list'), playerMeta: $('player-meta'), aiMeta: $('ai-meta'),
      playerName: $('player-name'), turnP: $('turn-player'), turnA: $('turn-ai'),
      avatarP: $('game-avatar-player'), avatarA: $('game-avatar-ai'),
      badge: $('mode-badge'), difficulty: $('game-difficulty'), diffRow: $('diff-row'), oppName: $('opp-name'),
      hint: $('btn-hint'), score: $('btn-score'), pass: $('btn-pass'),
      undo: $('btn-undo'), resign: $('btn-resign'), leave: $('btn-leave-game'),
      toggleHints: $('toggle-hints'), toggleComments: $('toggle-comments'), toggleSound: $('toggle-sound')
    };
    els.speechAvatar.innerHTML = g.Avatars.ai('normal');
    els.avatarP.innerHTML = g.Avatars.player('normal');
    els.avatarA.innerHTML = g.Avatars.ai('normal');
    els.hint.addEventListener('click', onHint);
    els.score.addEventListener('click', onScore);
    els.pass.addEventListener('click', onPass);
    els.undo.addEventListener('click', onUndo);
    els.resign.addEventListener('click', onResign);
    els.leave.addEventListener('click', onLeave);
    els.difficulty.addEventListener('change', function () {
      var d = this.value;
      if (state) state.difficulty = d;
      g.App.setSettings({ difficulty: d });
      U.toast('AI 难度已切换为「' + diffName(d) + '」');
    });
    els.toggleHints.addEventListener('change', function () { g.App.setSettings({ hints: this.checked }); });
    els.toggleComments.addEventListener('change', function () { g.App.setSettings({ comments: this.checked }); });
    els.toggleSound.addEventListener('change', function () { g.App.setSettings({ sound: this.checked }); });
    var chatBtns = document.querySelectorAll('.qp-btn');
    for (var ci = 0; ci < chatBtns.length; ci++) {
      (function (b) { b.addEventListener('click', function () { sendChat(b.getAttribute('data-chat')); }); })(chatBtns[ci]);
    }
    g.Net.on('data', onNetData);
  }
  function diffName(id) {
    for (var i = 0; i < AI.DIFFS.length; i++) if (AI.DIFFS[i].id === id) return AI.DIFFS[i].name;
    return id;
  }
  function refreshSettings() {
    var s = g.App.getSettings();
    if (els.toggleHints) els.toggleHints.checked = !!s.hints;
    if (els.toggleComments) els.toggleComments.checked = !!s.comments;
    if (els.toggleSound) els.toggleSound.checked = !!s.sound;
    if (els.difficulty) els.difficulty.value = state ? state.difficulty : s.difficulty;
    if (state) updateUI();
  }
  function getBoard() { return state ? state.board : null; }

  /* ---------- 开局流程 ---------- */
  function newGameFlow() {
    var s = g.App.getSettings();
    var ngModal = g.App.modal({
      title: '开始对局',
      body:
        '<div class="option-row"><label>对局模式</label>' +
        '<div class="handicap-opts" id="mode-opts">' +
        '<button class="active" data-mode="formal">正式对局 · 猜先</button>' +
        '<button data-mode="practice">快速练习</button></div></div>' +
        '<div class="option-row"><label>棋盘大小</label>' +
        '<select id="ng-size">' +
        '<option value="9"' + (s.size === 9 ? ' selected' : '') + '>9 路（新手推荐）</option>' +
        '<option value="13"' + (s.size === 13 ? ' selected' : '') + '>13 路</option>' +
        '<option value="19"' + (s.size === 19 ? ' selected' : '') + '>19 路</option></select></div>' +
        '<div class="option-row"><label>AI 难度</label>' +
        '<select id="ng-diff">' +
        '<option value="beginner"' + (s.difficulty === 'beginner' ? ' selected' : '') + '>启蒙</option>' +
        '<option value="easy"' + (s.difficulty === 'easy' ? ' selected' : '') + '>入门</option>' +
        '<option value="medium"' + (s.difficulty === 'medium' ? ' selected' : '') + '>进阶</option>' +
        '<option value="hard"' + (s.difficulty === 'hard' ? ' selected' : '') + '>挑战</option>' +
        '<option value="master"' + (s.difficulty === 'master' ? ' selected' : '') + '>巅峰</option></select></div>' +
        '<div id="practice-opts" class="hidden">' +
        '<div class="option-row"><label>你执</label>' +
        '<div class="handicap-opts" id="color-opts">' +
        '<button class="active" data-color="1">黑（先行）</button>' +
        '<button data-color="2">白</button></div></div>' +
        '<div class="option-row"><label>让子</label>' +
        '<div class="handicap-opts" id="handi-opts"></div></div></div>',
      actions: [{ label: '取消', cls: 'ghost' }, { label: '开始', cls: 'primary' }]
    });
    var mode = 'formal', color = 1, handicap = 0, letFirst = false;
    var handiBtns = [];
    function buildHandi(size) {
      var max = size === 9 ? 5 : 9;
      var box = $('handi-opts');
      box.innerHTML = '';
      handiBtns = [];
      var items = [{ label: '让先', v: -1 }, { label: '0', v: 0 }];
      for (var h = 2; h <= max; h++) items.push({ label: String(h), v: h });
      for (var i = 0; i < items.length; i++) {
        (function (it) {
          var b = document.createElement('button');
          b.textContent = it.label;
          if (it.v === 0) b.classList.add('active');
          b.addEventListener('click', function () {
            if (it.v === -1) { letFirst = true; handicap = 0; }
            else { letFirst = false; handicap = it.v; }
            for (var k = 0; k < handiBtns.length; k++) handiBtns[k].classList.remove('active');
            b.classList.add('active');
          });
          box.appendChild(b);
          handiBtns.push(b);
        })(items[i]);
      }
    }
    var modeBtns = $('mode-opts').querySelectorAll('button');
    for (var i = 0; i < modeBtns.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          mode = b.getAttribute('data-mode');
          for (var k = 0; k < modeBtns.length; k++) modeBtns[k].classList.remove('active');
          b.classList.add('active');
          $('practice-opts').classList.toggle('hidden', mode !== 'practice');
        });
      })(modeBtns[i]);
    }
    var colorBtns = $('color-opts').querySelectorAll('button');
    for (var j = 0; j < colorBtns.length; j++) {
      (function (b) {
        b.addEventListener('click', function () {
          color = parseInt(b.getAttribute('data-color'), 10);
          for (var k = 0; k < colorBtns.length; k++) colorBtns[k].classList.remove('active');
          b.classList.add('active');
        });
      })(colorBtns[j]);
    }
    var sizeSel = $('ng-size');
    buildHandi(parseInt(sizeSel.value, 10));
    sizeSel.addEventListener('change', function () { buildHandi(parseInt(this.value, 10)); });
    var actBtns = document.querySelectorAll('#modal-box [data-act]');
    actBtns[1].onclick = function () {
      try {
        // 注意：必须先把值读出来，再关闭弹窗（关弹窗会清空内部元素）
        var size = parseInt(sizeSel.value, 10);
        var diffEl = $('ng-diff');
        var difficulty = diffEl ? diffEl.value : g.App.getSettings().difficulty;
        ngModal.close();
        if (mode === 'formal') guessFirst(size, difficulty);
        else {
          var komi = (handicap > 0 || letFirst) ? 0 : 7.5;
          start({ mode: 'practice', size: size, komi: komi, handicap: handicap, letFirst: letFirst, playerColor: color, difficulty: difficulty });
        }
      } catch (e) {
        U.toast('开局失败：' + (e && e.stack ? String(e.stack).split('\n')[0] : e), 'error');
      }
    };
  }

  function guessFirst(size, difficulty) {
    var count = 2 + ((Math.random() * 9) | 0);
    var isEven = count % 2 === 0;
    g.App.modal({
      title: '猜先',
      body:
        '<p>按正式比赛的礼仪，对局前先「猜先」决定谁执黑。</p>' +
        '<p>柯洁老师抓了一把白子握在手中——请你猜单双：<strong>猜单摆 1 枚黑子，猜双摆 2 枚黑子</strong>。</p>' +
        '<div class="guess-row">' +
        '<button class="guess-btn" id="guess-odd"><span class="stone-icon black"></span>猜 单</button>' +
        '<button class="guess-btn" id="guess-even"><span class="stone-icon black"></span><span class="stone-icon black"></span>猜 双</button>' +
        '</div>',
      dismissible: false
    });
    function reveal(guessOdd) {
      var guessedRight = (count % 2 === 1) === guessOdd;
      var playerColor = guessedRight ? 1 : 2;
      g.App.modal({
        title: '猜先结果',
        body:
          '<p>柯洁老师摊开手：一共 <strong>' + count + ' 枚</strong>白子，是<strong>' + (isEven ? '双数' : '单数') + '</strong>。</p>' +
          '<p>你猜<strong>' + (guessOdd ? '单' : '双') + '</strong>——' +
          (guessedRight ? '<span class="score-win">猜对了！你执黑先行。</span>' : '<span class="score-lose">猜错了，柯洁老师执黑先行，你执白。</span>') + '</p>' +
          '<p class="muted small">黑棋先行，白棋获得 3¾ 子贴目作为补偿。</p>',
        actions: [{ label: '开始对局', cls: 'primary', onClick: function () { start({ mode: 'formal', size: size, komi: 7.5, handicap: 0, playerColor: playerColor, difficulty: difficulty }); } }]
      });
    }
    setTimeout(function () {
      var o = $('guess-odd'), e = $('guess-even');
      if (o) o.onclick = function () { A.play('click'); reveal(true); };
      if (e) e.onclick = function () { A.play('click'); reveal(false); };
    }, 60);
  }

  /* ---------- 对局生命周期 ---------- */
  function start(opts) {
    var s = g.App.getSettings();
    state = {
      mode: opts.mode, size: opts.size, komi: opts.komi,
      handicap: opts.handicap || 0, letFirst: !!opts.letFirst,
      playerColor: opts.playerColor, difficulty: opts.difficulty,
      pos: R.create(opts.size, opts.komi), log: [], moves: [], setupStones: [],
      aiThinking: false, over: false, scoring: false, deadSet: null,
      startedAt: Date.now(), cancelAI: false, savedId: null, pvp: !!opts.pvp
    };
    state.pos.handicap = state.handicap;
    if (state.handicap > 0) {
      var hs = R.handicapStones(state.size, state.handicap);
      for (var k = 0; k < hs.length; k++) R.placeRaw(state.pos, R.idx(hs[k][0], hs[k][1], state.size), 1);
      state.pos.toMove = 2;
      state.pos.hash = R.computeHash(state.pos);
      state.setupStones = hs.map(function (c) { return { x: c[0], y: c[1], c: 1 }; });
    }
    if (state.board) state.board.destroy();
    state.board = new g.GoBoard(els.board, {
      size: state.size, skin: g.App.getSettings().skin,
      interactive: true, onClick: onBoardClick
    });
    state.board.syncPosition(state.pos);
    els.log.innerHTML = '';
    els.badge.textContent = state.mode === 'formal' ? '正式对局 · 猜先'
      : (state.handicap > 0 ? '让 ' + state.handicap + ' 子' : (state.letFirst ? '让先' : '快速练习'));
    els.playerName.textContent = s.playerName;
    els.difficulty.value = state.difficulty;
    if (state.pvp) {
      els.diffRow.style.display = 'none';
      els.oppName.textContent = state.oppName || '好友';
      els.avatarA.innerHTML = g.Avatars.player('normal');
    } else {
      els.diffRow.style.display = '';
      els.oppName.textContent = '柯洁老师';
      els.avatarA.innerHTML = g.Avatars.ai('normal');
    }
    g.App.showView('view-game');
    S.clearCurrent();
    updateUI();
    if (!opts.resume) {
      if (state.pvp) {
        speak(state.playerColor === 1 ? '你是黑棋，先行！' : '你是白棋，等对方落子。');
        setTurnUI('player');
        if (state.playerColor === 1) beginPlayerTurn();
        else { state.board.setGhostColor(0); els.status.textContent = '等待对方落子……'; }
      } else {
        sayWelcome();
        if (state.playerColor === state.pos.toMove) beginPlayerTurn();
        else beginAITurn();
      }
    }
  }
  function sayWelcome() {
    if (state.mode === 'formal') {
      speak(state.playerColor === 1
        ? '我们猜先决定：你执黑先行。黑棋先行、白棋贴 3¾ 子。落子前点「请指教」，我会给你讲棋。'
        : '猜先我赢了，这局我执黑先行，你执白有 3¾ 子贴目。别担心，我会边下边讲解。');
    } else if (state.handicap > 0) {
      speak('这局我让你 ' + state.handicap + ' 子，你执黑。让子棋白方不贴目——放开下，我在旁边给你支招。');
    } else if (state.letFirst) {
      speak('这局是让先棋：你执黑先行，白方不贴目。');
    } else {
      speak('练习模式！可以随时悔棋，我会' + (g.App.getSettings().comments ? '每手棋都给你讲解。' : '尽量温柔地陪你下。'));
    }
  }
  function resume() {
    var st = S.loadCurrent();
    if (!st || !st.moves) { U.toast('没有可以继续的对局'); return; }
    start({
      mode: st.mode, size: st.size, komi: st.komi, handicap: st.handicap,
      letFirst: st.letFirst, playerColor: st.playerColor, difficulty: st.difficulty,
      resume: true
    });
    var rec = st.moves || [];
    for (var i = 0; i < rec.length; i++) {
      var m = rec[i];
      if (m.x != null) R.applyMove(state.pos, R.idx(m.x, m.y, state.size), state.log);
      else R.applyMove(state.pos, -1, state.log);
      state.moves.push(m);
      appendLog();
    }
    state.board.syncPosition(state.pos);
    if (state.pos.lastMove >= 0) state.board.setLastMove(state.pos.lastMove);
    updateUI();
    if (st.turn === 'ai') beginAITurn();
    else beginPlayerTurn();
    U.toast('已继续上次的对局');
  }

  /* ---------- 落子交互 ---------- */
  function onBoardClick(i) {
    if (!state || state.over) return;
    if (state.scoring) { toggleDead(i); return; }
    if (state.aiThinking) { U.toast('柯洁老师正在思考，请稍候'); return; }
    if (state.pos.toMove !== state.playerColor) { U.toast('现在轮到柯洁老师落子'); return; }
    var warn = AI.userMoveWarning(state.pos, i);
    if (warn && warn.block) {
      A.play('warn');
      U.toast(warn.text, 'warn');
      g.App.modal({
        title: warn.code === 'ko' ? '打劫规则' : '禁着点规则',
        body: '<p>' + U.esc(warn.text) + '</p>',
        actions: [{ label: '明白了', cls: 'primary' }]
      });
      return;
    }
    if (warn && warn.warn && g.App.getSettings().hints) {
      A.play('warn');
      g.App.modal({
        title: '危险提醒',
        body: '<p>' + U.esc(warn.text) + '</p>',
        actions: [
          { label: '再想想', cls: 'ghost' },
          { label: '坚持落子', cls: 'primary', onClick: function () { doPlayerMove(i); } }
        ]
      });
      return;
    }
    doPlayerMove(i);
  }
  function doPlayerMove(i) {
    if (!state || state.over) return;
    state.board.clearHint();
    var before = state.pos.board.slice();
    var color = state.playerColor;
    if (!R.applyMove(state.pos, i, state.log)) { U.toast('这里不能落子', 'warn'); return; }
    var removed = [];
    for (var k = 0; k < before.length; k++) if (before[k] && !state.pos.board[k]) removed.push(k);
    state.moves.push({ x: i % state.size, y: (i / state.size) | 0, c: color });
    state.board.setStone(i, color, true);
    if (removed.length) state.board.removeStones(removed, true);
    state.board.setLastMove(i);
    A.play(removed.length ? 'capture' : 'place');
    els.avatarA.innerHTML = g.Avatars.ai(removed.length ? 'surprised' : 'normal');
    if (removed.length) speak('哇，你提掉了我 ' + removed.length + ' 子！这手棋很敏锐。');
    appendLog();
    if (state.pvp) {
      g.Net.send({ t: 'move', x: i % state.size, y: (i / state.size) | 0, c: color });
      state.board.setGhostColor(0);
      setTurnUI('ai');
      els.status.textContent = '等待对方落子……';
      updateUI();
      return;
    }
    afterMove();
  }
  function afterMove() {
    updateUI();
    if (state.pos.passes >= 2) {
      saveCurrentState();
      openScoring(true);
      return;
    }
    saveCurrentState();
    if (g.App.getSettings().hints && state.pos.toMove === state.playerColor && !state.aiThinking) {
      var groups = R.atariGroups(state.pos, state.playerColor);
      if (groups.length) {
        var n = 0;
        for (var k = 0; k < groups.length; k++) n += groups[k].stones.length;
        setTimeout(function () {
          if (state && !state.over) U.toast('注意：你有 ' + n + ' 子只剩一口气（被打吃），小心应对！', 'warn');
        }, 650);
      }
    }
    if (state.pos.toMove === state.playerColor) beginPlayerTurn();
    else beginAITurn();
  }
  function beginAITurn() {
    if (!state || state.over) return;
    state.aiThinking = true;
    state.cancelAI = false;
    state.board.setGhostColor(0);
    setTurnUI('ai');
    els.status.textContent = '柯洁老师思考中……';
    els.avatarA.innerHTML = g.Avatars.ai('think');
    if (els.avatarA.parentElement) els.avatarA.parentElement.classList.add('thinking');
    updateUI();
    var myState = state;
    AI.think(state.pos, state.difficulty, {
      onProgress: function (p) {
        if (state === myState && !state.over) els.status.textContent = '柯洁老师思考中 ' + Math.round(p * 100) + '%';
      }
    }).then(function (mv) {
      if (!state || state !== myState || state.over) return;
      if (state.cancelAI) { state.aiThinking = false; return; }
      state.aiThinking = false;
      if (els.avatarA.parentElement) els.avatarA.parentElement.classList.remove('thinking');
      doAIMove(mv);
    });
  }
  function doAIMove(mv) {
    if (!state || state.over) return;
    var before = state.pos.board.slice();
    var color = state.pos.toMove;
    var ok = R.applyMove(state.pos, mv, state.log);
    var removed = [];
    if (ok) {
      for (var k = 0; k < before.length; k++) if (before[k] && !state.pos.board[k]) removed.push(k);
    } else {
      R.applyMove(state.pos, -1, state.log);
      mv = -1;
    }
    state.moves.push(mv >= 0 ? { x: mv % state.size, y: (mv / state.size) | 0, c: color } : { c: color });
    if (mv >= 0) {
      state.board.setStone(mv, color, true);
      state.board.setLastMove(mv);
    } else {
      state.board.setLastMove(-1);
    }
    if (removed.length) state.board.removeStones(removed, true);
    if (mv >= 0) A.play(removed.length ? 'capture' : 'place');
    else A.play('pass');
    if (g.App.getSettings().comments) {
      var coord = mv >= 0 ? R.display(mv, state.size) : '停一手';
      speak('我下 ' + coord + '——' + AI.explainMove(state.pos, mv));
    } else {
      speak(mv >= 0 ? '该你了。' : '我停一手。双方都停一手后就可以点目了。');
    }
    if (mv >= 0 && removed.length && g.App.getSettings().hints) {
      speak('我下 ' + R.display(mv, state.size) + '，提掉你 ' + removed.length + ' 子。记住：先数「气」再落子！');
    }
    appendLog();
    afterMove();
  }
  function beginPlayerTurn() {
    if (!state || state.over) return;
    state.board.setGhostColor(state.playerColor);
    setTurnUI('player');
    if (state.pos.passes === 0) els.status.textContent = '轮到你落子';
    else els.status.textContent = '对方已停一手，你可以继续下，或「停一手」进入点目';
    updateUI();
  }
  function setTurnUI(whose) {
    els.turnP.classList.toggle('active', whose === 'player');
    els.turnA.classList.toggle('active', whose === 'ai');
  }
  function speak(text, expr) {
    els.speech.textContent = text;
    els.speechAvatar.innerHTML = g.Avatars.ai(expr || 'normal');
  }

  /* ---------- 面板 ---------- */
  function appendLog() {
    var m = state.moves[state.moves.length - 1];
    var div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = '<span class="log-num">' + state.moves.length + '.</span>' +
      '<span class="stone-dot ' + (m.c === 1 ? 'black' : 'white') + '"></span>' +
      '<span class="log-coord">' + (m.x != null ? R.display(R.idx(m.x, m.y, state.size), state.size) : '停') + '</span>';
    els.log.appendChild(div);
    els.log.scrollTop = els.log.scrollHeight;
  }
  function removeLog() {
    if (els.log.lastChild) els.log.removeChild(els.log.lastChild);
  }
  function updateUI() {
    if (!state) return;
    var s = g.App.getSettings();
    var pc = state.playerColor;
    els.playerMeta.textContent = (pc === 1 ? '黑' : '白') + ' · 提子 ' + state.pos.caps[pc - 1] + (pc === 2 && state.pos.komi > 0 ? ' · 贴目 ' + state.pos.komi : '');
    els.aiMeta.textContent = (3 - pc === 1 ? '黑' : '白') + ' · 提子 ' + state.pos.caps[2 - pc];
    els.undo.style.display = (state.mode === 'formal' || state.pvp) ? 'none' : '';
    els.hint.disabled = state.pvp || !s.hints || state.aiThinking || state.over || state.scoring || state.pos.toMove !== state.playerColor;
    els.pass.disabled = state.aiThinking || state.over || state.scoring || state.pos.toMove !== state.playerColor;
    els.score.disabled = state.over || state.scoring || state.aiThinking;
    els.resign.disabled = state.over || state.scoring || state.aiThinking;
  }
  function saveCurrentState() {
    S.saveCurrent({
      mode: state.mode, size: state.size, komi: state.komi,
      handicap: state.handicap, letFirst: state.letFirst,
      playerColor: state.playerColor, difficulty: state.difficulty,
      moves: state.moves, startedAt: state.startedAt,
      turn: state.pos.toMove === state.playerColor ? 'player' : 'ai'
    });
  }

  /* ---------- 按钮 ---------- */
  function onHint() {
    if (!state || state.over || state.scoring) return;
    if (!g.App.getSettings().hints) { U.toast('提示已关闭，可在「设置」中开启'); return; }
    if (state.aiThinking || state.pos.toMove !== state.playerColor) { U.toast('轮到你的回合才能请指教'); return; }
    els.hint.disabled = true;
    els.status.textContent = '柯洁老师正在想怎么指点你……';
    AI.hint(state.pos, state.difficulty).then(function (res) {
      if (!state || state.over) return;
      els.status.textContent = '轮到你落子';
      updateUI();
      if (res.idx >= 0) {
        state.board.setHint(res.idx);
        speak('我建议下 ' + R.display(res.idx, state.size) + '。' + res.text);
        U.toast('已标出推荐落点');
      } else {
        speak('现在没有明显的好棋，可以考虑「停一手」。');
      }
    });
  }
  function onPass() {
    if (!state || state.over || state.scoring) return;
    if (state.aiThinking || state.pos.toMove !== state.playerColor) { U.toast('还没轮到你'); return; }
    state.board.clearHint();
    R.applyMove(state.pos, -1, state.log);
    state.moves.push({ c: state.playerColor });
    A.play('pass');
    appendLog();
    updateUI();
    if (state.pos.passes >= 2) {
      if (state.pvp) pvpFinish();
      else { saveCurrentState(); openScoring(true); }
    } else if (state.pvp) {
      g.Net.send({ t: 'pass' });
      setTurnUI('ai');
      els.status.textContent = '你已停一手，等待对方……';
      state.board.setGhostColor(0);
    } else beginAITurn();
  }
  function onScore() {
    if (!state || state.over || state.scoring) return;
    if (state.pvp) {
      g.App.modal({
        title: '现在点目？',
        body: '<p>确定现在结束对局点目吗？将按当前局面计算胜负，并同步给对方。</p>',
        actions: [
          { label: '继续下', cls: 'ghost' },
          { label: '点目结束', cls: 'primary', onClick: function () { pvpFinish(true); } }
        ]
      });
      return;
    }
    if (state.aiThinking) { U.toast('柯洁老师正在思考'); return; }
    if (state.pos.passes < 2) {
      g.App.modal({
        title: '现在点目？',
        body: '<p>对局还没有结束（双方未连续停一手）。现在点目将按当前局面直接计算胜负。</p>',
        actions: [
          { label: '返回对局', cls: 'ghost' },
          { label: '直接点目', cls: 'primary', onClick: function () { openScoring(false); } }
        ]
      });
    } else openScoring(true);
  }
  function onUndo() {
    if (!state || state.over || state.scoring) return;
    if (state.mode === 'formal') { U.toast('正式对局，落子无悔！', 'warn'); return; }
    if (!state.log.length) { U.toast('还没有可以悔的棋'); return; }
    if (state.aiThinking) {
      var last = state.log[state.log.length - 1];
      if (last.toMove !== state.playerColor) { U.toast('柯洁老师正在思考，稍等'); return; }
      state.cancelAI = true;
      R.undoMove(state.pos, state.log);
      state.moves.pop();
      removeLog();
      state.board.syncPosition(state.pos);
      state.board.setLastMove(state.pos.lastMove);
      state.board.clearHint();
      updateUI();
      beginPlayerTurn();
      return;
    }
    var lastRec = state.log[state.log.length - 1];
    if (lastRec.toMove === state.playerColor) {
      R.undoMove(state.pos, state.log);
      state.moves.pop();
      removeLog();
    } else {
      R.undoMove(state.pos, state.log);
      state.moves.pop();
      removeLog();
      if (state.log.length && state.log[state.log.length - 1].toMove === state.playerColor) {
        R.undoMove(state.pos, state.log);
        state.moves.pop();
        removeLog();
      }
    }
    state.board.syncPosition(state.pos);
    state.board.setLastMove(state.pos.lastMove);
    state.board.clearHint();
    updateUI();
    beginPlayerTurn();
    U.toast('已悔棋');
  }
  function onResign() {
    if (!state || state.over || state.scoring || state.aiThinking) return;
    g.App.modal({
      title: '认输',
      body: '<p>确定认输吗？本局将判柯洁老师中盘胜。</p>',
      actions: [
        { label: '再战一会儿', cls: 'ghost' },
        {
          label: '确定认输', cls: 'danger', onClick: function () {
            var winner = 3 - state.playerColor;
            if (state.pvp) {
              g.Net.send({ t: 'resign' });
              saveRecord('pvp', winner, (winner === 1 ? '黑' : '白') + '中盘胜');
              pvpResult({ winner: winner, byResign: true });
              return;
            }
            state.over = true;
            S.clearCurrent();
            saveRecord('resign', winner, (winner === 1 ? '黑' : '白') + '中盘胜');
            showResult({ winner: winner, byScore: false });
          }
        }
      ]
    });
  }
  function onLeave() {
    if (state && state.pvp) g.Net.leave();
    g.App.showView('view-menu');
  }

  /* ---------- 数子 ---------- */
  function openScoring(auto) {
    if (!state) return;
    state.scoring = true;
    state.deadSet = R.autoDeadCandidates(state.pos);
    state.board.setGhostColor(0);
    renderScoring();
    var m = g.App.modal({
      title: '点目 · 数子',
      body:
        '<p class="muted small">请核对死子：点击棋盘上的棋子可标记 / 取消死子（显示红叉）。标记后双方领地自动重算。</p>' +
        '<div class="score-line"><span>黑方（棋 + 空）</span><b id="sc-black">0</b></div>' +
        '<div class="score-line"><span>白方（棋 + 空 + 贴目 ' + state.pos.komi + '）</span><b id="sc-white">0</b></div>' +
        '<div class="score-line"><span id="sc-winner-label">结果</span><b id="sc-winner">—</b></div>',
      dismissible: false,
      actions: [
        {
          label: '返回对局', cls: 'ghost', onClick: function () {
            if (!state) return;
            state.scoring = false;
            state.board.clearTerritory();
            state.board.setGhostColor(state.playerColor);
            beginPlayerTurn();
          }
        },
        { label: '清除标记', cls: 'ghost', onClick: function () { state.deadSet = new Set(); renderScoring(); } },
        { label: '自动标记', cls: 'ghost', onClick: function () { state.deadSet = R.autoDeadCandidates(state.pos); renderScoring(); } },
        { label: '确认数子', cls: 'primary', onClick: finishByScore }
      ]
    });
    state.scoreModal = m;
  }
  function renderScoring() {
    if (!state || !state.scoring) return;
    var sc = R.score(state.pos, state.deadSet);
    state.board.setTerritory(sc.territory, state.deadSet);
    var b = $('sc-black'), w = $('sc-white'), win = $('sc-winner'), label = $('sc-winner-label');
    if (!b) return;
    b.textContent = sc.black + ' 子';
    w.textContent = sc.white + ' + ' + state.pos.komi + ' = ' + sc.whiteTotal + ' 子';
    if (sc.winner === 0) { label.textContent = '结果'; win.textContent = '—'; win.className = ''; }
    else {
      label.textContent = '结果';
      win.textContent = (sc.winner === 1 ? '黑' : '白') + '胜 ' + Math.abs(sc.diff).toFixed(1) + ' 子';
      win.className = sc.winner === state.playerColor ? 'score-win' : 'score-lose';
    }
  }
  function toggleDead(i) {
    if (!state || !state.scoring) return;
    if (state.pos.board[i] === 0) return;
    if (state.deadSet.has(i)) state.deadSet.delete(i);
    else state.deadSet.add(i);
    renderScoring();
  }
  function finishByScore() {
    if (!state) return;
    var sc = R.score(state.pos, state.deadSet);
    state.scoring = false;
    state.over = true;
    if (state.scoreModal) state.scoreModal.close();
    state.board.clearTerritory();
    S.clearCurrent();
    var resultText = sc.winner === 0 ? '和棋' : ((sc.winner === 1 ? '黑' : '白') + '胜 ' + Math.abs(sc.diff).toFixed(1) + ' 子');
    saveRecord('score', sc.winner, resultText);
    showResult({ winner: sc.winner, score: sc, byScore: true });
  }
  function saveRecord(kind, winner, resultText) {
    var s = g.App.getSettings();
    var rec = {
      id: 'g' + Date.now(),
      date: U.fmtDate(Date.now()),
      size: state.size, mode: state.mode, handicap: state.handicap, komi: state.komi,
      difficulty: state.difficulty, skin: g.App.getSettings().skin,
      playerName: s.playerName,
      blackName: state.playerColor === 1 ? s.playerName : '柯洁老师',
      whiteName: state.playerColor === 2 ? s.playerName : '柯洁老师',
      setup: state.setupStones, moves: state.moves,
      result: resultText, winner: winner, playerWon: winner === state.playerColor
    };
    S.addGame(rec);
    state.savedId = rec.id;
  }
  function showResult(r) {
    var playerWin = r.winner === state.playerColor;
    var draw = r.winner === 0;
    var body = '';
    if (r.byScore) {
      body =
        '<div class="score-line"><span>黑方（棋 + 空）</span><b>' + r.score.black + ' 子</b></div>' +
        '<div class="score-line"><span>白方（棋 + 空 + 贴目 ' + r.score.komi + '）</span><b>' + r.score.whiteTotal + ' 子</b></div>' +
        '<p class="muted small" style="margin-top:10px">中国规则：黑贴 3¾ 子（7.5 目），白方总数含贴目。</p>';
    }
    g.App.modal({
      title: '对局结束',
      body:
        '<div class="result-banner ' + (playerWin ? 'win' : (draw ? '' : 'lose')) + '">' +
        (draw ? '握手言和' : (playerWin ? '恭喜获胜！' : '虽败犹荣')) + '</div>' + body +
        '<p class="muted small">' + (draw ? '本局和棋，旗鼓相当！' : (playerWin ? '好棋！去「棋谱库 → 我的对局」可以复盘。' : '失败是进步的开始，去「棋谱库」复盘看看问题出在哪里吧。')) + '</p>',
      actions: [
        { label: '再来一局', cls: 'primary', onClick: function () { newGameFlow(); } },
        { label: '复盘本局', cls: '', onClick: function () { g.App.showView('view-library'); if (state.savedId) g.Library.openMine(state.savedId); } },
        { label: '返回主菜单', cls: 'ghost', onClick: function () { g.App.showView('view-menu'); } }
      ]
    });
    A.play(playerWin ? 'win' : (draw ? 'pass' : 'lose'));
  }

  /* ================= V2：好友对弈 ================= */
  function startPvp(opts) {
    state = null;
    start({
      mode: 'pvp', size: opts.size, komi: 7.5, handicap: 0,
      playerColor: opts.creator ? 1 : 2, difficulty: 'easy', pvp: true
    });
    state.oppName = opts.oppName || '好友';
    els.oppName.textContent = state.oppName;
    els.badge.textContent = '好友对弈';
    g.Net.send({ t: 'hello', name: g.App.getSettings().playerName });
  }
  function isPvp() { return !!(state && state.pvp); }
  function onNetData(msg) {
    if (!state || !state.pvp || !msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      state.oppName = msg.name || '好友';
      els.oppName.textContent = state.oppName;
      return;
    }
    if (msg.t === 'move') {
      if (state.over || state.pos.toMove === state.playerColor) return;
      if (msg.x == null || msg.y == null) return;
      var idx = R.idx(msg.x, msg.y, state.size);
      var chk = R.checkMove(state.pos, idx);
      if (!chk.ok) { U.toast('对方走了不合规的棋，已忽略', 'warn'); return; }
      var before = state.pos.board.slice();
      R.applyMove(state.pos, idx, state.log);
      var removed = [];
      for (var k = 0; k < before.length; k++) if (before[k] && !state.pos.board[k]) removed.push(k);
      state.moves.push({ x: msg.x, y: msg.y, c: 3 - state.playerColor });
      state.board.setStone(idx, 3 - state.playerColor, true);
      if (removed.length) state.board.removeStones(removed, true);
      state.board.setLastMove(idx);
      A.play(removed.length ? 'capture' : 'place');
      appendLog();
      updateUI();
      if (state.pos.passes >= 2) { pvpFinish(); return; }
      beginPlayerTurn();
      return;
    }
    if (msg.t === 'pass') {
      R.applyMove(state.pos, -1, state.log);
      state.moves.push({ c: 3 - state.playerColor });
      A.play('pass');
      appendLog();
      updateUI();
      if (state.pos.passes >= 2) { pvpFinish(); return; }
      els.status.textContent = '对方停一手，轮到你落子';
      beginPlayerTurn();
      return;
    }
    if (msg.t === 'resign') {
      if (!state) return;
      var resWinner = state.playerColor;
      saveRecord('pvp', resWinner, (resWinner === 1 ? '黑' : '白') + '中盘胜');
      pvpResult({ winner: resWinner, byResign: true });
      return;
    }
    if (msg.t === 'finish') {
      if (state && state.pvp && !state.over) pvpFinish(false);
      return;
    }
    if (msg.t === 'loseMsg') {
      showChat('算你厉害！你是这个👍', false, 4200);
      A.play('click');
      return;
    }
    if (msg.t === 'boast') {
      showChat('菜就多练！小样！', false, 4200);
      A.play('click');
      return;
    }
    if (msg.t === 'rematchReq') {
      if (!state || !state.over) return;
      if (pvpRematchState === 1) {
        // 双方同时点了再来一局 → 直接开战
        pvpRematchState = 2;
        if (pvpResultModal) { try { pvpResultModal.close(); } catch (e) {} pvpResultModal = null; }
        startPvpRematch();
        return;
      }
      if (pvpRematchState !== 0) return;
      g.App.modal({
        title: '再战邀请',
        body: '<p>对方想和你再来一局，继续 PK？</p>',
        actions: [
          { label: '拒绝', cls: 'ghost', onClick: function () { g.Net.send({ t: 'rematchNo' }); g.Net.leave(); g.App.showView('view-menu'); } },
          { label: '同意', cls: 'primary', onClick: function () { g.Net.send({ t: 'rematchYes' }); pvpRematchState = 2; startPvpRematch(); } }
        ]
      });
      return;
    }
    if (msg.t === 'rematchYes') {
      if (pvpRematchState === 2) return;
      pvpRematchState = 2;
      if (pvpResultModal) { try { pvpResultModal.close(); } catch (e) {} pvpResultModal = null; }
      startPvpRematch();
      return;
    }
    if (msg.t === 'rematchNo') {
      if (pvpRematchState === 2) return;
      if (pvpResultModal) { try { pvpResultModal.close(); } catch (e) {} pvpResultModal = null; }
      U.toast('对方拒绝了再战');
      g.Net.leave();
      g.App.showView('view-menu');
      return;
    }
    if (msg.t === 'chat') { showChat(msg.s, false); A.play('click'); return; }
  }
  var pvpResultModal = null;
  var pvpRematchState = 0; // 0=无 1=已发邀请待回应 2=已同意开局
  function pvpFinish(sendFinish) {
    if (!state || state.over) return;
    var sc = R.score(state.pos, R.autoDeadCandidates(state.pos));
    var resText = sc.winner === 0 ? '和棋' : ((sc.winner === 1 ? '黑' : '白') + '胜 ' + Math.abs(sc.diff).toFixed(1) + ' 子');
    saveRecord('pvp', sc.winner, resText);
    if (sendFinish) g.Net.send({ t: 'finish' });
    pvpResult({ winner: sc.winner, black: sc.black, whiteTotal: sc.whiteTotal, komi: sc.komi, byResign: false });
  }
  function pvpResult(res) {
    if (!state || state.over) return;   // 防重：双方同步消息时只结算一次
    var isDraw = res.winner === 0;
    var playerWin = !isDraw && res.winner === state.playerColor;
    state.over = true;
    S.clearCurrent();
    // 双向台词：输家点赞胜家，胜家调侃输家（气泡在结算框之上，双方可见）
    if (state.pvp && !isDraw) {
      if (!playerWin) {
        g.Net.send({ t: 'loseMsg' });
        showChat('算你厉害！你是这个👍', true, 4200);
      } else {
        g.Net.send({ t: 'boast' });
        showChat('菜就多练！小样！', true, 4200);
      }
    }
    if (playerWin && !isDraw && g.Fireworks) g.Fireworks.show(7000);
    var sc = R.score(state.pos, R.autoDeadCandidates(state.pos));
    var banner = isDraw ? '握手言和' : (playerWin ? '恭喜获胜！' : '惜败');
    var m = g.App.modal({
      title: '对局结束',
      body:
        '<div class="result-banner ' + (playerWin ? 'win' : (isDraw ? '' : 'lose')) + '">' + banner + '</div>' +
        '<div class="score-line"><span>黑方（棋 + 空）</span><b>' + sc.black + ' 子</b></div>' +
        '<div class="score-line"><span>白方（棋 + 空 + 贴目 ' + sc.komi + '）</span><b>' + sc.whiteTotal + ' 子</b></div>' +
        '<p class="muted small">' +
        (res.byResign ? (playerWin ? '对方中盘认输。' : '你中盘认输。') : '') +
        '点「再来一局」继续 PK！</p>',
      actions: [
        { label: '再来一局', cls: 'primary', onClick: rematchRequest },
        { label: '返回主菜单', cls: 'ghost', onClick: function () { g.Net.leave(); g.App.showView('view-menu'); } }
      ]
    });
    pvpResultModal = m;
    A.play(playerWin ? 'win' : (isDraw ? 'pass' : 'lose'));
  }
  function rematchRequest() {
    if (pvpRematchState !== 0) return;
    pvpRematchState = 1;
    g.Net.send({ t: 'rematchReq' });
    if (pvpResultModal) {
      pvpResultModal.box.innerHTML = '<div class="modal-title">等待回应</div><div class="modal-body"><p>已发出再战邀请，等待对方回应……</p></div>';
    }
  }
  function startPvpRematch() {
    var lastColor = state ? state.playerColor : 1;
    var size = state ? state.size : 9;
    var oppName = state ? (state.oppName || '好友') : '好友';
    state = null;
    start({ mode: 'pvp', size: size, komi: 7.5, handicap: 0, playerColor: 3 - lastColor, difficulty: 'easy', pvp: true });
    state.oppName = oppName;
    els.oppName.textContent = oppName;
    els.badge.textContent = '好友对弈 · 再战';
    pvpRematchState = 0;
    g.Net.send({ t: 'hello', name: g.App.getSettings().playerName });
  }
  /* ================= V2：快捷表情 ================= */
  var AI_QUIPS = [
    '收到！棋还在下，心已飞远～',
    '哈哈，我记住你的话了。',
    '（柯洁老师微微一笑）妙啊。',
    '稍安勿躁，我正在酝酿妙手。',
    '心态稳，棋才稳。',
    '嗯！这局会很有意思。'
  ];
  var AI_KEY_QUIPS = {
    '快点啊！': '别急别急，我这就出手！',
    '我等的花儿都谢了': '哈哈，花谢了我赔你一朵～',
    '好棋！': '谢谢夸奖！你的棋也不赖！',
    '手下留情': '那可不行，我只能全力以赴！',
    '再来一局': '好！这局结束咱们再来！'
  };
  function sendChat(s) {
    if (!state || !s) return;
    showChat(s, true);
    A.play('click');
    if (state.pvp) {
      g.Net.send({ t: 'chat', s: s });
    } else {
      var reply = AI_KEY_QUIPS[s] || AI_QUIPS[(Math.random() * AI_QUIPS.length) | 0];
      setTimeout(function () {
        if (!state || state.over) return;
        showChat(reply, false);
        els.speechAvatar.innerHTML = g.Avatars.ai('happy');
        els.speech.textContent = reply;
        setTimeout(function () {
          if (state && !state.over) { els.speechAvatar.innerHTML = g.Avatars.ai('normal'); els.speech.textContent = '轮到你了。'; }
        }, 2600);
      }, 900 + Math.random() * 1200);
    }
  }
  function showChat(s, mine, durationMs) {
    var b = document.createElement('div');
    b.className = 'chat-bubble' + (mine ? ' me' : '');
    b.textContent = s;
    document.body.appendChild(b);
    var d = durationMs || 2200;
    setTimeout(function () {
      b.classList.add('out');
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 450);
    }, d);
  }
  g.GamePage = {
    init: init, newGameFlow: newGameFlow, resume: resume, startPvp: startPvp, isPvp: isPvp,
    getBoard: getBoard, refreshSettings: refreshSettings,
    leave: onLeave, _start: start
  };
})(window);