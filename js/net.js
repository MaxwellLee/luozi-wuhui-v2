/* =============================================================
 * 《落子无悔 V2》· 联机模块（好友对弈）
 * 模式A：PeerJS 免费云中转（建房/加入，房间号 6 位）
 * 模式B：手动信令码（纯点对点，不依赖任何中转）
 * 消息格式：{t:'move'|'pass'|'resign'|'chat'|'hello', ...}
 * ============================================================= */
(function (g) {
  'use strict';
  var peer = null, conn = null, manual = null;
  var callbacks = { open: [], data: [], close: [], error: [] };
  var CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function on(ev, fn) { (callbacks[ev] = callbacks[ev] || []).push(fn); }
  function emit(ev, arg) {
    (callbacks[ev] || []).forEach(function (f) { try { f(arg); } catch (e) {} });
  }
  function parse(d) {
    if (typeof d !== 'string') return d;
    try { return JSON.parse(d); } catch (e) { return { t: 'raw', s: d }; }
  }
  function send(obj) {
    var str = JSON.stringify(obj);
    if (manual && manual.dc && manual.dc.readyState === 'open') { manual.dc.send(str); return true; }
    if (conn && conn.open) { conn.send(str); return true; }
    return false;
  }
  function isConnected() {
    return !!(conn && conn.open) || !!(manual && manual.dc && manual.dc.readyState === 'open');
  }
  function genId() {
    var s = '';
    for (var i = 0; i < 6; i++) s += CHARS[(Math.random() * CHARS.length) | 0];
    return 'lzw-' + s;
  }
  function wireData(feed) {
    feed.on('data', function (d) { emit('data', parse(d)); });
    feed.on('open', function () { emit('open'); });
    feed.on('close', function () { emit('close'); });
    feed.on('error', function (e) { emit('error', e); });
  }
  /* ---------- 模式A：PeerJS 云端 ---------- */
  function createRoom(cb) {
    var settled = false;
    peer = new Peer(genId());
    peer.on('open', function (id) {
      if (settled) return; settled = true;
      cb(null, id);
    });
    peer.on('connection', function (c) { wireData(c); conn = c; });
    peer.on('error', function (e) {
      if (!settled) { settled = true; cb(e); }
      else emit('error', e);
    });
  }
  function joinRoom(roomId, cb) {
    var settled = false;
    peer = new Peer(genId());
    peer.on('open', function () {
      var c = peer.connect(roomId, { reliable: true });
      wireData(c);
      conn = c;
      var t0 = Date.now();
      var timer = setInterval(function () {
        if (c.open) { clearInterval(timer); if (!settled) { settled = true; cb(null); } }
        else if (Date.now() - t0 > 15000) {
          clearInterval(timer);
          if (!settled) { settled = true; cb(new Error('连接超时，请确认房间号或对方在线')); }
        }
      }, 300);
    });
    peer.on('error', function (e) { if (!settled) { settled = true; cb(e); } else emit('error', e); });
  }
  /* ---------- 模式B：手动信令码（纯点对点） ---------- */
  var STUN = [{ urls: 'stun:stun.l.google.com:19302' }];
  function waitIce(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(function (res) {
      function chk() { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', chk); res(); } }
      pc.addEventListener('icegatheringstatechange', chk);
    });
  }
  function wireManualDC(dc) {
    dc.onopen = function () { emit('open'); };
    dc.onclose = function () { emit('close'); };
    dc.onmessage = function (e) { emit('data', parse(e.data)); };
    dc.onerror = function (e) { emit('error', e); };
  }
  function createManualOffer(cb) {
    var pc = new RTCPeerConnection({ iceServers: STUN });
    var dc = pc.createDataChannel('go', { reliable: true });
    wireManualDC(dc);
    manual = { pc: pc, dc: dc };
    pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
      .then(function () { return waitIce(pc); })
      .then(function () { cb(null, btoa(JSON.stringify(pc.localDescription))); })
      .catch(function (e) { cb(e); });
  }
  function acceptManualOffer(code, cb) {
    var pc = new RTCPeerConnection({ iceServers: STUN });
    pc.ondatachannel = function (e) { wireManualDC(e.channel); manual = { pc: pc, dc: e.channel }; };
    var desc;
    try { desc = JSON.parse(atob(String(code).trim())); } catch (e) { return cb(new Error('对方信令码格式错误')); }
    pc.setRemoteDescription(desc).then(function () { return pc.createAnswer(); })
      .then(function (a) { return pc.setLocalDescription(a); })
      .then(function () { return waitIce(pc); })
      .then(function () { cb(null, btoa(JSON.stringify(pc.localDescription))); })
      .catch(function (e) { cb(e); });
  }
  function completeManual(answerCode, cb) {
    if (!manual || !manual.pc) return cb(new Error('请先点击「生成我的信令码」'));
    var desc;
    try { desc = JSON.parse(atob(String(answerCode).trim())); } catch (e) { return cb(new Error('对方信令码格式错误')); }
    manual.pc.setRemoteDescription(desc).then(function () { cb(null); }).catch(function (e) { cb(e); });
  }
  function leave() {
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    try { if (manual && manual.pc) manual.pc.close(); } catch (e) {}
    peer = conn = manual = null;
    callbacks = { open: [], data: [], close: [], error: [] };
  }
  g.Net = {
    on: on, send: send, isConnected: isConnected,
    createRoom: createRoom, joinRoom: joinRoom,
    createManualOffer: createManualOffer, acceptManualOffer: acceptManualOffer,
    completeManual: completeManual, leave: leave
  };
})(typeof window !== 'undefined' ? window : globalThis);
