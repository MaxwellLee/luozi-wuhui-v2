/* =============================================================
 * 《落子无悔》· 主程序：视图切换 / 设置 / 弹窗 / 音频 / 下载
 * ============================================================= */
(function (g) {
  'use strict';
  var U = g.GoUtil, S = g.GoStorage;
  var settings = S.getSettings();
  var VIEWS = ['view-menu', 'view-game', 'view-classroom', 'view-library', 'view-story', 'view-settings'];

  function $(id) { return document.getElementById(id); }

  function showView(name) {
    if (name === 'menu') name = 'view-menu'; // 兼容 data-back="menu"
    for (var i = 0; i < VIEWS.length; i++) {
      var v = $(VIEWS[i]);
      if (v) v.classList.add('hidden');
    }
    var target = $(name);
    if (!target) { U.toast('页面不存在：' + name, 'error'); return; }
    target.classList.remove('hidden');
    window.scrollTo(0, 0);
    if (name === 'view-menu') refreshMenu();
    if (name === 'view-classroom') g.Classroom.show();
    if (name === 'view-library') g.Library.show();
    if (name === 'view-story') g.Story.show();
  }
  function getSettings() { return settings; }
  function setSettings(patch) {
    for (var k in patch) settings[k] = patch[k];
    S.saveSettings(settings);
    syncSettingsUI();
    applyAudioSettings();
    if (g.GamePage && g.GamePage.refreshSettings) g.GamePage.refreshSettings();
  }
  function applyAudioSettings() {
    var A = g.GameAudio;
    A.setSoundEnabled(settings.sound);
    A.setMusicEnabled(settings.music);
    A.setTrack(settings.track);
    A.setMusicVolume(settings.volume);
  }
  function syncSettingsUI() {
    var s = settings;
    var cards = document.querySelectorAll('.skin-card');
    for (var i = 0; i < cards.length; i++) cards[i].classList.toggle('active', cards[i].getAttribute('data-skin') === s.skin);
    $('set-size').value = String(s.size);
    $('set-difficulty').value = s.difficulty;
    $('set-name').value = s.playerName;
    $('set-sound').checked = !!s.sound;
    $('set-music').checked = !!s.music;
    $('set-track').value = s.track;
    $('set-volume').value = Math.round((s.volume || .5) * 100);
    $('set-hints').checked = !!s.hints;
    $('set-comments').checked = !!s.comments;
  }
  /* ---------- 弹窗 ---------- */
  function openModal(html, opts) {
    opts = opts || {};
    var box = $('modal-box');
    box.innerHTML = html;
    $('modal-root').classList.remove('hidden');
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      $('modal-root').classList.add('hidden');
      box.innerHTML = '';
      var bd = $('modal-root').querySelector('.modal-backdrop');
      if (bd) bd.onclick = null;
    }
    if (opts.dismissible !== false) {
      $('modal-root').querySelector('.modal-backdrop').onclick = close;
    }
    return { box: box, close: close };
  }
  function modal(opts) {
    var html = '<div class="modal-title">' + U.esc(opts.title || '') + '</div><div class="modal-body">' + (opts.body || '') + '</div>';
    if (opts.actions && opts.actions.length) {
      html += '<div class="modal-actions">' + opts.actions.map(function (a, idx) {
        return '<button class="btn ' + (a.cls || '') + '" data-act="' + idx + '">' + U.esc(a.label) + '</button>';
      }).join('') + '</div>';
    }
    var m = openModal(html, { dismissible: opts.dismissible !== false });
    var btns = m.box.querySelectorAll('[data-act]');
    for (var i = 0; i < btns.length; i++) {
      (function (b, idx) {
        b.onclick = function () {
          var a = opts.actions[idx];
          if (a.onClick) { var r = a.onClick(); if (r === 'keep') return; }
          m.close();
        };
      })(btns[i], parseInt(btns[i].getAttribute('data-act'), 10));
    }
    return m;
  }
  function downloadFile(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 600);
  }
  function copyText(txt, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { U.toast(okMsg || '已复制'); }, function () { fallbackCopy(txt); });
    } else fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); U.toast('已复制'); } catch (e) { U.toast('复制失败，请手动选择复制'); }
    document.body.removeChild(ta);
  }
  function showShare() {
    var url = window.location.href;
    var msg = '来下围棋吧！《落子无悔》——新手友好的围棋教学对弈游戏，柯洁老师在线教学，还能好友对战。\n' + url;
    var m = g.App.modal({
      title: '分享给朋友',
      body:
        '<div class="share-box">' +
        '<div class="share-qr" id="share-qr"></div>' +
        '<p class="muted small">扫一扫打开游戏，或把链接/文案发给好友</p></div>' +
        '<div class="share-links">' +
        '<button class="btn small primary" id="share-copy-link">复制链接</button>' +
        '<button class="btn small" id="share-copy-msg">复制邀请文案</button></div>' +
        '<textarea class="share-msg" id="share-msg" readonly>' + U.esc(msg) + '</textarea>',
      actions: [{ label: '关闭', cls: 'ghost' }]
    });
    try {
      if (typeof QRCode !== 'undefined') {
        new QRCode(m.box.querySelector('#share-qr'), { text: url, width: 180, height: 180 });
      } else {
        m.box.querySelector('#share-qr').textContent = url;
      }
    } catch (e) { m.box.querySelector('#share-qr').textContent = url; }
    m.box.querySelector('#share-copy-link').addEventListener('click', function () { copyText(url); });
    m.box.querySelector('#share-copy-msg').addEventListener('click', function () { copyText(msg); });
  }
  var friendState = null;
  function showFriend() {
    friendState = { connected: false };
    var m = g.App.modal({
      title: '好友对弈',
      body:
        '<div class="friend-tabs">' +
        '<button class="friend-tab active" data-ftab="cloud">快速联机（房间号）</button>' +
        '<button class="friend-tab" data-ftab="manual">手动信令</button></div>' +
        '<div id="ftab-cloud">' +
        '<p class="muted small">你和好友各自打开本页面：一方「创建房间」得到 <strong>6 位数字</strong>房间号，另一方输入<strong>相同的 6 位数字</strong>「加入房间」即可匹配。免费点对点，不经过游戏服务器。</p>' +
        '<div class="option-row"><button class="btn primary" id="f-create">创建房间</button>' +
        '<input type="text" id="f-roomid" maxlength="8" placeholder="6位数字" style="width:130px">' +
        '<button class="btn" id="f-join">加入房间</button></div>' +
        '<div id="f-room-info" class="hidden">' +
        '<div class="room-code" id="f-code-text"></div>' +
        '<div class="option-row"><button class="btn small" id="f-copy">复制房间号</button></div>' +
        '<p class="muted small" id="f-waiting">等待好友加入……（请保持本页面打开）</p></div>' +
        '<div id="f-status" class="muted small"></div></div>' +
        '<div id="ftab-manual" class="hidden">' +
        '<p class="muted small">1. 你点「生成我的信令码」并把代码发给好友；<br>2. 好友把代码粘入「粘贴对方信令码」生成应答码发回；<br>3. 你把应答码粘到下方，点「完成连接」。全程点对点，不依赖中转。</p>' +
        '<button class="btn small" id="f-gen">① 生成我的信令码</button>' +
        '<textarea id="f-mycode" class="friend-code" readonly placeholder="我的信令码会出现在这里"></textarea>' +
        '<button class="btn small" id="f-copy-code">复制我的信令码</button>' +
        '<textarea id="f-answer" class="friend-code" placeholder="粘贴对方的应答码"></textarea>' +
        '<button class="btn primary" id="f-complete">③ 完成连接</button>' +
        '<div id="f-mstatus" class="muted small"></div></div>',
      actions: [{ label: '关闭', cls: 'ghost', onClick: function () { g.Net.leave(); } }]
    });
    friendModal = m;
    function status(txt) { var s = m.box.querySelector('#f-status'); if (s) s.textContent = txt; }
    function mstatus(txt) { var s = m.box.querySelector('#f-mstatus'); if (s) s.textContent = txt; }
    var tabs = m.box.querySelectorAll('.friend-tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (t) {
        t.addEventListener('click', function () {
          for (var k = 0; k < tabs.length; k++) tabs[k].classList.toggle('active', tabs[k] === t);
          var which = t.getAttribute('data-ftab');
          m.box.querySelector('#ftab-cloud').classList.toggle('hidden', which !== 'cloud');
          m.box.querySelector('#ftab-manual').classList.toggle('hidden', which !== 'manual');
        });
      })(tabs[i]);
    }
    /* 云端 */
    m.box.querySelector('#f-create').addEventListener('click', function () {
      g.Net.createRoom(function (err, id) {
        if (err) { status('创建失败：' + err.message); return; }
        friendState.creator = true;
        m.box.querySelector('#f-room-info').classList.remove('hidden');
        m.box.querySelector('#f-code-text').textContent = id;
        m.box.querySelector('#f-create').disabled = true;
        status('已创建房间，等待好友加入……');
      });
    });
    m.box.querySelector('#f-copy').addEventListener('click', function () {
      copyText(m.box.querySelector('#f-code-text').textContent);
    });
    m.box.querySelector('#f-join').addEventListener('click', function () {
      var id = m.box.querySelector('#f-roomid').value.trim();
      if (!/^\d{6}$/.test(id)) { status('请输入 6 位数字房间号'); return; }
      friendState.creator = false;
      status('正在连接房间 ' + id + ' ……');
      g.Net.joinRoom(id, function (err) {
        if (err) { status('加入失败：' + err.message); return; }
        status('连接成功，等待对局设置……');
        g.Net.send({ t: 'joined' }); // 主动通知房主：我已连上，请发对局设置
      });
    });
    /* 手动信令 */
    m.box.querySelector('#f-gen').addEventListener('click', function () {
      friendState.creator = true;
      mstatus('正在生成信令码……');
      g.Net.createManualOffer(function (err, code) {
        if (err) { mstatus('生成失败：' + err.message); return; }
        m.box.querySelector('#f-mycode').value = code;
        mstatus('请把上面的信令码发给好友。');
      });
    });
    m.box.querySelector('#f-copy-code').addEventListener('click', function () {
      copyText(m.box.querySelector('#f-mycode').value, '信令码已复制');
    });
    m.box.querySelector('#f-complete').addEventListener('click', function () {
      g.Net.completeManual(m.box.querySelector('#f-answer').value, function (err) {
        if (err) { mstatus('连接失败：' + err.message); return; }
        mstatus('连接成功！等待对局设置……');
      });
    });
  }
  /* 好友对局：连接状态与消息处理 */
  var friendModal = null;
  var friendSetupShown = false;
  function closeFriendModal() { if (friendModal) { try { friendModal.close(); } catch (e) {} friendModal = null; } }
  function tryShowPvpSetup() {
    // 房主收到「open」或「joined」消息时弹对局设置（只弹一次）
    if (friendSetupShown) return;
    if (!friendState || !friendState.creator) return;
    friendSetupShown = true;
    showPvpSetup();
  }
  g.Net.on('open', function () {
    U.toast('好友已连接！');
    if (friendState && friendState.creator) {
      tryShowPvpSetup();
    } else {
      var st = document.querySelector('#f-status');
      if (st) st.textContent = '已连接！等待房主设置对局……';
      var st2 = document.querySelector('#f-mstatus');
      if (st2) st2.textContent = '已连接！等待房主设置对局……';
    }
  });
  function showPvpSetup() {
    g.App.modal({
      title: '对局设置',
      body:
        '<div class="option-row"><label>棋盘大小</label>' +
        '<select id="pv-size"><option value="9" selected>9 路</option><option value="13">13 路</option><option value="19">19 路</option></select></div>' +
        '<p class="muted small">你执黑先行，好友执白。<br>好友对弈落子无悔；双方停一手后自动点目。</p>',
      actions: [
        { label: '取消', cls: 'ghost', onClick: function () { g.Net.send({ t: 'cancel' }); g.Net.leave(); } },
        { label: '开始', cls: 'primary', onClick: function () {
            var size = parseInt(document.getElementById('pv-size').value, 10) || 9;
            g.Net.send({ t: 'start', size: size, name: g.App.getSettings().playerName });
            g.GamePage.startPvp({ size: size, creator: true });
          } }
      ]
    });
  }
  g.Net.on('data', function (msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'joined') {
      tryShowPvpSetup();
      return;
    }
    if (msg.t === 'start') {
      closeFriendModal();
      g.GamePage.startPvp({ size: msg.size, creator: false, oppName: msg.name });
    } else if (msg.t === 'cancel') {
      closeFriendModal();
      U.toast('对方取消了本次对局');
      g.Net.leave();
    }
  });
  g.Net.on('close', function () {
    U.toast('与好友的连接已断开', 'warn');
    if (g.GamePage.getBoard() && g.GamePage.isPvp()) g.GamePage.leave();
  });
  function refreshMenu() {
    var cur = S.loadCurrent();
    $('btn-continue').classList.toggle('hidden', !cur);
    $('menu-avatar-player').innerHTML = g.Avatars.player('happy');
    $('menu-avatar-ai').innerHTML = g.Avatars.ai('normal');
  }
  /* ---------- 设置绑定 ---------- */
  function bindSettings() {
    var cards = document.querySelectorAll('.skin-card');
    for (var i = 0; i < cards.length; i++) {
      (function (c) {
        c.addEventListener('click', function () {
          var id = c.getAttribute('data-skin');
          setSettings({ skin: id });
          g.GO_SKINS.apply(id);
          if (g.GamePage && g.GamePage.getBoard()) g.GamePage.getBoard().setSkin(id);
          U.toast('已切换皮肤：' + g.GO_SKINS[id].name);
        });
      })(cards[i]);
    }
    $('set-size').addEventListener('change', function () { setSettings({ size: parseInt(this.value, 10) }); });
    $('set-difficulty').addEventListener('change', function () { setSettings({ difficulty: this.value }); });
    $('set-name').addEventListener('change', function () { setSettings({ playerName: this.value.trim() || '棋友' }); });
    $('set-sound').addEventListener('change', function () { setSettings({ sound: this.checked }); });
    $('set-music').addEventListener('change', function () { setSettings({ music: this.checked }); });
    $('set-track').addEventListener('change', function () { setSettings({ track: this.value }); });
    $('set-volume').addEventListener('input', function () {
      settings.volume = this.value / 100;
      S.saveSettings(settings);
      g.GameAudio.setMusicVolume(settings.volume);
    });
    $('set-hints').addEventListener('change', function () { setSettings({ hints: this.checked }); });
    $('set-comments').addEventListener('change', function () { setSettings({ comments: this.checked }); });
    $('btn-export-all').addEventListener('click', function () {
      var games = S.listGames();
      if (!games.length) { U.toast('还没有保存的对局'); return; }
      downloadFile('落子无悔-我的对局.json', JSON.stringify(games, null, 2), 'application/json');
      U.toast('已导出 ' + games.length + ' 局对局记录');
    });
    $('btn-reset-data').addEventListener('click', function () {
      g.App.modal({
        title: '清除全部数据',
        body: '<p>将删除所有对局记录、学习进度与设置，且无法恢复。确定吗？</p>',
        actions: [
          { label: '取消', cls: 'ghost' },
          { label: '确定清除', cls: 'danger', onClick: function () { S.resetAll(); location.reload(); } }
        ]
      });
    });
  }
  function init() {
    applyAudioSettings();
    g.GO_SKINS.apply(settings.skin);
    refreshMenu();
    bindSettings();
    $('btn-new-game').addEventListener('click', function () { g.GamePage.newGameFlow(); });
    $('btn-friend').addEventListener('click', function () { showFriend(); });
    $('btn-share').addEventListener('click', function () { showShare(); });
    $('btn-continue').addEventListener('click', function () { g.GamePage.resume(); });
    $('btn-classroom').addEventListener('click', function () { showView('view-classroom'); });
    $('btn-library').addEventListener('click', function () { showView('view-library'); });
    $('btn-story').addEventListener('click', function () { showView('view-story'); });
    $('btn-settings').addEventListener('click', function () { showView('view-settings'); syncSettingsUI(); });
    var backs = document.querySelectorAll('[data-back]');
    for (var i = 0; i < backs.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { showView(b.getAttribute('data-back')); });
      })(backs[i]);
    }
    var unlocked = false;
    document.addEventListener('pointerdown', function () {
      if (unlocked) return;
      unlocked = true;
      g.GameAudio.unlock();
      if (settings.music) g.GameAudio.playMusic();
    });
    function safe(fn, label) {
      try { fn(); } catch (e) {
        U.toast('初始化出错（' + label + '）：' + (e && e.message ? e.message : e), 'error');
      }
    }
    safe(function () { g.GamePage.init(); }, '对局模块');
    safe(function () { g.Classroom.init(); }, '课堂模块');
    safe(function () { g.Library.init(); }, '棋谱库模块');
    safe(function () { g.Story.init(); }, '故事模块');
    showView('view-menu');
    setTimeout(function () { U.toast('欢迎来到《落子无悔》！推荐先逛「围棋课堂」学规则，再来对局。'); }, 800);
  }
  document.addEventListener('DOMContentLoaded', init);
  g.App = { showView: showView, getSettings: getSettings, setSettings: setSettings, openModal: openModal, modal: modal, downloadFile: downloadFile, refreshMenu: refreshMenu, toast: U.toast, showFriend: showFriend, showShare: showShare };
})(window);
