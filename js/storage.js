/* =============================================================
 * 《落子无悔》· 本地存档与 SGF 导入导出
 * 浏览器 localStorage：设置 / 学习进度 / 对局记录 / 进行中的对局。
 * ============================================================= */
(function (g) {
  'use strict';
  var KEYS = { settings: 'lzwh.settings.v1', progress: 'lzwh.progress.v1', games: 'lzwh.games.v1', current: 'lzwh.current.v1' };
  function load(key, def) {
    try {
      var s = localStorage.getItem(key);
      if (s == null) return def;
      return JSON.parse(s);
    } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 空间不足等，静默 */ }
  }
  var DEFAULTS = {
    skin: 'warm', sound: true, music: true, track: 'bamboo', volume: 0.55,
    hints: true, comments: true, difficulty: 'easy', size: 9, playerName: '棋友'
  };
  function getSettings() {
    var s = load(KEYS.settings, {});
    var out = {};
    for (var k in DEFAULTS) out[k] = (k in s) ? s[k] : DEFAULTS[k];
    return out;
  }
  function saveSettings(s) { save(KEYS.settings, s); }
  function getProgress() { return load(KEYS.progress, { lessons: {} }); }
  function saveProgress(p) { save(KEYS.progress, p); }
  function listGames() { var a = load(KEYS.games, []); return Array.isArray(a) ? a : []; }
  function addGame(rec) { var a = listGames(); a.unshift(rec); if (a.length > 60) a.length = 60; save(KEYS.games, a); }
  function deleteGame(id) { save(KEYS.games, listGames().filter(function (r) { return r.id !== id; })); }
  function saveCurrent(st) { save(KEYS.current, st); }
  function loadCurrent() { return load(KEYS.current, null); }
  function clearCurrent() { try { localStorage.removeItem(KEYS.current); } catch (e) {} }
  function resetAll() { try { for (var k in KEYS) localStorage.removeItem(KEYS[k]); } catch (e) {} }

  /* ---------- SGF ---------- */
  var SGF_LETTERS = 'abcdefghijklmnopqrs';
  function sgfCoord(x, y) { return SGF_LETTERS[x] + SGF_LETTERS[y]; }
  function parseSgfCoord(s) {
    if (!s || s.length < 2) return null;
    var x = SGF_LETTERS.indexOf(s[0]), y = SGF_LETTERS.indexOf(s[1]);
    if (x < 0 || y < 0) return null;
    return { x: x, y: y };
  }
  function escapeSgf(s) { return String(s).replace(/\\/g, '\\\\').replace(/\]/g, '\\]'); }
  function unescapeSgf(s) { return String(s).replace(/\\\]/g, ']').replace(/\\\\/g, '\\'); }
  function exportSGF(rec) {
    var L = [];
    L.push('(;GM[1]FF[4]CA[UTF-8]AP[落子无悔:1.0]');
    L.push('SZ[' + rec.size + ']');
    L.push('KM[' + (rec.komi != null ? rec.komi : 7.5) + ']');
    L.push('RU[Chinese]');
    L.push('PB[' + escapeSgf(rec.blackName || '棋友') + ']');
    L.push('PW[' + escapeSgf(rec.whiteName || '柯洁老师') + ']');
    if (rec.handicap) L.push('HA[' + rec.handicap + ']');
    if (rec.date) L.push('DT[' + rec.date + ']');
    if (rec.result) L.push('RE[' + escapeSgf(rec.result) + ']');
    var moves = rec.moves || [];
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var node = ';' + (m.c === 1 ? 'B' : 'W') + '[';
      if (m.x != null && m.y != null) node += sgfCoord(m.x, m.y);
      node += ']';
      if (m.comment) node += 'C[' + escapeSgf(m.comment) + ']';
      L.push(node);
    }
    L.push(')');
    return L.join('');
  }
  function parseSGF(text) {
    text = String(text || '').trim();
    var i = text.indexOf('(');
    var j = text.lastIndexOf(')');
    if (i < 0) return { error: '不是有效的 SGF 文件（缺少括号）' };
    var body = text.slice(i + 1, j < 0 ? text.length : j);
    var rec = { size: 19, komi: 7.5, handicap: 0, blackName: '', whiteName: '', moves: [], setup: [], result: '', date: '' };
    var nodes = body.split(';');
    for (var n = 1; n < nodes.length; n++) {
      var node = nodes[n];
      var re = /([A-Z]{1,2})\[([^\]]*)\]/g;
      var m;
      while ((m = re.exec(node))) {
        var key = m[1], val = unescapeSgf(m[2]);
        if (key === 'SZ') rec.size = parseInt(val, 10) || 19;
        else if (key === 'KM') rec.komi = parseFloat(val);
        else if (key === 'HA') rec.handicap = parseInt(val, 10) || 0;
        else if (key === 'PB') rec.blackName = val;
        else if (key === 'PW') rec.whiteName = val;
        else if (key === 'RE') rec.result = val;
        else if (key === 'DT') rec.date = val;
        else if (key === 'B' || key === 'W') {
          if (val) {
            var c = parseSgfCoord(val);
            if (!c) return { error: '坐标无法解析：' + val };
            rec.moves.push({ x: c.x, y: c.y, c: key === 'B' ? 1 : 2 });
          } else rec.moves.push({ c: key === 'B' ? 1 : 2 });
        }
        else if (key === 'AB' || key === 'AW') {
          var c2 = parseSgfCoord(val);
          if (c2) rec.setup.push({ x: c2.x, y: c2.y, c: key === 'AB' ? 1 : 2 });
        }
      }
    }
    if (rec.size !== 9 && rec.size !== 13 && rec.size !== 19) return { error: '仅支持 9/13/19 路棋盘' };
    if (!rec.moves.length && !rec.setup.length) return { error: '棋谱里没有棋步' };
    if (!isFinite(rec.komi)) rec.komi = 7.5;
    return rec;
  }

  g.GoStorage = {
    KEYS: KEYS, load: load, save: save,
    getSettings: getSettings, saveSettings: saveSettings,
    getProgress: getProgress, saveProgress: saveProgress,
    listGames: listGames, addGame: addGame, deleteGame: deleteGame,
    saveCurrent: saveCurrent, loadCurrent: loadCurrent, clearCurrent: clearCurrent,
    resetAll: resetAll, exportSGF: exportSGF, parseSGF: parseSGF
  };
})(typeof window !== 'undefined' ? window : globalThis);
