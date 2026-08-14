/*
 * ============================================================
 *  落子无悔 · 动漫风 SVG 头像生成器
 *  ------------------------------------------------------------
 *  经典浏览器脚本（非 ES 模块），挂载到 window.Avatars：
 *
 *    Avatars.player(expr)  → 返回「棋友」的完整 SVG 字符串
 *    Avatars.ai(expr)      → 返回「柯洁老师」的完整 SVG 字符串
 *
 *  expr ∈ 'normal' | 'happy' | 'think' | 'surprised' | 'serious' | 'sad'
 *
 *  用法：
 *    document.getElementById('player-box').innerHTML = Avatars.player('normal');
 *    document.getElementById('ai-box').innerHTML      = Avatars.ai('happy');
 *
 *  设计要点：
 *    - 统一动漫风：大而有神的眼睛、赛璐璐平涂 + 少量阴影、柔和圆润线条、
 *      健康肤色、腮红点缀；胸像构图（头 + 肩），背景透明；
 *    - 不依赖外部资源：无 <text> / <image> / <use>，仅内部 defs 渐变与
 *      基础图形，可直接 innerHTML 到 <div> 显示（viewBox 200×200，
 *      尺寸交给外层 CSS 控制）。
 *    - 结构：每个角色一个「头部基础」函数（脸型/头发/肩颈），表情函数
 *      返回「眉毛组 + 眼睛组 + 嘴巴组 + 装饰组」片段后拼装。
 * ============================================================
 */
