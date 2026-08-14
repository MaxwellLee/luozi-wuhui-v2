/* =============================================================
 * 《落子无悔 V2》· 烟花庆祝（Canvas 粒子）
 * ============================================================= */
(function (g) {
  'use strict';
  function show(durationMs) {
    if (typeof document === 'undefined') return;
    var canvas = document.getElementById('fw-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'fw-canvas';
      canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:95;';
      document.body.appendChild(canvas);
    }
    var ctx = canvas.getContext('2d');
    var W = window.innerWidth || 1280, H = window.innerHeight || 800;
    canvas.width = W; canvas.height = H;
    var parts = [];
    var colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9f43', '#f368e0', '#a29bfe', '#7bed9f'];
    function launch() {
      var x = W * (0.12 + Math.random() * 0.76);
      var y = H * (0.12 + Math.random() * 0.5);
      var n = 40 + ((Math.random() * 40) | 0);
      var color = colors[(Math.random() * colors.length) | 0];
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var v = 1.5 + Math.random() * 4.5;
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 1, decay: 0.008 + Math.random() * 0.012, color: color, r: 1.2 + Math.random() * 1.8 });
      }
    }
    var timer = setInterval(launch, 380);
    for (var k = 0; k < 3; k++) setTimeout(launch, k * 120);
    var start = Date.now();
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= p.decay;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (Date.now() - start < (durationMs || 6000) || parts.length) raf(frame);
      else { clearInterval(timer); ctx.clearRect(0, 0, W, H); }
    }
    frame();
  }
  g.Fireworks = { show: show };
})(typeof window !== 'undefined' ? window : globalThis);
