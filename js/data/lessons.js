/* =============================================================
 * 《落子无悔》· 围棋课堂内容（5 节互动规则课）
 * step 类型：info 图文 / board 演示（moves 自动播放）/ try 任务 /
 *           mark 标记死子任务 / quiz 测验
 * task.check(ctx)：ctx = {pos, i, R, marked}
 * ============================================================= */
(function (g) {
  'use strict';
  var GREEN = '#2e9e5b', RED = '#d64545', BLUE = '#2b6cb0';
  g.GO_LESSONS = {
    units: [
      /* ================= 第一课 ================= */
      {
        id: 'u1', icon: '壹', title: '棋盘与棋子', desc: '认识棋盘、交叉点、星位与天元，落下一手棋',
        steps: [
          {
            type: 'info', title: '棋盘长什么样',
            html: '<p>围棋棋盘由纵横各 19 条线组成，共 <strong>361 个交叉点</strong>；初学者常用更小的 <strong>9 路棋盘</strong>（81 个交叉点），本游戏默认就是 9 路。</p>' +
              '<ul><li>棋子要下在<strong>线的交叉点</strong>上，不是下在格子里；</li>' +
              '<li>棋子落下后不能移动（所以才有「落子无悔」）；</li>' +
              '<li>执<strong>黑者先行</strong>，双方轮流各下一手。</li></ul>' +
              '<p class="tip">棋盘上有 9 个加粗的点叫「星位」，正中间的叫「天元」。它们只是标记位置，方便你认路。</p>'
          },
          {
            type: 'board', title: '认识星位与天元', size: 9,
            setup: [
              { x: 2, y: 2, c: 0, mark: 'circle', markColor: RED },
              { x: 6, y: 2, c: 0, mark: 'circle', markColor: RED },
              { x: 2, y: 6, c: 0, mark: 'circle', markColor: RED },
              { x: 6, y: 6, c: 0, mark: 'circle', markColor: RED },
              { x: 4, y: 4, c: 0, mark: 'label', label: '天', markColor: RED }
            ],
            note: '红色圆圈标出的就是 9 路棋盘的四个「星位」，正中间标「天」的是「天元」。观察一下：棋子都下在交叉点上。'
          },
          {
            type: 'try', title: '试试落一子', size: 7, setup: [],
            task: {
              goal: '在棋盘任意交叉点落下一枚黑棋',
              tip: '点击棋盘上任意一个交叉点即可。',
              answer: { x: 3, y: 3 },
              check: function (ctx) { return true; },
              success: '没错，棋子就下在交叉点上！'
            }
          },
          {
            type: 'quiz', title: '小测验',
            quiz: {
              q: '围棋的棋子应该下在哪里？',
              options: [
                { t: 'A. 方格的中间', ok: false },
                { t: 'B. 线的交叉点上', ok: true },
                { t: 'C. 棋盘外面的桌子上', ok: false }
              ],
              explain: '棋子必须下在纵横线的交叉点上，棋盘上共有 361 个（19 路）交叉点。'
            }
          }
        ]
      },
      /* ================= 第二课 ================= */
      {
        id: 'u2', icon: '贰', title: '气与提子', desc: '围棋的命脉是「气」：学会数气、打吃与提子',
        steps: [
          {
            type: 'info', title: '什么是「气」',
            html: '<p>棋子相邻的<strong>空交叉点</strong>就是它的「气」：</p>' +
              '<ul><li>棋盘<strong>中央</strong>一子有 <strong>4 口气</strong>（上下左右）；</li>' +
              '<li><strong>边上</strong>一子有 <strong>3 口气</strong>；</li>' +
              '<li><strong>角上</strong>一子只有 <strong>2 口气</strong>。</li></ul>' +
              '<p>同色的棋子连在一起算「一块棋」，共用它们的气。<strong>气被对方全部堵住，棋子就会被提走</strong>。</p>' +
              '<p class="tip">「打吃」＝让对方只剩最后一口气，下一步就能提掉它。被「打吃」时通常要马上逃跑（长气）。</p>'
          },
          {
            type: 'board', title: '数一数气', size: 7,
            setup: [
              { x: 3, y: 3, c: 2 },
              { x: 1, y: 0, c: 2 },
              { x: 6, y: 6, c: 2 },
              { x: 2, y: 3, c: 0, mark: 'circle', markColor: GREEN },
              { x: 4, y: 3, c: 0, mark: 'circle', markColor: GREEN },
              { x: 3, y: 2, c: 0, mark: 'circle', markColor: GREEN },
              { x: 3, y: 4, c: 0, mark: 'circle', markColor: GREEN },
              { x: 0, y: 0, c: 0, mark: 'circle', markColor: GREEN },
              { x: 2, y: 0, c: 0, mark: 'circle', markColor: GREEN },
              { x: 1, y: 1, c: 0, mark: 'circle', markColor: GREEN },
              { x: 5, y: 6, c: 0, mark: 'circle', markColor: GREEN },
              { x: 6, y: 5, c: 0, mark: 'circle', markColor: GREEN }
            ],
            note: '绿色圆圈就是每颗白棋的「气」：中间一子 4 气、边上一子 3 气、角上一子 2 气。'
          },
          {
            type: 'info', title: '提子',
            html: '<p>当一块棋的<strong>最后一口气</strong>被对方堵住，这块棋就「死」了，要立刻从棋盘上<strong>提走</strong>，这些被提的子归对方所有。</p>' +
              '<p class="tip">提子最直观的好处：棋盘上少了对方的子，多了自己的空。下一关你来亲手提一次！</p>'
          },
          {
            type: 'try', title: '任务：提掉白棋', size: 7,
            setup: [
              { x: 3, y: 3, c: 2, mark: 'circle', markColor: RED },
              { x: 3, y: 2, c: 1 },
              { x: 4, y: 3, c: 1 },
              { x: 3, y: 4, c: 1 }
            ],
            task: {
              goal: '吃掉被黑棋三面包围的白棋',
              tip: '白棋只剩左边一口气——数一数它的气，堵上最后一口气！',
              answer: { x: 2, y: 3 },
              check: function (ctx) { return ctx.pos.captured > 0; },
              success: '漂亮！白棋没有气了，被提掉——这就是「提子」。'
            }
          },
          {
            type: 'try', title: '任务：打吃白棋', size: 7,
            setup: [
              { x: 3, y: 3, c: 2, mark: 'circle', markColor: RED },
              { x: 4, y: 3, c: 2, mark: 'circle', markColor: RED },
              { x: 3, y: 4, c: 1 },
              { x: 4, y: 4, c: 1 },
              { x: 3, y: 2, c: 1 },
              { x: 5, y: 3, c: 1 }
            ],
            task: {
              goal: '下出一手「打吃」：让白棋只剩一口气（但不要直接提掉）',
              tip: '白棋两子现在还剩两口气（左下与右上），堵住其中一口，让它们只剩一口气。',
              answer: { x: 4, y: 2 },
              check: function (ctx) {
                var atari = ctx.R.atariGroups(ctx.pos, 2);
                return ctx.pos.captured === 0 && atari.length > 0;
              },
              success: '对！白棋只剩一口气了，这叫「打吃」——它现在必须逃跑。'
            }
          },
          {
            type: 'quiz', title: '小测验',
            quiz: {
              q: '棋盘正中央一颗孤子，一共有几口气？',
              options: [
                { t: 'A. 2 口气', ok: false },
                { t: 'B. 3 口气', ok: false },
                { t: 'C. 4 口气', ok: true }
              ],
              explain: '中央 4 气、边上 3 气、角上 2 气——越靠边，气越少，也越危险。'
            }
          }
        ]
      },
      /* ================= 第三课 ================= */
      {
        id: 'u3', icon: '叁', title: '禁着与打劫', desc: '两个特殊规则：不能自杀，劫不能立刻回提',
        steps: [
          {
            type: 'info', title: '禁着点（不能自杀）',
            html: '<p>如果某个点落子后，<strong>自己这块棋一口气都没有，又提不掉对方的子</strong>，这个点就是「禁着点」，规则不允许下。</p>' +
              '<p>典型的禁着点：被对方棋子完全围住的空点（比如角上的 (0,0) 被白棋堵住两边）。</p>' +
              '<p class="tip">注意：如果落子能顺便提掉对方的子，那就不算自杀——因为提子后自己就有了气。</p>'
          },
          {
            type: 'try', title: '任务：找出禁着点', size: 7,
            setup: [
              { x: 0, y: 1, c: 2 },
              { x: 1, y: 0, c: 2 },
              { x: 0, y: 0, c: 0, mark: 'label', label: '?', markColor: BLUE }
            ],
            task: {
              goal: '点击那个黑棋「不能下」的禁着点',
              tip: '想想：黑棋下在哪里会一口气都没有？',
              answer: { x: 0, y: 0 },
              checkIllegal: function (ctx) { return ctx.R.checkMove(ctx.pos, ctx.i).code === 'suicide'; },
              success: '没错！这就是禁着点——落子后自己无气又不能提子。试试点别处，就能正常落子。'
            }
          },
          {
            type: 'info', title: '打劫（同形禁手）',
            html: '<p>有些局面，双方可以<strong>你提我一个、我提你一个</strong>，永远循环下去。为防止无休止循环，规则规定：</p>' +
              '<ul><li>一方提劫后，另一方<strong>不能立刻回提</strong>；</li>' +
              '<li>必须先在别处下一手（这叫「找劫材」），对方应了，才能回来提劫。</li></ul>' +
              '<p class="tip">本游戏会自动拦住立刻回提的棋，并弹出规则说明——放心下。</p>'
          },
          {
            type: 'board', title: '演示：打劫的全过程', size: 7, toMove: 2,
            setup: [
              { x: 0, y: 1, c: 1 }, { x: 1, y: 0, c: 1 }, { x: 1, y: 2, c: 1 }, { x: 2, y: 1, c: 1 },
              { x: 2, y: 0, c: 2 }, { x: 2, y: 2, c: 2 }, { x: 3, y: 1, c: 2 },
              { x: 1, y: 1, c: 0, mark: 'label', label: '劫', markColor: RED },
              { x: 2, y: 1, c: 1, mark: 'circle', markColor: BLUE }
            ],
            moves: [
              { x: 1, y: 1, c: 2, comment: '白棋提劫！此时黑棋不能立刻下 (2,1) 回提——这就是打劫。' },
              { x: 4, y: 1, c: 1, comment: '黑棋先在别处下了一手（找劫材）。' },
              { x: 3, y: 0, c: 2, comment: '白棋应了劫材。' },
              { x: 2, y: 1, c: 1, comment: '现在黑棋可以回提了，劫争告一段落。' }
            ]
          },
          {
            type: 'quiz', title: '小测验',
            quiz: {
              q: '一方提劫之后，另一方可以立刻提回来吗？',
              options: [
                { t: 'A. 可以，你提我我提你', ok: false },
                { t: 'B. 不可以，必须先在别处下一手', ok: true },
                { t: 'C. 看心情', ok: false }
              ],
              explain: '这是「打劫」规则：同形禁手。先到别处找劫材，对方应了才能回来提劫。'
            }
          }
        ]
      },
      /* ================= 第四课 ================= */
      {
        id: 'u4', icon: '肆', title: '眼与死活', desc: '做出两只眼才能活棋：死活是围棋的基本功',
        steps: [
          {
            type: 'info', title: '什么是「眼」',
            html: '<p>被自己棋子完全围住的空点，叫<strong>「眼」</strong>。对方不能直接下进你的眼里（那是禁着点），所以眼是棋的「命根子」。</p>' +
              '<ul><li>一块棋有<strong>两只或以上的真眼</strong>，就永远吃不掉，是<strong>活棋</strong>；</li>' +
              '<li>只有一只眼，对方可以先把外围气全堵上，最后一手点进眼里提掉你——是<strong>死棋</strong>。</li></ul>' +
              '<p class="tip">口诀：「两眼活棋」。下棋时时刻问自己：我的棋有眼吗？有几只眼？</p>'
          },
          {
            type: 'board', title: '两只眼的活棋', size: 7,
            setup: [
              { x: 1, y: 1, c: 1 }, { x: 2, y: 1, c: 1 }, { x: 3, y: 1, c: 1 }, { x: 4, y: 1, c: 1 }, { x: 5, y: 1, c: 1 },
              { x: 1, y: 2, c: 1 }, { x: 3, y: 2, c: 1 }, { x: 5, y: 2, c: 1 },
              { x: 1, y: 3, c: 1 }, { x: 2, y: 3, c: 1 }, { x: 3, y: 3, c: 1 }, { x: 4, y: 3, c: 1 }, { x: 5, y: 3, c: 1 },
              { x: 2, y: 2, c: 0, mark: 'label', label: '眼', markColor: GREEN },
              { x: 4, y: 2, c: 0, mark: 'label', label: '眼', markColor: GREEN }
            ],
            note: '这块黑棋围出了两个「眼」（绿色标记）。白棋永远无法同时填两个眼（都是禁着点），所以黑棋是活棋。'
          },
          {
            type: 'info', title: '做活与杀棋',
            html: '<p><strong>做活</strong>：让自己危险的棋做出两只眼。<strong>杀棋</strong>：破坏对方眼位，让它做不出两只眼。</p>' +
              '<p class="tip">实战中判断「这块棋是死是活」，是围棋最重要的基本功。下一关你亲手做活一块棋！</p>'
          },
          {
            type: 'try', title: '任务：做两只眼', size: 7,
            setup: [
              { x: 1, y: 1, c: 1 }, { x: 2, y: 1, c: 1 }, { x: 3, y: 1, c: 1 }, { x: 4, y: 1, c: 1 }, { x: 5, y: 1, c: 1 },
              { x: 1, y: 2, c: 1 }, { x: 3, y: 2, c: 1 },
              { x: 1, y: 3, c: 1 }, { x: 2, y: 3, c: 1 }, { x: 3, y: 3, c: 1 }, { x: 4, y: 3, c: 1 }, { x: 5, y: 3, c: 1 },
              { x: 2, y: 2, c: 0, mark: 'label', label: '眼', markColor: GREEN },
              { x: 5, y: 2, c: 0, mark: 'circle', markColor: BLUE }
            ],
            task: {
              goal: '补一手，让黑棋做出第二只眼',
              tip: '绿色是第一只眼。第二只眼在右侧还缺一块——看看蓝色圆圈。',
              answer: { x: 5, y: 2 },
              check: function (ctx) {
                var gr = ctx.R.group(ctx.pos, ctx.i);
                var eyes = 0;
                for (var k = 0; k < gr.liberties.length; k++) {
                  if (ctx.R.isEye(ctx.pos, gr.liberties[k], 1)) eyes++;
                }
                return eyes >= 2;
              },
              success: '成了！两只眼齐全，这块黑棋活透了——对方怎么都吃不掉。'
            }
          },
          {
            type: 'try', title: '任务：提掉角上白棋', size: 7,
            setup: [
              { x: 0, y: 0, c: 2, mark: 'circle', markColor: RED },
              { x: 0, y: 1, c: 2, mark: 'circle', markColor: RED },
              { x: 1, y: 0, c: 2, mark: 'circle', markColor: RED },
              { x: 0, y: 2, c: 1 },
              { x: 2, y: 0, c: 1 }
            ],
            task: {
              goal: '提掉角上的三颗白棋',
              tip: '角上的白棋只剩 (1,1) 一口气——堵上它！',
              answer: { x: 1, y: 1 },
              check: function (ctx) { return ctx.pos.captured >= 3; },
              success: '漂亮！白棋三子全被提掉。记住：角上的棋气少，最容易被吃。'
            }
          },
          {
            type: 'quiz', title: '小测验',
            quiz: {
              q: '一块棋要绝对安全（活棋），通常需要：',
              options: [
                { t: 'A. 一只眼', ok: false },
                { t: 'B. 两只或以上的真眼', ok: true },
                { t: 'C. 三口气', ok: false }
              ],
              explain: '「两眼活棋」：对方无法同时填掉两个眼，所以永远提不掉你。'
            }
          }
        ]
      },
      /* ================= 第五课 ================= */
      {
        id: 'u5', icon: '伍', title: '终局与胜负', desc: '停一手、点目、贴目与数子——怎么算谁赢了',
        steps: [
          {
            type: 'info', title: '什么时候结束',
            html: '<p>当双方都认为<strong>没有有价值的棋可下</strong>时，会各自「停一手」；双方连续停一手，对局即结束，进入点目。</p>' +
              '<p class="tip">本游戏中：点「停一手」按钮即可停一手；双方都停一手会自动弹出点目窗口。</p>'
          },
          {
            type: 'info', title: '怎么算谁赢（中国规则）',
            html: '<ul><li>先把双方的<strong>死子</strong>从棋盘上拿掉；</li>' +
              '<li>数双方的<strong>棋子 + 围住的空</strong>，加起来就是各自的「子数」；</li>' +
              '<li>因为黑棋先行占便宜，所以白棋额外加 <strong>3¾ 子（即 7.5 目）贴目</strong>；</li>' +
              '<li>比较「黑方总数」与「白方总数 + 贴目」，多者胜。</li></ul>'
          },
          {
            type: 'board', title: '看看领地怎么数', size: 7, showTerritory: true,
            setup: (function () {
              var b = [], w = [], i;
              for (i = 0; i < 7; i++) {
                for (var x = 0; x <= 2; x++) b.push({ x: x, y: i, c: 1 });
                for (var x2 = 4; x2 <= 6; x2++) w.push({ x: x2, y: i, c: 2 });
              }
              b.push({ x: 3, y: 0, c: 1 }, { x: 3, y: 1, c: 1 }, { x: 3, y: 2, c: 1 });
              w.push({ x: 3, y: 4, c: 2 }, { x: 3, y: 5, c: 2 }, { x: 3, y: 6, c: 2 });
              return b.concat(w);
            })(),
            note: '蓝色区域是黑棋的空，红色区域是白棋的空，中间灰色是「单官」（双方都不算）。数子 = 自己的棋子 + 自己的空。'
          },
          {
            type: 'mark', title: '任务：标记死子', size: 7,
            setup: (function () {
              var b = [], i;
              for (i = 0; i < 7; i++) {
                b.push({ x: 0, y: i, c: 1 }, { x: 6, y: i, c: 1 });
                if (i > 0 && i < 6) b.push({ x: i, y: 0, c: 1 }, { x: i, y: 6, c: 1 });
              }
              b.push({ x: 2, y: 2, c: 2, mark: 'circle', markColor: RED },
                { x: 3, y: 2, c: 2, mark: 'circle', markColor: RED },
                { x: 2, y: 3, c: 2, mark: 'circle', markColor: RED });
              return b;
            })(),
            task: {
              goal: '点击那三颗已经死掉的白棋，把它们标记为死子',
              tip: '它们被黑棋完全包围，做不出两只眼，已是死棋。点击棋子会标上红叉。',
              answer: [0, 0, 0],
              check: function (ctx) {
                var R2 = ctx.R, s = 7;
                return ctx.marked && ctx.marked.size === 3 &&
                  ctx.marked.has(R2.idx(2, 2, s)) && ctx.marked.has(R2.idx(3, 2, s)) && ctx.marked.has(R2.idx(2, 3, s));
              },
              success: '正确！这些白子已经死了。正式对局时把死子拿掉再数空——这就是点目的第一步。'
            }
          },
          {
            type: 'quiz', title: '小测验',
            quiz: {
              q: '按中国规则，黑棋要贴给白棋多少？',
              options: [
                { t: 'A. 3¾ 子（7.5 目）', ok: true },
                { t: 'B. 7 子', ok: false },
                { t: 'C. 黑棋不用贴目', ok: false }
              ],
              explain: '黑贴 3¾ 子 = 7.5 目。因为黑棋先行有优势，所以要给白棋补偿。'
            }
          }
        ]
      }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
