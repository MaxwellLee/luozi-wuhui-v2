/*!
 * 落子无悔 · 纯 Web Audio 音频模块  (js/audio.js)
 * ------------------------------------------------------------------
 * 经典浏览器脚本（非 ES 模块），挂载 window.GameAudio。
 * 所有声音均由 Web Audio API 实时合成，不加载任何外部文件、图片、
 * 网络资源，也不使用 <audio> 标签；Web Audio 不可用时静默降级。
 *
 * 公共接口：
 *   unlock()              用户首次交互时调用：创建/恢复 AudioContext
 *                         （内部 try/catch，永不抛异常）
 *   play(name)            音效：place 落子 / capture 提子 / warn 警告
 *                         / win 胜利 / lose 失败 / pass 停一手
 *                         / click 按钮 / start 开局
 *   setSoundEnabled(b)    音效开关
 *   musicTracks           曲目表（只读）：{id, name, desc}
 *   setTrack(id)          切换曲目；播放中则渐弱→切换→渐强热切换
 *   playMusic()           开始循环播放背景音乐
 *   stopMusic()           停止背景音乐
 *   setMusicVolume(v)     音乐音量 0..1
 *   setMusicEnabled(b)    false 时停止音乐
 *   getState()            -> {soundEnabled, musicEnabled, trackId, volume}
 */
