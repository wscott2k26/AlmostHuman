import { normalizeOrigin10 } from '../core/origin10.js';

const CORE_COLORS = Object.freeze({
  ember: '#ff9b6a', gold: '#f2c66d', ocean: '#72cce2', rose: '#ef86ad', violet: '#a58af7', aurora: '#7de0bf',
});
const SPECTRAL_COLORS = Object.freeze({
  violet: '#a58af7', cyan: '#72d9ec', rose: '#ef86ad', gold: '#f2c66d', emerald: '#72d8aa', silver: '#d8dce8',
});
const MOOD_LIGHTS = Object.freeze({
  wonder: '#b88cff', curious: '#77dceb', thoughtful: '#8d9dcc', happy: '#ffd17a', playful: '#ff94bd',
  calm: '#78cabd', sad: '#7184a9', worried: '#bb89a9', confident: '#e6ad67', mysterious: '#826ab9',
});
const MATERIALS = Object.freeze({
  'luminous-resin': { surface: 'linear-gradient(145deg,rgba(255,255,255,.3),rgba(255,255,255,.07))', solid: '#34303f', blur: '18px', roughness: '.18' },
  crystal: { surface: 'linear-gradient(145deg,rgba(255,255,255,.4),rgba(166,183,255,.08))', solid: '#30394d', blur: '24px', roughness: '.08' },
  'soft-light': { surface: 'linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.035))', solid: '#33313a', blur: '30px', roughness: '.12' },
  'polished-metal': { surface: 'linear-gradient(145deg,rgba(250,250,255,.36),rgba(91,96,118,.18) 45%,rgba(255,255,255,.06))', solid: '#404350', blur: '12px', roughness: '.05' },
  'warm-stone': { surface: 'linear-gradient(145deg,rgba(218,190,170,.28),rgba(91,70,67,.16))', solid: '#483c3e', blur: '8px', roughness: '.42' },
});

export function materialTokens10(originValue = {}, environment = {}) {
  const origin = normalizeOrigin10(originValue);
  const material = MATERIALS[origin.materialFamily] ? origin.materialFamily : 'luminous-resin';
  const source = MATERIALS[material];
  const reducedTransparency = Boolean(environment.reducedTransparency);
  const core = CORE_COLORS[origin.coreColor] || CORE_COLORS.ember;
  const spectral = SPECTRAL_COLORS[origin.spectralColor] || SPECTRAL_COLORS.violet;
  const scene = MOOD_LIGHTS[environment.mood] || MOOD_LIGHTS.wonder;
  return Object.freeze({
    material,
    transparencyMode: reducedTransparency ? 'solid' : 'glass',
    cssVars: Object.freeze({
      '--v10-material-surface': reducedTransparency ? source.solid : source.surface,
      '--v10-material-blur': reducedTransparency ? '0px' : source.blur,
      '--v10-material-roughness': source.roughness,
      '--v10-core-light': core,
      '--v10-spectral-light': spectral,
      '--v10-luminous-border': `color-mix(in srgb, ${spectral} 62%, white)`,
      '--v10-scene-light': scene,
      '--v10-deep-shadow': 'rgba(3,4,10,.54)',
      '--v10-readable-ink': '#f8f7fb',
    }),
  });
}
