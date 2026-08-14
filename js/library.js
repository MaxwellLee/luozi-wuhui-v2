/* =============================================================
 * 《落子无悔》· 棋谱库：入门棋谱 / 名局片段 / 我的对局（回放 + SGF）
 * ============================================================= */
(function (g) {
  'use strict';
  var R = g.GoRules, U = g.GoUtil, S = g.GoStorage;
  var tab = 'beginner';
  var replay = null;

  function $(id) { return document.getElementById(id); }

  function init() {
    var tabs = document.querySelectorAll('#lib-tabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (t) {
        t.addEventListener('click', function () {
          tab = t.getAttribute('data-lib');
          for (var k = 0; k < tabs.length; k++) tabs[k].classList.toggle('active', tabs[k] === t);
          showList();
        });
      })(tabs[i]);
    }
    $('rp-play').addEventListener('click', togglePlay);
    $('rp-first').addEventListener('click', function () { if (replay) jumpTo(0); });
    $('rp-last').addEventListener('click', function () { if (replay) jumpTo(replay.rec.moves.length); });
    $('rp-prev').addEventListener('click', function () { if (replay) jumpTo(Math.max(0, replay.i - 1)); });
    $('rp-next').addEventListener('click', function () { if (replay) jumpTo(Math.min(replay.rec.moves.length, replay.i + 1)); });
    $('rp-slider').addEventListener('input', function () { if (replay) jumpTo(parseInt(this.value, 10)); });
    $('btn-export-sgf').addEventListener('click', function () { if (replay) exportSGF(); });
    $('btn-import-sgf').addEventListener('click', function () { $('sgf-file').click(); });
    $('sgf-file').addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var res = S.parseSGF(String(reader.result));
        if (res.error) { U.toast(res.error, 'error'); return; }
        openRecord({
          id: 'import', size: res.size, komi: res.komi, handicap: res.handicap,
          blackName: res.blackName || '黑方', whiteName: res.whiteName || '白方',
          title: '导入棋谱', desc: (res.blackName || '黑') + ' 对 ' + (res.whiteName || '白'),
          setup: res.setup || [], moves: res.moves || [], result: res.result
        });
        U.toast('棋谱导入成功');
      };
      reader.readAsText(f, 'utf-8');
    });
  }
  function show() { showList(); }
  function showList() {
    if (replay) stopPlay();
    $('record-detail').classList.add('hidden');
    $('record-list').classList.remove('hidden');
    var box = $('record-list');
    box.innerHTML = '';
    var items;
    if (tab === 'beginner') items = g.GO_RECORDS.beginner;
    else if (tab === 'famous') items = g.GO_RECORDS.famous;
    else items = S.listGames();
    if (!items.length) {
      box.innerHTML = '<p class="muted" style="padding:20px">' +
        (tab === 'mine' ? '还没有对局记录——去下一盘棋吧！' : '暂无内容') + '</p>';
      return;
    }
    for (var i = 0; i < items.length; i++) {
      (function (it) {
        var card = U.el('div', { class: 'record-card' });
        var title = tab === 'mine' ? (it.date + ' · ' + it.result) : it.title;
        card.appendChild(U.el('div', { class: 'record-card-title', text: title }));
        var meta = tab === 'mine'
          ? ((it.blackName || '黑') + ' 对 ' + (it.whiteName || '白') + ' · ' + it.size + ' 路 · ' + it.moves.length + ' 手' + (it.playerWon ? ' · 你赢了' : ''))
          : ((it.players || '') + (it.year ? ' · ' + it.year : '') + ' · ' + it.moves.length + ' 手');
        card.appendChild(U.el('div', { class: 'record-card-meta', text: meta }));
        if (it.desc) card.appendChild(U.el('div', { class: 'record-card-meta', text: it.desc }));
        card.addEventListener('click', function () {
          if (tab === 'mine') openMine(it.id);
          else openRecord(it);
        });
        if (tab === 'mine') {
          var del = U.el('button', { class: 'btn small danger', text: '删除' });
          del.addEventListener('click', function (e) {
            e.stopPropagation();
            g.App.modal({
              title: '删除对局',
              body: '<p>确定删除这局记录吗？</p>',
              actions: [
                { label: '取消', cls: 'ghost' },
                { label: '删除', cls: 'danger', onClick: function () { S.deleteGame(it.id); showList(); } }
              ]
            });
          });
          card.appendChild(del);
        }
        box.appendChild(card);
      })(items[i]);
    }
  }
  function openMine(id) {
    var games = S.listGames();
    for (var i = 0; i < games.length; i++) {
      if (games[i].id === id) {
        var gm = games[i];
        openRecord({
          id: id, size: gm.size, komi: gm.komi, handicap: gm.handicap,
          blackName: gm.blackName, whiteName: gm.whiteName,
          title: gm.date + ' · ' + gm.result,
          desc: (gm.blackName || '黑') + ' 对 ' + (gm.whiteName || '白') + ' · ' + gm.size + ' 路',
          setup: gm.setup || [], moves: gm.moves || [], result: gm.result
        });
        return;
      }
    }
    U.toast('记录不存在');
  }
  function openRecord(rec) {
    if (replay) stopPlay();
    $('record-list').classList.add('hidden');
    $('record-detail').classList.remove('hidden');
    if (replay && replay.board) replay.board.destroy();
    var board = new g.GoBoard($('replay-board'), { size: rec.size, skin: g.App.getSettings().skin, interactive: false });
    replay = { rec: rec, pos: R.create(rec.size, rec.komi), i: 0, board: board, timer: null, playing: false };
    if (rec.setup) R.setup(replay.pos, rec.setup);
    replay.pos.hash = R.computeHash(replay.pos);
    board.syncPosition(replay.pos);
    $('rp-slider').max = String(rec.moves.length);
    $('rp-slider').value = '0';
    $('record-meta').innerHTML = U.esc(rec.title || '棋谱') + '<small>' + U.esc(rec.desc || '') + '</small>';
    $('record-extra').innerHTML = '';
    renderComment();
    jumpTo(0);
    if ($('rp-auto').checked && rec.moves.length > 0) startPlay();
  }
  function renderComment() {
    var rec = replay.rec, i = replay.i;
    var el = $('record-comment');
    if (i === 0) {
      el.innerHTML = '<p class="muted">点击「▶」开始回放，也可拖动进度条。</p>' +
        (rec.story ? '<div class="story">' + rec.story + '</div>' : '');
      return;
    }
    var m = rec.moves[i - 1];
    var coord = m.x != null ? R.display(R.idx(m.x, m.y, rec.size), rec.size) : '停一手';
    var txt = '<p><strong>第 ' + i + ' 手</strong>：' + (m.c === 1 ? '黑' : '白') + ' ' + coord + '</p>';
    if (m.comment) txt += '<p>' + U.esc(m.comment) + '</p>';
    if (rec.note && rec.note[i] != null) txt += '<p class="story">' + U.esc(rec.note[i]) + '</p>';
    if (i === rec.moves.length && rec.result) txt += '<p><strong>结果：</strong>' + U.esc(rec.result) + '</p>';
    el.innerHTML = txt;
  }
  function jumpTo(n) {
    if (!replay) return;
    var rec = replay.rec;
    n = Math.max(0, Math.min(rec.moves.length, n));
    if (n < replay.i) {
      replay.pos = R.create(rec.size, rec.komi);
      if (rec.setup) R.setup(replay.pos, rec.setup);
      replay.pos.hash = R.computeHash(replay.pos);
      replay.i = 0;
      replay.board.syncPosition(replay.pos);
      for (var k = 0; k < n; k++) {
        var m = rec.moves[k];
        R.applyMove(replay.pos, m.x != null ? R.idx(m.x, m.y, rec.size) : -1);
        replay.i++;
      }
    } else {
      while (replay.i < n) {
        var m2 = rec.moves[replay.i];
        R.applyMove(replay.pos, m2.x != null ? R.idx(m2.x, m2.y, rec.size) : -1);
        replay.i++;
      }
    }
    replay.board.syncPosition(replay.pos);
    replay.board.setLastMove(replay.pos.lastMove);
    $('rp-slider').value = String(replay.i);
    renderComment();
  }
  function togglePlay() {
    if (!replay) return;
    if (replay.playing) stopPlay();
    else startPlay();
  }
  function startPlay() {
    if (!replay) return;
    if (replay.i >= replay.rec.moves.length) jumpTo(0);
    replay.playing = true;
    $('rp-play').textContent = '⏸';
    replay.timer = setInterval(function () {
      if (!replay || !replay.playing) return;
      if (replay.i >= replay.rec.moves.length) { stopPlay(); return; }
      jumpTo(replay.i + 1);
    }, 1600);
  }
  function stopPlay() {
    if (replay && replay.timer) clearInterval(replay.timer);
    if (replay) { replay.playing = false; replay.timer = null; }
    $('rp-play').textContent = '▶';
  }
  function exportSGF() {
    if (!replay) return;
    var rec = replay.rec;
    var sgf = S.exportSGF({
      size: rec.size, komi: rec.komi, handicap: rec.handicap,
      blackName: rec.blackName, whiteName: rec.whiteName,
      setup: rec.setup || [], moves: rec.moves, result: rec.result, date: rec.date
    });
    g.App.downloadFile((rec.title || '棋谱').replace(/[\/:*?"<>|]/g, '_') + '.sgf', sgf, 'application/x-go-sgf');
    U.toast('已导出 SGF');
  }
  g.Library = { init: init, show: show, openMine: openMine };
})(window);