(function (global) {
  'use strict';

  /* ================= 基础状态与音频上下文 ================= */

  var AudioContextClass = global.AudioContext || global.webkitAudioContext;
  var ctx = null;        // AudioContext（惰性创建，失败则保持 null）
  var soundGain = null;  // 音效总线
  var musicGain = null;  // 音乐总线（主增益恒定 ≤ 0.15）
  var noiseBuf = null;   // 复用的白噪声缓冲（所有噪声类音色共用）

  var soundEnabled = true;   // 音效开关
  var musicEnabled = true;   // 音乐开关
  var musicVolume = 0.8;     // 音乐音量 0..1
  var currentTrackId = 'bamboo';  // 当前曲目
  var lastPlayAt = {};       // 音效限频：name -> 上次播放时刻（秒）


  /* ================= 通用工具函数 ================= */

  // MIDI 音高 -> 频率（Hz）
  function midiFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // 五声音阶（宫商角徵羽）相对基音的半音偏移
  var PENTA = [0, 2, 4, 7, 9];

  // 五声音阶取音：base=基音 MIDI，deg=音阶级数(0~4)，oct=八度偏移
  function pentaFreq(base, deg, oct) {
    return midiFreq(base + PENTA[deg] + (oct || 0) * 12);
  }

  // 取得（或创建）1.5 秒白噪声缓冲
  function getNoise() {
    if (!ctx) return null;
    if (!noiseBuf) {
      var len = Math.floor(ctx.sampleRate * 1.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        d[i] = Math.random() * 2 - 1;
      }
    }
    return noiseBuf;
  }

  // 音乐主增益渐变到目标值 v（音乐主增益上限恒为 0.15）
  function rampMusicTo(v, sec) {
    if (!ctx || !musicGain) return;
    var g = musicGain.gain;
    var t0 = ctx.currentTime;
    var cur = Math.max(g.value, 0.0001);
    g.cancelScheduledValues(t0);
    g.setValueAtTime(cur, t0);
    g.linearRampToValueAtTime(Math.max(v, 0.0001), t0 + Math.max(sec, 0.02));
  }

  // 指数衰减型总线增益（音效通用包络）：3ms 起音 -> peak -> dur 内衰减到静音
  function sfxGain(t, peak, dur) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(soundGain);
    return g;
  }

  // 通用拨弦音色：三角波 + 低通滤波，指数衰减（古琴/钟琴类音色基础）
  function pluckTick(t, freq, dur, level) {
    var osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = freq * 3;
    var g = sfxGain(t, level, dur);
    osc.connect(lp);
    lp.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }


  /* ================= 解锁与音频图构建 ================= */

  // 用户首次交互时调用：创建/恢复 AudioContext，永不抛异常
  function unlock() {
    try {
      if (!AudioContextClass) return;             // 环境不支持 Web Audio
      if (!ctx || ctx.state === 'closed') {        // 不存在或已关闭则重建
        ctx = new AudioContextClass();
        buildGraph();
      }
      if (ctx.state === 'suspended') {             // 浏览器自动挂起则恢复
        var p = ctx.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(function () { /* 静默 */ });
        }
      }
    } catch (e) {
      // 创建失败：静默降级，之后所有音频调用都成为空操作
      ctx = null;
      soundGain = null;
      musicGain = null;
    }
  }

  // 构建输出图：音效总线、音乐总线（主增益 0.0001 初始静音）
  function buildGraph() {
    if (!ctx) return;
    soundGain = ctx.createGain();
    soundGain.gain.value = 1;
    soundGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0001;   // 播放音乐时再渐入
    musicGain.connect(ctx.destination);
  }


  /* ================= 音效合成 ================= */

  // 各音效的最短间隔（秒），防止连点/重入造成爆音
  var SFX_GAP = {
    place: 0.09, capture: 0.15, warn: 0.30, win: 0.45,
    lose: 0.45, pass: 0.15, click: 0.05, start: 0.30
  };

  // 限频检查：同一音效在间隔内只允许播放一次
  function rateLimit(name) {
    var nowS = Date.now() / 1000;
    var gap = SFX_GAP[name] || 0.05;
    if (nowS - (lastPlayAt[name] || 0) < gap) return false;
    lastPlayAt[name] = nowS;
    return true;
  }

  // 落子：木质敲击 = 短噪声突发（带通）+ 低频正弦下滑
  function sfxPlace(t) {
    // 噪声突发的“木质感”
    var nb = ctx.createBufferSource();
    nb.buffer = getNoise();
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600;
    bp.Q.value = 1.2;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.5, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    nb.connect(bp);
    bp.connect(ng);
    ng.connect(soundGain);
    nb.start(t);
    nb.stop(t + 0.12);
    // 低频木质本体：200Hz 快速下滑到 70Hz
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.07);
    var og = ctx.createGain();
    og.gain.setValueAtTime(0.9, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
    osc.connect(og);
    og.connect(soundGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  // 提子：多粒连续轻响（下行三连拨弦）
  function sfxCapture(t) {
    var base = midiFreq(88);           // E6
    var offsets = [0, -2, -5];         // 依次下行
    for (var i = 0; i < offsets.length; i++) {
      pluckTick(t + i * 0.055, base * Math.pow(2, offsets[i] / 12), 0.2, 0.22);
    }
  }

  // 警告：柔和单音叮（基音 + 微弱泛音）
  function sfxWarn(t) {
    var g = sfxGain(t, 0.25, 0.55);
    var o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 880;          // A5
    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 1318.5;       // E6 泛音
    var g2 = ctx.createGain();
    g2.gain.value = 0.3;
    o1.connect(g);
    o2.connect(g2);
    g2.connect(g);
    o1.start(t); o1.stop(t + 0.6);
    o2.start(t); o2.stop(t + 0.6);
  }

  // 胜利：上行五声音阶琶音（C5 D5 E5 G5 A5）
  function sfxWin(t) {
    var degs = [0, 1, 2, 3, 4];
    for (var i = 0; i < degs.length; i++) {
      var f = pentaFreq(72, degs[i], 0);
      var dur = (i === degs.length - 1) ? 0.9 : 0.28;  // 末音稍长
      pluckTick(t + i * 0.10, f, dur, 0.24);
    }
  }

  // 失败：下行柔和音（A4 G4 E4 C4，节奏舒缓）
  function sfxLose(t) {
    var base = midiFreq(69);           // A4
    var seq = [0, -2, -4, -7];
    for (var i = 0; i < seq.length; i++) {
      pluckTick(t + i * 0.16, base * Math.pow(2, seq[i] / 12), 0.5, 0.16);
    }
  }

  // 停一手：轻拍（短促低通噪声）
  function sfxPass(t) {
    var nb = ctx.createBufferSource();
    nb.buffer = getNoise();
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    var g = sfxGain(t, 0.3, 0.07);
    nb.connect(lp);
    lp.connect(g);
    nb.start(t);
    nb.stop(t + 0.1);
  }

  // 按钮：轻咔（极短高通噪声）
  function sfxClick(t) {
    var nb = ctx.createBufferSource();
    nb.buffer = getNoise();
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    var g = sfxGain(t, 0.14, 0.035);
    nb.connect(hp);
    hp.connect(g);
    nb.start(t);
    nb.stop(t + 0.06);
  }

  // 开局：柔和上行双音（C5 -> G5）
  function sfxStart(t) {
    var g = sfxGain(t, 0.22, 0.8);
    var o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = midiFreq(72);
    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = midiFreq(79);
    o1.connect(g);
    o2.connect(g);
    o1.start(t); o1.stop(t + 0.85);
    o2.start(t + 0.12); o2.stop(t + 0.85);
  }

  // 音效分发：限频 + 按名字调度
  function play(name) {
    if (!soundEnabled) return;
    if (!ctx) unlock();                  // 允许在用户手势中惰性创建
    if (!ctx) return;
    if (!rateLimit(name)) return;
    var t = ctx.currentTime;
    switch (name) {
      case 'place':   sfxPlace(t);   break;
      case 'capture': sfxCapture(t); break;
      case 'warn':    sfxWarn(t);    break;
      case 'win':     sfxWin(t);     break;
      case 'lose':    sfxLose(t);    break;
      case 'pass':    sfxPass(t);    break;
      case 'click':   sfxClick(t);   break;
      case 'start':   sfxStart(t);   break;
      default: /* 未知音效：忽略 */   break;
    }
  }


  /* ================= 背景音乐：音色节点 ================= */

  // 竹笛长音：正弦 + 轻颤音（LFO 调 detune）+ 微弱呼吸噪声
  function fluteNote(state, t, freq, dur) {
    // 主振荡器（正弦）
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // 颤音：4.5~6Hz 正弦调制 detune（约 6 音分）
    var vib = ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 4.5 + Math.random() * 1.5;
    var vGain = ctx.createGain();
    vGain.gain.value = 6;
    vib.connect(vGain);
    vGain.connect(osc.detune);
    // 微弱八度泛音，增加笛声圆润度
    var osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    var g2 = ctx.createGain();
    g2.gain.value = 0.12;
    // 长音包络：慢起音 -> 保持 -> 缓收
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.15);
    g.gain.setValueAtTime(0.22, t + dur - 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g2.connect(g);
    g.connect(state.bus);
    // 呼吸噪声：音符起音时的气声
    var nb = ctx.createBufferSource();
    nb.buffer = getNoise();
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.012, t + 0.25);
    ng.gain.setValueAtTime(0.012, t + dur - 0.45);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    nb.connect(lp);
    lp.connect(ng);
    ng.connect(state.bus);
    // 启动/停止
    osc.start(t);  osc.stop(t + dur + 0.02);
    vib.start(t);  vib.stop(t + dur + 0.02);
    osc2.start(t); osc2.stop(t + dur + 0.02);
    nb.start(t);   nb.stop(t + dur + 0.02);
  }

  // 古琴拨弦：三角波 + 低通滤波，快起音指数衰减（模拟弦振）
  function qinPluck(state, t, freq, dur) {
    var osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 4, t);
    lp.frequency.exponentialRampToValueAtTime(freq * 1.4, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(state.bus);
    if (state.echoIn) g.connect(state.echoIn);   // 送入余韵回声
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 柔和 Pad 和弦：双振荡器轻微失谐，慢起慢收
  function padChord(state, t, base, degs, dur, level) {
    level = level || 0.05;
    for (var i = 0; i < degs.length; i++) {
      var f = pentaFreq(base, degs[i], 0);
      var o1 = ctx.createOscillator();
      o1.type = 'triangle';
      o1.frequency.value = f;
      var o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 1.005;           // 轻微失谐制造厚度
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + 1.0);
      g.gain.setValueAtTime(level, t + dur - 1.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o1.connect(g);
      o2.connect(g);
      g.connect(state.bus);
      if (state.reverbIn) g.connect(state.reverbIn);  // 送入长混响
      o1.start(t); o1.stop(t + dur + 0.02);
      o2.start(t); o2.stop(t + dur + 0.02);
    }
  }

  // 钟琴铃音：正弦基音 + 2.76 倍高频泛音，长衰减（星河入梦用）
  function bellNote(state, t, freq, dur, level) {
    var o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = freq;
    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2.76;
    var g2 = ctx.createGain();
    g2.gain.value = 0.22;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(state.bus);
    if (state.reverbIn) g.connect(state.reverbIn);   // 送入长混响
    o1.start(t); o1.stop(t + dur + 0.02);
    o2.start(t); o2.stop(t + dur + 0.02);
  }

  // FM 合成铃音（八音盒感）：载波 + 调制器指数衰减（空山雨后用）
  function fmBell(state, t, freq, dur, level) {
    var car = ctx.createOscillator();
    car.type = 'sine';
    car.frequency.value = freq;
    var mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = freq * 4.2;             // 调制频率（整数倍 → 谐波音色）
    var mg = ctx.createGain();
    mg.gain.setValueAtTime(freq * 0.7, t);        // 调制深度随衰减收窄
    mg.gain.exponentialRampToValueAtTime(0.01, t + dur);
    mod.connect(mg);
    mg.connect(car.frequency);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    g.connect(state.bus);
    car.start(t); car.stop(t + dur + 0.02);
    mod.start(t); mod.stop(t + dur + 0.02);
  }

  // 用 DelayNode 反馈模拟混响：delay -> 低通 -> 反馈环 + 湿声输出
  function makeReverb(ctx, delaySec, feedbackGain) {
    var delay = ctx.createDelay(2);
    delay.delayTime.value = delaySec;
    var fb = ctx.createGain();
    fb.gain.value = feedbackGain;
    var wet = ctx.createGain();
    wet.gain.value = 0.5;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(wet);
    return { input: delay, output: wet };
  }


  /* ================= 背景音乐：曲目定义 ================= */

  // 公开曲目表（只读约定，主程序不得修改）
  var musicTracks = [
    { id: 'bamboo', name: '竹涧',   desc: '竹笛风·悠扬' },
    { id: 'qin',    name: '松风琴语', desc: '古琴风·清雅' },
    { id: 'star',   name: '星河入梦', desc: '空灵风·静谧' },
    { id: 'rain',   name: '空山雨后', desc: '八音盒风·清新' }
  ];

  // ---- 竹涧：竹笛旋律（每小节一个长音，偶有留白/低八度变化）----
  var BAMBOO_MELODY = [
    { deg: 0, oct: 0 }, { deg: 2, oct: 0 }, { deg: 4, oct: 0 },
    { deg: 7, oct: 0 }, { deg: 4, oct: 0 }, { deg: 2, oct: 0 },
    { deg: 0, oct: 0 }, { rest: true }                    // 末小节呼吸
  ];
  function genBamboo(state, step, t) {
    if (step % 8 !== 0) return;                            // 每小节触发一次
    var bar = ((step / 8) | 0) % BAMBOO_MELODY.length;
    var m = BAMBOO_MELODY[bar];
    if (!m || m.rest) return;
    if (bar !== 0 && Math.random() < 0.10) return;         // 偶尔留白
    var oct = m.oct || 0;
    if (Math.random() < 0.12) oct -= 1;                    // 偶有低八度层次
    fluteNote(state, t, pentaFreq(72, m.deg, oct), state.barDur);
  }

  // ---- 松风琴语：稀疏古琴拨弦 + 回声余韵 ----
  var QIN_PHRASES = [
    [[0, 0]],
    [[0, 0], [2.5, 2]],
    [[0, 0], [2, 4], [3.5, 2]],
    [[0, 4], [1.5, 2], [3, 0]],
    [[0, 0], [2.5, 4]],
    [[0, 2], [3, 0]]
  ];
  function genQin(state, step, t) {
    if (step % 8 !== 0) return;
    var bar = ((step / 8) | 0) % QIN_PHRASES.length;
    var phrase = QIN_PHRASES[bar];
    if (Math.random() < 0.12) phrase = [];                 // 偶尔空拍
    var beat = 60 / state.bpm;                             // 一拍时长
    for (var i = 0; i < phrase.length; i++) {
      var off = phrase[i][0];
      var deg = phrase[i][1];
      var freq = pentaFreq(57, deg, Math.random() < 0.15 ? -1 : 0);
      qinPluck(state, t + off * beat, freq, 1.1 + Math.random() * 0.6);
    }
  }
  // 古琴余韵：回声（0.45s 反馈延迟）
  function setupQin(ctx, state) {
    var d = ctx.createDelay(2);
    d.delayTime.value = 0.45;
    var fb = ctx.createGain();
    fb.gain.value = 0.30;
    var wet = ctx.createGain();
    wet.gain.value = 0.40;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    d.connect(lp);
    lp.connect(fb);
    fb.connect(d);
    lp.connect(wet);
    wet.connect(state.bus);
    state.echoIn = d;
  }

  // ---- 星河入梦：柔和 Pad 长音 + 高音钟琴琶音 + 长混响 ----
  var STAR_CHORDS = [[0, 2, 4], [2, 4, 7], [4, 7, 9], [2, 4, 7]];
  var STAR_ARP = [0, 2, 4, 7, 9, 7, 4, 2];                 // 五声音阶琶音
  function genStar(state, step, t) {
    if (step % 8 === 0) {                                  // 每小节换和弦
      var bar = ((step / 8) | 0) % STAR_CHORDS.length;
      padChord(state, t, 60, STAR_CHORDS[bar], state.barDur * 2, 0.045);
    }
    if (Math.random() < 0.7) {                             // 高音钟琴琶音
      var deg = STAR_ARP[step % STAR_ARP.length];
      bellNote(state, t, pentaFreq(84, deg, 0), 1.5, 0.10);
    }
  }
  // 星河混响：双延迟反馈营造空灵长尾
  function setupStar(ctx, state) {
    var reverb = makeReverb(ctx, 0.5, 0.5);
    reverb.output.connect(state.bus);
    state.reverbIn = reverb.input;
  }

  // ---- 空山雨后：FM 八音盒铃音 + 轻 Pad ----
  var RAIN_ARP = [0, 2, 4, 7, 9, 7, 4, 2];
  var RAIN_PAD = [[0, 2], [2, 4], [4, 7], [2, 4]];
  function genRain(state, step, t) {
    if (Math.random() < 0.78) {                            // 铃音琶音（带随机留空）
      var deg = RAIN_ARP[step % RAIN_ARP.length];
      fmBell(state, t, pentaFreq(84, deg, 0), 1.1, 0.12);
    }
    if (step % 16 === 0) {                                 // 每两小节垫一个和弦
      var bar = ((step / 16) | 0) % RAIN_PAD.length;
      padChord(state, t, 60, RAIN_PAD[bar], state.barDur * 2, 0.04);
    }
  }

  // 曲目注册表：BPM、轨道增益、生成器、初始化（音色辅助节点）
  var trackRegistry = {
    bamboo: { bpm: 66, busGain: 1.0, gen: genBamboo, setup: null },
    qin:    { bpm: 60, busGain: 1.1, gen: genQin,    setup: setupQin },
    star:   { bpm: 72, busGain: 0.9, gen: genStar,   setup: setupStar },
    rain:   { bpm: 78, busGain: 0.9, gen: genRain,   setup: null }
  };


  /* ================= 背景音乐：调度与切换 ================= */

  var music = {
    playing: false,   // 是否在播放
    state: null,      // 当前曲目运行状态（bus / 辅助节点 / 时长数据）
    timer: null,      // 调度器定时器
    nextTime: 0,      // 下一个待排音符的音频时钟时间
    step: 0,          // 当前步进（八分音符粒度）
    lookahead: 0.30,  // 预排时间（秒）
    tickMs: 100       // 调度器检查间隔
  };
  var trackSwitchSeq = 0;   // 热切换序列号（防止旧定时器覆盖新切换）

  // 建立曲目运行状态：轨道总线 + 音色辅助节点
  function setupTrack(id) {
    var def = trackRegistry[id] || trackRegistry.bamboo;
    var bus = ctx.createGain();
    bus.gain.value = def.busGain || 1;
    bus.connect(musicGain);
    var state = {
      id: def.id,
      bus: bus,
      bpm: def.bpm,
      barDur: 60 / def.bpm * 4,   // 一小节（4拍）时长
      stepDur: 60 / def.bpm / 2,  // 一个八分音符时长
      gen: def.gen
    };
    if (def.setup) def.setup(ctx, state);
    music.state = state;
    currentTrackId = def.id;
  }

  function teardownTrack() {
    if (music.state) {
      try { music.state.bus.disconnect(); } catch (e) { /* 忽略 */ }
      music.state = null;
    }
  }

  // 确保当前曲目已被建立
  function ensureTrack() {
    if (music.state && music.state.id === currentTrackId) return;
    teardownTrack();
    setupTrack(currentTrackId);
  }

  // 调度一步：把当前步进交给对应曲目生成器
  function scheduleStep(step, t) {
    var st = music.state;
    if (!st) return;
    st.gen(st, step, t);
  }

  // 启动前瞻调度器（lookahead scheduling）
  function startScheduler() {
    if (music.timer) return;
    music.timer = setInterval(function () {
      try {
        if (!music.playing || !ctx) return;
        var horizon = ctx.currentTime + music.lookahead;
        while (music.nextTime < horizon) {
          scheduleStep(music.step, music.nextTime);
          music.step++;
          music.nextTime += music.state.stepDur;
        }
      } catch (e) { /* 忽略单次调度异常 */ }
    }, music.tickMs);
  }

  // 开始循环播放背景音乐
  function playMusic() {
    if (!musicEnabled) return;
    if (!ctx) unlock();
    if (!ctx) return;
    if (music.playing) return;
    ensureTrack();
    music.playing = true;
    music.step = 0;
    music.nextTime = ctx.currentTime + 0.08;
    startScheduler();
    rampMusicTo(0.15 * musicVolume, 0.8);   // 缓入
  }

  // 停止背景音乐（主增益快速淡出，调度器停摆）
  function stopMusic() {
    music.playing = false;
    if (music.timer) {
      clearInterval(music.timer);
      music.timer = null;
    }
    rampMusicTo(0, 0.25);
  }

  // 切换曲目：播放中则 渐弱 -> 换曲 -> 渐强 热切换
  function setTrack(id) {
    if (!trackRegistry[id] || id === currentTrackId) return;
    var seq = ++trackSwitchSeq;
    currentTrackId = id;                       // getState 立即反映新曲目
    if (music.playing && ctx && musicGain) {
      rampMusicTo(0, 0.30);
      setTimeout(function () {
        if (seq !== trackSwitchSeq) return;    // 已有更新的切换，丢弃本次
        try {
          if (!ctx) return;
          ensureTrack();
          music.step = 0;
          music.nextTime = ctx.currentTime + 0.15;
          if (music.playing) rampMusicTo(0.15 * musicVolume, 0.8);  // 渐强
        } catch (e) { /* 忽略 */ }
      }, 360);
    } else if (ctx) {
      ensureTrack();                           // 未播放：直接准备新曲目
    }
  }

  // 音乐音量 0..1（主增益 = 0.15 * volume，恒 ≤ 0.15）
  function setMusicVolume(v) {
    v = Math.max(0, Math.min(1, Number(v) || 0));
    musicVolume = v;
    if (ctx && musicGain && music.playing) rampMusicTo(0.15 * v, 0.15);
  }

  // 音乐开关：关闭时停止
  function setMusicEnabled(b) {
    musicEnabled = !!b;
    if (!musicEnabled) stopMusic();
  }

  // 当前状态快照
  function getState() {
    return {
      soundEnabled: soundEnabled,
      musicEnabled: musicEnabled,
      trackId: currentTrackId,
      volume: musicVolume
    };
  }


  /* ================= 公开接口（全部 try/catch 保护） ================= */

  // 包装器：任何公开方法内部异常都不外抛
  function safe(fn) {
    return function () {
      try { return fn.apply(null, arguments); }
      catch (e) { return undefined; }
    };
  }

  global.GameAudio = {
    unlock:          safe(unlock),
    play:            safe(play),
    setSoundEnabled: safe(function (b) { soundEnabled = !!b; }),
    musicTracks:     musicTracks,
    setTrack:        safe(setTrack),
    playMusic:       safe(playMusic),
    stopMusic:       safe(stopMusic),
    setMusicVolume:  safe(setMusicVolume),
    setMusicEnabled: safe(setMusicEnabled),
    getState:        safe(getState)
  };

})(typeof window !== 'undefined' ? window : this);
