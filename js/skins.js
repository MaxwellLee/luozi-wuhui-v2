/* =============================================================
 * 《落子无悔》· 三款棋盘皮肤定义（暖 / 橙 / 暗，含纹理与装饰配色）
 * 挂载 window.GO_SKINS；apply(id) 切换页面主题。
 * ============================================================= */
(function (g) {
  'use strict';
  g.GO_SKINS = {
    warm: {
      id: 'warm', name: '和风木韵', desc: '暖木樱花 · 温润',
      frame: '#8a5a2b', frameDark: '#5c3a16', frameLight: '#a3713c',
      surface: '#e9c793', surfaceLight: '#f4dcb2',
      line: '#6b4a26', star: '#6b4a26',
      grain: '#b98a4e', grainOpacity: 0.16, grainSeed: 7, grainFreq: '0.012 0.09',
      black: { c1: '#4a4a4a', c2: '#101010', edge: '#050505' },
      white: { c1: '#ffffff', c2: '#d6d9d2', edge: '#8f948a' },
      decor: 'sakura',
      decorColor: '#e8a7b8', decorColor2: '#c98a4b', labelColor: '#7a5a30'
    },
    orange: {
      id: 'orange', name: '落日枫林', desc: '夕阳枫叶 · 热烈',
      frame: '#9c4a1c', frameDark: '#6b2e0e', frameLight: '#c06a2e',
      surface: '#f2ad63', surfaceLight: '#f9cd94',
      line: '#6e3a14', star: '#6e3a14',
      grain: '#d8893f', grainOpacity: 0.18, grainSeed: 11, grainFreq: '0.014 0.1',
      black: { c1: '#46302a', c2: '#0d0a08', edge: '#060504' },
      white: { c1: '#fffdf6', c2: '#e8d8c2', edge: '#b09a80' },
      decor: 'maple',
      decorColor: '#c8451f', decorColor2: '#f0a05e', labelColor: '#7a3c16'
    },
    dark: {
      id: 'dark', name: '星夜墨竹', desc: '墨色星空 · 沉静',
      frame: '#24384f', frameDark: '#101b29', frameLight: '#3a5878',
      surface: '#2c4560', surfaceLight: '#38597a',
      line: '#a8c2dc', star: '#cfe0f0',
      grain: '#4a6a8a', grainOpacity: 0.14, grainSeed: 23, grainFreq: '0.012 0.08',
      black: { c1: '#2a3140', c2: '#05070b', edge: '#020408' },
      white: { c1: '#f4f8ff', c2: '#c3d0e2', edge: '#7f92ab' },
      decor: 'moonbamboo',
      decorColor: '#d8c07a', decorColor2: '#6f9f8a', labelColor: '#8fa6c2'
    }
  };
  function applySkin(id) {
    if (!g.GO_SKINS[id]) id = 'warm';
    document.body.setAttribute('data-skin', id);
    return id;
  }
  g.GO_SKINS.apply = applySkin;
})(typeof window !== 'undefined' ? window : globalThis);