(function (global) {
  'use strict';

  /* ================= 公共定义 ================= */

  // 完整 SVG 包裹（根元素按需求固定写法）
  function svgWrap(inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' + inner + '</svg>';
  }

  // 内部渐变定义（无任何外部引用）
  var DEFS =
    // 皮肤：健康肤色，自上而下的柔和渐变
    '<linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#fff1e1"/><stop offset="1" stop-color="#fbdbc0"/>' +
    '</linearGradient>' +
    // 颈部阴影渐变
    '<linearGradient id="neckGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f8d6b6"/><stop offset="1" stop-color="#eec49f"/>' +
    '</linearGradient>' +
    // 棋友发色：深棕（微卷中短发）
    '<linearGradient id="playerHairGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#7b5434"/><stop offset="1" stop-color="#4a2e1a"/>' +
    '</linearGradient>' +
    // 柯洁老师发色：黑色（利落短发）
    '<linearGradient id="aiHairGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#3e3e49"/><stop offset="1" stop-color="#1c1c23"/>' +
    '</linearGradient>' +
    // 虹膜：棋友为暖棕（温柔），柯洁老师为冷灰蓝（专注）
    '<radialGradient id="irisWarm" cx="0.4" cy="0.35" r="0.95">' +
      '<stop offset="0" stop-color="#8d5d37"/><stop offset="0.55" stop-color="#6c4023"/><stop offset="1" stop-color="#3d2313"/>' +
    '</radialGradient>' +
    '<radialGradient id="irisCool" cx="0.4" cy="0.35" r="0.95">' +
      '<stop offset="0" stop-color="#5d6c84"/><stop offset="0.55" stop-color="#3b4a61"/><stop offset="1" stop-color="#1f2530"/>' +
    '</radialGradient>' +
    // 米色针织衫
    '<linearGradient id="bodyPlayer" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f3e6cc"/><stop offset="1" stop-color="#ddc69f"/>' +
    '</linearGradient>' +
    // 深色西装马甲
    '<linearGradient id="vestGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#39404e"/><stop offset="1" stop-color="#262b37"/>' +
    '</linearGradient>' +
    // 白衬衫
    '<linearGradient id="shirtGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e7ecf2"/>' +
    '</linearGradient>';

  /* ================= 角色风格参数 ================= */

  // 「棋友」：温柔下垂眼（外眼角低垂）、暖棕虹膜、暖调腮红
  var PLAYER = {
    kind: 'player',
    eyeX1: 76, eyeX2: 124, eyeY: 88,      // 双眼中心坐标
    lashMode: 'droop', outerDrop: 4,      // 下垂眼：外眼角下压
    lash: '#3a2a22',                      // 上眼睑线颜色
    lowerLid: '#dfb089',                  // 下眼睑颜色
    iris: 'url(#irisWarm)',
    blush: '#ff9d8a'
  };

  // 「柯洁老师」：利落偏直眼（外眼角微扬）、冷灰蓝虹膜、圆框眼镜（单独叠加）
  var AI = {
    kind: 'ai',
    eyeX1: 76, eyeX2: 124, eyeY: 88,
    lashMode: 'sharp', outerDrop: -1,     // 微吊梢：外眼角略上提，更利落自信
    lash: '#26262e',
    lowerLid: '#e0b48f',
    iris: 'url(#irisCool)',
    blush: '#ffa38f'
  };

  /* ================= 眼睛（按表情） ================= */

  // 睁眼：眼白 + 上眼睑（下垂/平直/微扬三态）+ 虹膜 + 瞳孔 + 高光 + 下眼睑
  function eyeOpen(st, cx, dx, dy) {
    dx = dx || 1; dy = dy || 3;
    var r = 12.5;
    var side = cx < 100 ? -1 : 1;         // 左眼 -1 / 右眼 +1
    var inner = cx - side * r;            // 靠鼻侧端点
    var outer = cx + side * r;            // 靠耳侧端点
    var cy = st.eyeY;
    var topO, topI, botO, botI;
    if (st.lashMode === 'flat') {         // serious：平直专注
      topO = cy - 4; topI = cy - 4; botO = cy - 1; botI = cy - 1;
    } else {                              // droop / sharp
      topO = cy + st.outerDrop + 1; topI = cy - 5;
      botO = cy + st.outerDrop + 4; botI = cy - 1;
    }
    var irisX = cx + dx, irisY = cy + dy;
    return [
      // 眼白
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="12.5" ry="13" fill="#fff"/>',
      // 上眼睑线（月牙形平涂）
      '<path d="M' + outer + ' ' + topO + ' Q' + cx + ' ' + (cy - 10) + ' ' + inner + ' ' + topI +
        ' L' + inner + ' ' + botI + ' Q' + cx + ' ' + (cy - 4) + ' ' + outer + ' ' + botO + ' Z" fill="' + st.lash + '"/>',
      // 虹膜 / 瞳孔
      '<circle cx="' + irisX + '" cy="' + irisY + '" r="7.6" fill="' + st.iris + '"/>',
      '<circle cx="' + irisX + '" cy="' + (irisY + 1) + '" r="3.4" fill="#241a12"/>',
      // 双高光（大而有神的关键）
      '<circle cx="' + (irisX - 2.8) + '" cy="' + (irisY - 2.8) + '" r="2.6" fill="#fff" opacity="0.95"/>',
      '<circle cx="' + (irisX + 2.8) + '" cy="' + (irisY + 2.4) + '" r="1.3" fill="#fff" opacity="0.85"/>',
      // 下眼睑细线
      '<path d="M' + (outer + 1) + ' ' + (cy + st.outerDrop + 6) + ' Q' + cx + ' ' + (cy + 9.5) + ' ' + (inner - 1) + ' ' + (cy + 5) +
        '" stroke="' + st.lowerLid + '" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
    ].join('');
  }

  // 弯月眼（happy）：两端上翘、中段下弯的闭眼弧线
  function eyeHappy(st, cx) {
    var side = cx < 100 ? -1 : 1;
    var inner = cx - side * 11, outer = cx + side * 11;
    var cy = st.eyeY;
    return '<path d="M' + outer + ' ' + (cy - 4) + ' Q' + cx + ' ' + (cy + 7) + ' ' + inner + ' ' + (cy - 6) +
      '" stroke="' + st.lash + '" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M' + (outer + 2) + ' ' + (cy - 1) + ' Q' + cx + ' ' + (cy + 4) + ' ' + (inner - 2) + ' ' + (cy - 2) +
      '" stroke="' + st.lowerLid + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
  }

  // 圆睁大眼（surprised）：更大眼白 + 更小上睑 + 大虹膜
  function eyeWide(st, cx) {
    var side = cx < 100 ? -1 : 1;
    var inner = cx - side * 14, outer = cx + side * 14;
    var cy = st.eyeY;
    return [
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="14" ry="14.5" fill="#fff"/>',
      '<path d="M' + outer + ' ' + (cy - 2) + ' Q' + cx + ' ' + (cy - 12) + ' ' + inner + ' ' + (cy - 3) +
        '" stroke="' + st.lash + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
      '<circle cx="' + cx + '" cy="' + (cy + 1) + '" r="9" fill="' + st.iris + '"/>',
      '<circle cx="' + cx + '" cy="' + (cy + 2) + '" r="4.2" fill="#241a12"/>',
      '<circle cx="' + (cx - 3) + '" cy="' + (cy - 2.5) + '" r="3.1" fill="#fff" opacity="0.95"/>',
      '<circle cx="' + (cx + 4) + '" cy="' + (cy + 4.5) + '" r="1.5" fill="#fff" opacity="0.85"/>'
    ].join('');
  }

  // 下垂眼（sad）：外眼角明显垂落 + 半掩的虹膜
  function eyeSad(st, cx) {
    var side = cx < 100 ? -1 : 1;
    var inner = cx - side * 12, outer = cx + side * 12;
    var cy = st.eyeY;
    return [
      '<ellipse cx="' + cx + '" cy="' + (cy + 1) + '" rx="12" ry="12" fill="#fff"/>',
      '<path d="M' + outer + ' ' + (cy + 5) + ' Q' + cx + ' ' + (cy - 7) + ' ' + inner + ' ' + (cy - 5) +
        ' L' + inner + ' ' + (cy - 2) + ' Q' + cx + ' ' + (cy - 3) + ' ' + outer + ' ' + (cy + 8) + ' Z" fill="' + st.lash + '"/>',
      '<circle cx="' + (cx + 1) + '" cy="' + (cy + 4) + '" r="6.8" fill="' + st.iris + '"/>',
      '<circle cx="' + (cx + 1) + '" cy="' + (cy + 5) + '" r="3" fill="#241a12"/>',
      '<circle cx="' + (cx - 1.5) + '" cy="' + (cy + 1) + '" r="2.3" fill="#fff" opacity="0.9"/>',
      '<path d="M' + (outer + 2) + ' ' + (cy + 10) + ' Q' + cx + ' ' + (cy + 7) + ' ' + (inner - 2) + ' ' + (cy - 1) +
        '" stroke="' + st.lowerLid + '" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
    ].join('');
  }

  // serious：平直眼（复用睁眼 + 平直上睑样式）
  function flatStyle(st) {
    return {
      kind: st.kind, eyeX1: st.eyeX1, eyeX2: st.eyeX2, eyeY: st.eyeY,
      lashMode: 'flat', outerDrop: 0,
      lash: st.lash, lowerLid: st.lowerLid, iris: st.iris, blush: st.blush
    };
  }

  // 表情 → 眼睛函数映射（think 用睁眼并把虹膜移到右上方，即「看向侧上方」）
  var EYE_FNS = {
    normal:    function (st, cx) { return eyeOpen(st, cx, 1, 3); },
    happy:     eyeHappy,
    think:     function (st, cx) { return eyeOpen(st, cx, 4.5, -4.5); },
    surprised: eyeWide,
    serious:   function (st, cx) { return eyeOpen(st, cx, 0, 2); },
    sad:       eyeSad
  };

  function eyesFor(name, st) {
    var s = (name === 'serious') ? flatStyle(st) : st;
    var fn = EYE_FNS[name] || EYE_FNS.normal;
    return fn(s, s.eyeX1) + fn(s, s.eyeX2);
  }

  /* ================= 眉毛（按角色 + 表情） ================= */

  // 棋友：柔和的弧形眉（细软、弯度自然，配合温柔下垂眼）
  function playerBrows(expr) {
    var c = '#4a3322', w = 3.2;
    var map = {
      normal:    'M64 78 Q76 73 88 77|M112 77 Q124 73 136 78',
      happy:     'M64 74 Q76 68 88 72|M112 72 Q124 68 136 74',
      think:     'M64 76 Q76 74 88 79|M112 79 Q124 74 136 76',   // 微皱：内端稍低
      surprised: 'M64 71 Q76 64 88 70|M112 70 Q124 64 136 71',
      serious:   'M64 76 L88 76|M112 76 L136 76',                // 平眉
      sad:       'M64 82 Q76 75 88 71|M112 71 Q124 75 136 82'    // 八字眉：外端垂、内端扬
    };
    var d = map[expr] || map.normal;
    var parts = d.split('|');
    return '<path d="' + parts[0] + '" stroke="' + c + '" stroke-width="' + w + '" fill="none" stroke-linecap="round"/>' +
           '<path d="' + parts[1] + '" stroke="' + c + '" stroke-width="' + w + '" fill="none" stroke-linecap="round"/>';
  }

  // 柯洁老师：剑眉（折线眉，眉头低、眉梢上扬，利落自信）
  function aiBrows(expr) {
    var c = '#2c2c34', w = 3.4;
    var map = {
      normal:    'M64 68 L76 71 L86 75|M136 68 L124 71 L114 75',
      happy:     'M64 64 L76 67 L86 71|M136 64 L124 67 L114 71',
      think:     'M64 70 L76 72 L86 77|M136 70 L124 72 L114 77', // 微皱：内端稍低
      surprised: 'M64 62 L76 64 L86 68|M136 62 L124 64 L114 68',
      serious:   'M64 72 L86 72|M114 72 L136 72',                // 平眉
      sad:       'M64 80 L76 75 L86 71|M136 80 L124 75 L114 71'  // 八字眉
    };
    var d = map[expr] || map.normal;
    var parts = d.split('|');
    return '<path d="' + parts[0] + '" stroke="' + c + '" stroke-width="' + w + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
           '<path d="' + parts[1] + '" stroke="' + c + '" stroke-width="' + w + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  /* ================= 嘴巴（按角色 + 表情） ================= */

  // 棋友：招牌温暖微笑 / 露齿笑 / 抿嘴 / O形嘴 / 平直 / 小嘴
  function playerMouth(expr) {
    switch (expr) {
      case 'happy':
        // 露齿笑：深色口腔 + 上方白色牙齿弧带
        return '<path d="M86 109 Q100 125 114 109 Q100 121 86 109 Z" fill="#93392e"/>' +
               '<path d="M89 110.5 Q100 117.5 111 110.5 Q100 115.5 89 110.5 Z" fill="#ffffff"/>';
      case 'think':
        // 抿嘴：细短、微抿
        return '<path d="M93 112 Q100 114 107 112" stroke="#b0594b" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
      case 'surprised':
        // O 形嘴
        return '<ellipse cx="100" cy="114" rx="5.5" ry="7" fill="#93392e"/>' +
               '<ellipse cx="100" cy="113" rx="3.6" ry="4.8" fill="#6e2b22"/>';
      case 'serious':
        // 嘴角平直
        return '<path d="M92 113 L108 113" stroke="#b0594b" stroke-width="2.6" stroke-linecap="round"/>';
      case 'sad':
        // 小嘴，微微下撇
        return '<path d="M95 113.5 Q100 111.5 105 113.5" stroke="#b0594b" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
      default:
        // normal：温暖微笑（上唇弧线 + 轻微下唇阴影）
        return '<path d="M88 111 Q100 119.5 112 111" stroke="#b0594b" stroke-width="2.8" fill="none" stroke-linecap="round"/>' +
               '<path d="M90 117.5 Q100 122.5 110 117.5" stroke="#e89b80" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.6"/>';
    }
  }

  // 柯洁老师：更小更收敛的嘴巴（少年自信感，幅度比棋友略小）
  function aiMouth(expr) {
    switch (expr) {
      case 'happy':
        return '<path d="M87 109 Q100 124 113 109 Q100 120 87 109 Z" fill="#93392e"/>' +
               '<path d="M90 110.5 Q100 116.5 110 110.5 Q100 114.5 90 110.5 Z" fill="#ffffff"/>';
      case 'think':
        return '<path d="M94 112 Q100 113.5 106 112" stroke="#c0674f" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
      case 'surprised':
        return '<ellipse cx="100" cy="114" rx="5.2" ry="6.6" fill="#93392e"/>' +
               '<ellipse cx="100" cy="113" rx="3.4" ry="4.5" fill="#6e2b22"/>';
      case 'serious':
        return '<path d="M93 113 L107 113" stroke="#c0674f" stroke-width="2.5" stroke-linecap="round"/>';
      case 'sad':
        return '<path d="M96 113.5 Q100 111.5 104 113.5" stroke="#c0674f" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
      default:
        return '<path d="M92 111 Q100 116.5 108 111" stroke="#c0674f" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    }
  }

  /* ================= 装饰（腮红 / 汗滴 / 思考点 / 闪光） ================= */

  // 四角小闪光
  function sparkle(x, y, s) {
    var k = s * 0.28;
    return '<path d="M' + x + ' ' + (y - s) +
      ' L' + (x + k) + ' ' + (y - k) +
      ' L' + (x + s) + ' ' + y +
      ' L' + (x + k) + ' ' + (y + k) +
      ' L' + x + ' ' + (y + s) +
      ' L' + (x - k) + ' ' + (y + k) +
      ' L' + (x - s) + ' ' + y +
      ' L' + (x - k) + ' ' + (y - k) + ' Z" fill="#ffd76a"/>';
  }

  // 表情装饰组：腮红强度随表情变化 + 专属小道具
  function decorate(expr, st) {
    var op, r;
    switch (expr) {
      case 'happy':     op = 0.55; r = 8.5; break;  // 明显腮红
      case 'think':     op = 0.32; r = 7;   break;
      case 'surprised': op = 0.28; r = 7;   break;
      case 'serious':   op = 0.20; r = 6.5; break;
      case 'sad':       op = 0.26; r = 7;   break;
      default:          op = 0.28; r = 7;   break;  // normal：自然淡腮红
    }
    var ry = (r * 0.55).toFixed(1);
    var out = [];
    // 双颊腮红
    out.push(
      '<ellipse cx="' + (st.eyeX1 - 14) + '" cy="' + (st.eyeY + 12) + '" rx="' + r + '" ry="' + ry + '" fill="' + st.blush + '" opacity="' + op + '"/>',
      '<ellipse cx="' + (st.eyeX2 + 14) + '" cy="' + (st.eyeY + 12) + '" rx="' + r + '" ry="' + ry + '" fill="' + st.blush + '" opacity="' + op + '"/>'
    );
    if (expr === 'think') {
      // 头顶小圆点装饰（思考气泡感：一大两小）
      out.push(
        '<circle cx="118" cy="6" r="4.5" fill="#8fa3b8"/>',
        '<circle cx="131" cy="13" r="2.4" fill="#b0bfcd"/>',
        '<circle cx="139" cy="21" r="1.6" fill="#c6d2dc"/>'
      );
    }
    if (expr === 'surprised') {
      // 汗滴（右太阳穴）
      out.push(
        '<path d="M150 54 C157 66 159 74 152.5 79 C146 84 140 75 142.5 65 C143.5 59 146.5 56 150 54 Z" fill="#a9dcf6" stroke="#7cc0ea" stroke-width="1"/>',
        '<path d="M147 61 Q148 63 149 62" stroke="#eaf7ff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.9"/>'
      );
    }
    if (expr === 'happy') {
      // 两侧小闪光，强化开心氛围
      out.push(sparkle(157, 80, 6), sparkle(43, 82, 5));
    }
    return out.join('');
  }

  /* ================= 头部基础：棋友 ================= */

  function playerBase() {
    return [
      '<!-- 肩部·米色针织衫（休闲绅士感） -->',
      '<path d="M38 200 C40 174 50 152 76 144 L124 144 C150 152 160 174 162 200 Z" fill="url(#bodyPlayer)"/>',
      '<!-- 圆领针织领口 -->',
      '<path d="M82 138 Q100 153 118 138 L118 146 Q100 159 82 146 Z" fill="#ead6b4" stroke="#d9c097" stroke-width="1.2"/>',
      '<path d="M82 138 Q100 153 118 138 Q100 147 82 138 Z" fill="#c9ae82" opacity="0.6"/>',
      '<!-- 针织肌理细线 -->',
      '<path d="M48 176 Q100 186 152 176" stroke="#c9ad7f" stroke-width="1.2" fill="none" opacity="0.45"/>',
      '<path d="M45 191 Q100 200 155 191" stroke="#c9ad7f" stroke-width="1.2" fill="none" opacity="0.45"/>',
      '<!-- 颈部 + 下巴阴影 -->',
      '<path d="M89 116 L111 116 L111 144 L89 144 Z" fill="url(#neckGrad)"/>',
      '<path d="M92 132 Q100 140 108 132 L108 136 Q100 144 92 136 Z" fill="#e0b48c" opacity="0.5"/>',
      '<!-- 耳朵（先画，便于头发覆盖上部） -->',
      '<ellipse cx="52" cy="97" rx="7" ry="11" fill="#f9d3b4"/>',
      '<ellipse cx="148" cy="97" rx="7" ry="11" fill="#f9d3b4"/>',
      '<path d="M52 95 Q52 101 56 103" stroke="#e0a77e" stroke-width="1" fill="none"/>',
      '<path d="M148 95 Q148 101 144 103" stroke="#e0a77e" stroke-width="1" fill="none"/>',
      '<!-- 脸型：偏长、下颌线条柔润 -->',
      '<path d="M100 30 C130 30 146 52 146 84 C146 108 132 130 112 136 Q100 140 100 140 Q100 140 88 136 C68 130 54 108 54 84 C54 52 70 30 100 30 Z" fill="url(#skinGrad)"/>',
      '<!-- 头发：深棕微卷中短发（顶部主体 + 波浪刘海 + 两侧卷发） -->',
      '<path d="M100 10 C136 10 152 38 148 68 C146 82 141 92 133 97 C131 88 128 80 124 75 C120 84 113 90 106 92 C107 84 105 76 100 72 C95 76 93 84 94 92 C87 90 80 84 76 75 C72 80 69 88 67 97 C59 92 54 82 52 68 C51 40 68 12 100 10 Z" fill="url(#playerHairGrad)"/>',
      '<!-- 右侧鬓角卷发 -->',
      '<path d="M136 96 C140 104 140 112 136 118 C132 124 123 122 121 115 C119 108 123 101 129 99 C127 105 128 109 132 109 C135 105 136 100 136 96 Z" fill="url(#playerHairGrad)"/>',
      '<!-- 左侧鬓角卷发 -->',
      '<path d="M64 96 C60 104 60 112 64 118 C68 124 77 122 79 115 C81 108 77 101 71 99 C73 105 72 109 68 109 C65 105 64 100 64 96 Z" fill="url(#playerHairGrad)"/>',
      '<!-- 鼻子：简洁一笔 -->',
      '<path d="M100 96 Q103 101 100 103" stroke="#e4b08c" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
    ].join('\n');
  }

  /* ================= 头部基础：柯洁老师 ================= */

  function aiBase() {
    return [
      '<!-- 肩部·深色西装马甲 -->',
      '<path d="M38 200 C40 172 50 150 76 142 L124 142 C150 150 160 172 162 200 Z" fill="url(#vestGrad)"/>',
      '<!-- 马甲 V 领开口处露出的白衬衫 -->',
      '<path d="M86 136 L100 158 L114 136 Q112 130 100 129 Q88 130 86 136 Z" fill="url(#shirtGrad)"/>',
      '<!-- 衬衫领尖 -->',
      '<path d="M91 135 L100 147 L87 137 Z" fill="#ffffff" stroke="#d8dee6" stroke-width="0.8"/>',
      '<path d="M109 135 L100 147 L113 137 Z" fill="#ffffff" stroke="#d8dee6" stroke-width="0.8"/>',
      '<!-- 马甲纽扣 -->',
      '<circle cx="100" cy="164" r="2.2" fill="#191d24"/>',
      '<circle cx="100" cy="178" r="2.2" fill="#191d24"/>',
      '<circle cx="100" cy="192" r="2.2" fill="#191d24"/>',
      '<!-- 颈部 + 下巴阴影 -->',
      '<path d="M89 116 L111 116 L111 144 L89 144 Z" fill="url(#neckGrad)"/>',
      '<path d="M92 132 Q100 140 108 132 L108 136 Q100 144 92 136 Z" fill="#e0b48c" opacity="0.5"/>',
      '<!-- 耳朵 -->',
      '<ellipse cx="53" cy="95" rx="6.5" ry="10" fill="#f9d3b4"/>',
      '<ellipse cx="147" cy="95" rx="6.5" ry="10" fill="#f9d3b4"/>',
      '<path d="M53 93 Q53 99 57 101" stroke="#e0a77e" stroke-width="1" fill="none"/>',
      '<path d="M147 93 Q147 99 143 101" stroke="#e0a77e" stroke-width="1" fill="none"/>',
      '<!-- 脸型：圆润利落、少年感 -->',
      '<path d="M100 32 C128 32 143 53 143 84 C143 106 129 124 111 130 Q100 133 100 133 Q100 133 89 130 C71 124 57 106 57 84 C57 53 72 32 100 32 Z" fill="url(#skinGrad)"/>',
      '<!-- 头发：黑色利落短发（顶部主体） -->',
      '<path d="M100 10 C132 10 149 36 146 66 C144 80 139 90 131 96 C128 88 126 80 122 75 C118 84 112 90 104 92 C106 84 104 76 99 72 C93 78 86 83 78 85 C80 77 78 70 72 66 C64 72 56 76 53 70 C50 46 66 14 100 10 Z" fill="url(#aiHairGrad)"/>',
      '<!-- 利落斜刘海 -->',
      '<path d="M58 56 C64 44 80 34 100 35 C116 33 132 40 142 52 C136 50 128 46 122 44 C118 52 109 56 101 56 C93 56 86 52 81 46 C74 50 66 54 58 56 Z" fill="url(#aiHairGrad)"/>',
      '<!-- 鼻子：简洁一笔 -->',
      '<path d="M100 95 L100 100" stroke="#e0ab86" stroke-width="1.5" stroke-linecap="round"/>'
    ].join('\n');
  }

  // 圆框眼镜：覆盖在眼睛之上（柯洁老师的标志性单品）
  function aiGlasses() {
    return [
      '<!-- 圆框眼镜 -->',
      '<g stroke="#3a3a46" stroke-width="2.4" fill="rgba(240,248,255,0.07)" stroke-linecap="round">',
      '  <circle cx="76" cy="88" r="15.5"/>',
      '  <circle cx="124" cy="88" r="15.5"/>',
      '  <!-- 鼻梁 -->',
      '  <path d="M91.5 86 Q100 82 108.5 86" fill="none"/>',
      '  <!-- 镜腿 -->',
      '  <path d="M60.5 86 L53 85" fill="none"/>',
      '  <path d="M139.5 86 L147 85" fill="none"/>',
      '</g>',
      '<!-- 镜片高光 -->',
      '<path d="M68.5 81 Q72 78 76 79" stroke="#ffffff" stroke-width="1.5" fill="none" opacity="0.85" stroke-linecap="round"/>',
      '<path d="M116.5 81 Q120 78 124 79" stroke="#ffffff" stroke-width="1.5" fill="none" opacity="0.85" stroke-linecap="round"/>'
    ].join('\n');
  }

  /* ================= 组装 ================= */

  // 按角色与表情拼装完整 SVG：defs → 头部基础 → 眼睛 → 眼镜(AI) → 眉毛 → 嘴巴 → 装饰
  function build(expr, kind) {
    var name = String(expr || 'normal').toLowerCase();
    if (['normal', 'happy', 'think', 'surprised', 'serious', 'sad'].indexOf(name) < 0) {
      name = 'normal'; // 未知表情回退到 normal
    }
    var st = (kind === 'ai') ? AI : PLAYER;
    var base   = (kind === 'ai') ? aiBase() : playerBase();
    var eyes   = eyesFor(name, st);
    var glasses = (kind === 'ai') ? aiGlasses() : '';
    var brows  = (kind === 'ai') ? aiBrows(name) : playerBrows(name);
    var mouth  = (kind === 'ai') ? aiMouth(name) : playerMouth(name);
    var deco   = decorate(name, st);
    return svgWrap(
      '<defs>' + DEFS + '</defs>' +
      base + eyes + glasses + brows + mouth + deco
    );
  }

  /* ================= 导出 ================= */

  global.Avatars = {
    // expr ∈ 'normal' | 'happy' | 'think' | 'surprised' | 'serious' | 'sad'
    player: function (expr) { return build(expr, 'player'); },
    ai:     function (expr) { return build(expr, 'ai'); }
  };
})(window);
