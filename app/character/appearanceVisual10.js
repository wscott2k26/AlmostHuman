import { normalizeAppearance10 } from '../core/appearance10.js';

const SKIN_TONES_10 = Object.freeze({
  porcelain: ['#f1d4c8', '#fff0e8', '#a56f68'],
  light: ['#e7bea9', '#f8ddcf', '#98675b'],
  warm: ['#ca8f74', '#f2bba0', '#74483f'],
  golden: ['#bd7c4e', '#e7a978', '#6a3d2c'],
  olive: ['#a77e59', '#d2ac80', '#5d4635'],
  brown: ['#86563f', '#bd8162', '#4d3028'],
  deep: ['#633d32', '#94604d', '#35221f'],
  ebony: ['#412820', '#735044', '#241816'],
});

const UNDERTONES_10 = Object.freeze({
  cool: ['#f2c4d5', '#7c465d'],
  neutral: ['#f1c6ad', '#6b4742'],
  warm: ['#f4b778', '#77422f'],
});

const EYE_COLORS_10 = Object.freeze({
  brown: '#5d3826', amber: '#b76b1f', hazel: '#77703b', green: '#3f7259',
  blue: '#39789b', gray: '#72808a', violet: '#72508f',
});

const HAIR_COLORS_10 = Object.freeze({
  midnight: ['#211923', '#59445e'], black: ['#17151a', '#4a454e'], brown: ['#4a2d24', '#8a5b45'],
  auburn: ['#6e3028', '#b66550'], copper: ['#9b4e2d', '#df8b58'], blonde: ['#b8965d', '#ead5a0'],
  silver: ['#858996', '#d2d5df'], white: ['#d7d5d2', '#fffdf8'], rose: ['#8f4f63', '#d98aa0'],
  violet: ['#5c3977', '#a879cc'], blue: ['#274c78', '#5f91c7'],
});

const OUTFIT_COLORS_10 = Object.freeze({
  comfort: ['#574a61', '#bca6c8'], street: ['#242a35', '#ff8f62'], classic: ['#353947', '#d7c28f'],
  creative: ['#563651', '#f1889f'], futuristic: ['#243c4a', '#68d4ee'], nature: ['#344d3d', '#8ec49b'],
  minimal: ['#302942', '#a99bc0'], mystical: ['#3f2d55', '#c38bea'],
});

const BROW_WIDTH_10 = Object.freeze({ light: '2.5px', medium: '4px', bold: '6px' });

export function appearanceVisualTokens10(value = {}) {
  const appearance = normalizeAppearance10(value);
  const skin = SKIN_TONES_10[appearance.skinTone];
  const undertone = UNDERTONES_10[appearance.skinUndertone];
  const hair = HAIR_COLORS_10[appearance.hairColor];
  const outfit = OUTFIT_COLORS_10[appearance.styleDirection];
  return Object.freeze({
    '--v10-skin': skin[0],
    '--v10-skin-highlight': mixHex10(skin[1], undertone[0], 0.26),
    '--v10-skin-shadow': mixHex10(skin[2], undertone[1], 0.22),
    '--v10-feature-shadow': mixHex10(skin[2], undertone[1], 0.45),
    '--v10-eye': EYE_COLORS_10[appearance.eyeColor],
    '--v10-hair': hair[0],
    '--v10-hair-accent': hair[1],
    '--v10-brow': mixHex10(hair[0], '#4b3238', 0.18),
    '--v10-brow-width': BROW_WIDTH_10[appearance.browWeight],
    '--v10-outfit': outfit[0],
    '--v10-outfit-accent': outfit[1],
  });
}

function mixHex10(left, right, ratio) {
  const amount = Math.max(0, Math.min(1, Number(ratio) || 0));
  const a = parseHex10(left);
  const b = parseHex10(right);
  const channel = (index) => Math.round(a[index] * (1 - amount) + b[index] * amount).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function parseHex10(value) {
  const raw = String(value || '#000000').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((item) => item + item).join('') : raw.padEnd(6, '0').slice(0, 6);
  return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16) || 0);
}
