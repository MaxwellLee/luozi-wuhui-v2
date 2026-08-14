/* =============================================================
 * 《落子无悔》· 围棋课堂：互动规则课（演示 / 任务 / 测验）
 * ============================================================= */
(function (g) {
  'use strict';
  var R = g.GoRules, U = g.GoUtil, S = g.GoStorage, A = g.GameAudio;
  var progress = S.getProgress();
  if (!progress.lessons) progress.lessons = {};
  var cur = null, step = 0, stepDone = false;
  var board = null, stepPos = null;
  var marked = new Set();
  var demoState = null;
  var quizAnswered = false;

  function $(id) { return document.getElementById(id); }

  function init() {
    $('lesson-prev').addEventListener('click', function () { if (step > 0) { step--; renderStep(); } });
    $('lesson-next').addEventListener('click', function () {
      if (!stepDone && cur.steps[step].type !== 'info') { U.toast('完成这一步才能继续哦'); return; }
      if (step < cur.steps.length - 1) { step++; renderStep(); }
      else finishLesson();
    });
    renderList();
  }
  function show() {
    renderList();
    if (cur) renderStep();
    else $('lesson-detail').classList.add('hidden');
  }
  function renderList() {
    var box = $('lesson-list');
    box.innerHTML = '';
    var units = g.GO_LESSONS.units;
    var doneCount = 0;
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      var done = !!(progress.lessons[u.id] && progress.lessons[u.id].done);
      if (done) doneCount++;
      (function (u2, done2) {
        var card = U.el('div', { class: 'lesson-card' });
        card.appendChild(U.el('div', { class: 'lesson-icon', text: u2.icon }));
        card.appendChild(U.el('div', { class: 'lesson-card-title', text: u2.title }));
        card.appendChild(U.el('div', { class: 'lesson-card-desc', text: u2.desc }));
        if (done2) card.appendChild(U.el('div', { class: 'lesson-badge', text: '✓ 已完成' }));
        card.addEventListener('click', function () { openLesson(u2.id); });
        box.appendChild(card);
      })(u, done);
    }
    $('lesson-progress').textContent = '已完成 ' + doneCount + ' / ' + units.length + ' 课';
  }
  function openLesson(id) {
    var units = g.GO_LESSONS.units;
    for (var i = 0; i < units.length; i++) if (units[i].id === id) { cur = units[i]; break; }
    if (!cur) return;
    step = 0;
    $('lesson-detail').classList.remove('hidden');
    $('lesson-list').classList.add('hidden');
    renderStep();
  }
  function backToList() {
    cur = null;
    stopDemo();
    $('lesson-detail').classList.add('hidden');
    $('lesson-list').classList.remove('hidden');
  }
  function marksFromSetup(st) {
    var marks = {};
    if (st.setup) {
      for (var i = 0; i < st.setup.length; i++) {
        var s = st.setup[i];
        if (s.mark) marks[R.idx(s.x, s.y, st.size)] = { type: s.mark, label: s.label, color: s.markColor };
      }
    }
    if (st.marks) for (var key in st.marks) marks[key] = st.marks[key];
    return marks;
  }
  function renderStep() {
    if (!cur) return;
    stopDemo();
    marked = new Set();
    stepDone = false;
    quizAnswered = false;
    var st = cur.steps[step];
    var stepper = $('lesson-stepper');
    stepper.innerHTML = '';
    for (var i = 0; i < cur.steps.length; i++) {
      (function (idx) {
        var d = U.el('div', { class: 'step-dot' + (idx === step ? ' active' : (idx < step ? ' done' : '')), text: String(idx + 1) });
        if (idx < step) d.addEventListener('click', function () { step = idx; renderStep(); });
        stepper.appendChild(d);
      })(i);
    }
    var backBtn = U.el('button', { class: 'btn small lesson-back-btn', text: '课程列表' });
    backBtn.addEventListener('click', backToList);
    stepper.appendChild(backBtn);
    $('lesson-prev').disabled = step === 0;
    $('lesson-next').textContent = step === cur.steps.length - 1 ? '完成课程' : '下一步';
    $('lesson-next').disabled = false;
    var textEl = $('lesson-text');
    var boardWrap = document.querySelector('.lesson-board-wrap');
    var fb = $('lesson-feedback');
    fb.textContent = '';
    fb.className = 'lesson-feedback';
    textEl.innerHTML = '<h3>' + U.esc(st.title || '第 ' + (step + 1) + ' 步') + '</h3>' + (st.html || '');
    if (board) { board.destroy(); board = null; }
    if (st.type === 'board' || st.type === 'try' || st.type === 'mark') {
      boardWrap.classList.remove('hidden');
      board = new g.GoBoard($('lesson-board'), {
        size: st.size || 7, skin: g.App.getSettings().skin,
        interactive: st.type !== 'board',
        showCoords: false,
        onClick: onLessonClick
      });
      stepPos = R.create(st.size || 7, 0);
      if (st.setup) R.setup(stepPos, st.setup.filter(function (s) { return s.c; }));
      stepPos.toMove = st.toMove || 1;
      stepPos.hash = R.computeHash(stepPos);
      board.syncPosition(stepPos);
      board.setMarks(marksFromSetup(st));
      if (st.type === 'board') {
        if (st.moves && st.moves.length) playDemo(st);
        else {
          stepDone = true;
          if (st.showTerritory) board.setTerritory(R.territoryMap(stepPos, null), null);
          fb.textContent = st.note || '';
        }
      } else if (st.type === 'try') {
        fb.innerHTML = '<div><strong>任务：</strong>' + U.esc(st.task.goal) + '</div>' +
          '<div class="muted small">' + U.esc(st.task.tip || '') + '</div>' +
          '<button class="btn small" id="lesson-reset">重置棋盘</button>';
        $('lesson-reset').addEventListener('click', rebuildTry);
      } else {
        fb.innerHTML = '<div><strong>任务：</strong>' + U.esc(st.task.goal) + '</div>' +
          '<div class="muted small">' + U.esc(st.task.tip || '') + '</div>' +
          '<button class="btn small" id="lesson-reset">重置标记</button>';
        $('lesson-reset').addEventListener('click', rebuildTry);
      }
    } else {
      boardWrap.classList.add('hidden');
    }
    if (st.type === 'quiz') {
      textEl.innerHTML += '<div class="lesson-quiz" id="lesson-quiz"></div>';
      renderQuiz(st);
    }
  }
  function rebuildTry() {
    var st = cur.steps[step];
    stepPos = R.create(st.size || 7, 0);
    if (st.setup) R.setup(stepPos, st.setup.filter(function (s) { return s.c; }));
    stepPos.toMove = st.toMove || 1;
    stepPos.hash = R.computeHash(stepPos);
    marked = new Set();
    board.syncPosition(stepPos);
    board.setMarks(marksFromSetup(st));
    renderTryFooter(st);
  }
  function renderTryFooter(st) {
    var fb = $('lesson-feedback');
    fb.className = 'lesson-feedback';
    fb.innerHTML = '<div><strong>任务：</strong>' + U.esc(st.task.goal) + '</div>' +
      '<div class="muted small">' + U.esc(st.task.tip || '') + '</div>' +
      '<button class="btn small" id="lesson-reset">重置</button>';
    $('lesson-reset').addEventListener('click', rebuildTry);
  }
  /* ---------- 演示 ---------- */
  function playDemo(st) {
    stopDemo();
    stepPos = R.create(st.size || 7, 0);
    if (st.setup) R.setup(stepPos, st.setup.filter(function (s) { return s.c; }));
    stepPos.toMove = st.toMove || 1;
    stepPos.hash = R.computeHash(stepPos);
    board.syncPosition(stepPos);
    var fb = $('lesson-feedback');
    fb.innerHTML = '<button class="btn small" id="lesson-replay">▶ 重新播放</button>';
    var btn = $('lesson-replay');
    if (btn) btn.addEventListener('click', function () { playDemo(st); });
    demoState = { i: 0 };
    demoState.timer = setInterval(function () {
      if (!demoState || !board || !cur) { return; }
      var m = st.moves[demoState.i];
      var idx = R.idx(m.x, m.y, st.size);
      R.applyMove(stepPos, idx);
      board.setStone(idx, m.c, true);
      var html = m.comment ? '<strong>' + U.esc(m.comment) + '</strong> ' : '';
      html += '<button class="btn small" id="lesson-replay">▶ 重新播放</button>';
      fb.innerHTML = html;
      var b2 = $('lesson-replay');
      if (b2) b2.addEventListener('click', function () { playDemo(st); });
      demoState.i++;
      if (demoState.i >= st.moves.length) {
        clearInterval(demoState.timer);
        demoState = null;
        stepDone = true;
        fb.innerHTML = '演示完成，点击「下一步」继续。' +
          '<button class="btn small" id="lesson-replay">▶ 重新播放</button>';
        var b3 = $('lesson-replay');
        if (b3) b3.addEventListener('click', function () { playDemo(st); });
      }
    }, 1500);
  }
  function stopDemo() {
    if (demoState && demoState.timer) clearInterval(demoState.timer);
    demoState = null;
  }
  /* ---------- 任务交互 ---------- */
  function onLessonClick(i) {
    if (!cur) return;
    var st = cur.steps[step];
    if (st.type === 'mark') {
      if (stepPos.board[i] === 0) { U.toast('只有棋子才能标记为死子'); return; }
      if (marked.has(i)) marked.delete(i); else marked.add(i);
      var marks = marksFromSetup(st);
      marked.forEach(function (idx) { marks[idx] = { type: 'cross', color: '#d64545' }; });
      board.setMarks(marks);
      var ctxM = { pos: stepPos, i: -1, R: R, marked: marked };
      if (st.task.check(ctxM)) succeed(st);
      return;
    }
    if (st.type !== 'try') return;
    if (stepPos.board[i] !== 0) { U.toast('这里已经有子了，换一个点试试'); return; }
    var chk = R.checkMove(stepPos, i);
    if (!chk.ok) {
      if (st.task.checkIllegal) {
        var ctx0 = { pos: stepPos, i: i, R: R, marked: marked };
        if (st.task.checkIllegal(ctx0)) { succeed(st); return; }
      }
      A.play('warn');
      var fb = $('lesson-feedback');
      fb.className = 'lesson-feedback';
      fb.innerHTML = '<div class="muted">' + U.esc(
        chk.code === 'suicide' ? '这是禁着点：落子后自己没有气，又不能提子。换一个点试试。'
          : chk.code === 'ko' ? '打劫！不能立刻回提。' : '这里不能落子。') + '</div>';
      return;
    }
    var before = stepPos.board.slice();
    R.applyMove(stepPos, i);
    var removed = [];
    for (var k = 0; k < before.length; k++) if (before[k] && !stepPos.board[k]) removed.push(k);
    var placed = before[i] === 0 ? stepPos.board[i] : 0;
    board.setStone(i, placed, true);
    if (removed.length) board.removeStones(removed, true);
    A.play(removed.length ? 'capture' : 'place');
    var ctx = { pos: stepPos, i: i, R: R, marked: marked };
    if (st.task.check(ctx)) succeed(st);
    else {
      var fb2 = $('lesson-feedback');
      fb2.className = 'lesson-feedback';
      fb2.innerHTML = '<div class="muted">' + U.esc(st.task.tip || '再想想看。') + '</div>' +
        '<div class="muted small">可以继续尝试，或点「重置」。</div>' +
        '<button class="btn small" id="lesson-reset">重置</button>';
      $('lesson-reset').addEventListener('click', rebuildTry);
    }
  }
  function succeed(st) {
    if (stepDone) return;
    stepDone = true;
    A.play('win');
    var fb = $('lesson-feedback');
    fb.className = 'lesson-feedback ok';
    fb.innerHTML = '<strong>' + U.esc(st.task.success || '做对了！') + '</strong><div class="muted small">点击「下一步」继续。</div>';
  }
  /* ---------- 测验 ---------- */
  function renderQuiz(st) {
    var box = $('lesson-quiz');
    if (!box) return;
    box.appendChild(U.el('p', { class: 'quiz-q', text: st.quiz.q }));
    for (var i = 0; i < st.quiz.options.length; i++) {
      (function (opt) {
        var b = U.el('button', { class: 'btn quiz-opt', text: opt.t });
        b.addEventListener('click', function () {
          if (quizAnswered) return;
          var all = box.querySelectorAll('.quiz-opt');
          if (opt.ok) {
            quizAnswered = true;
            stepDone = true;
            A.play('win');
            for (var k = 0; k < all.length; k++) all[k].disabled = true;
            b.classList.add('primary');
            var fb = $('lesson-feedback');
            fb.className = 'lesson-feedback ok';
            fb.textContent = '回答正确！' + (st.quiz.explain ? ' ' + st.quiz.explain : '');
          } else {
            A.play('warn');
            b.classList.add('danger');
            b.disabled = true;
            var fb2 = $('lesson-feedback');
            fb2.className = 'lesson-feedback';
            fb2.textContent = '不对哦，再想想——' + (st.quiz.explain || '');
          }
        });
        box.appendChild(b);
      })(st.quiz.options[i]);
    }
  }
  function finishLesson() {
    progress.lessons[cur.id] = { done: true, at: Date.now() };
    S.saveProgress(progress);
    A.play('win');
    var units = g.GO_LESSONS.units;
    var idx = -1;
    for (var i = 0; i < units.length; i++) if (units[i].id === cur.id) idx = i;
    g.App.modal({
      title: '课程完成',
      body: '<p>恭喜完成《' + U.esc(cur.title) + '》！</p><p class="muted small">建议趁热去对局实战几盘，把知识变成手感。</p>',
      actions: [
        { label: '回课程列表', cls: 'primary', onClick: backToList },
        {
          label: '去下一课', cls: '', onClick: function () {
            backToList();
            if (idx >= 0 && idx < units.length - 1) openLesson(units[idx + 1].id);
          }
        }
      ]
    });
    renderList();
  }
  g.Classroom = { init: init, show: show };
})(window);
