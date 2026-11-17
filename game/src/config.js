// EMBERDRIFT — tuning constants and the palette.
// One job: every number the rest of the game balances on lives here, so a
// balance pass touches this file and nothing else.

export const FIELD = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 16,
  accel: 2600,
  maxSpeed: 340,
  drag: 0.86,
  fireInterval: 0.16,
  bulletSpeed: 720,
  bulletRadius: 5,
  maxHull: 3,
  dashSpeed: 900,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnerableTime: 2.0,
  pickupRadius: 96,
};

export const COMBO = {
  windowSeconds: 3.0,
  perKill: 1,
  perEmber: 1,
  maxMultiplier: 8,
};

export const ENEMY = {
  mote: { radius: 15, speed: 70, hull: 1, score: 50, emberChance: 0.55 },
  dart: { radius: 12, speed: 190, hull: 1, score: 100, emberChance: 0.4 },
  splitter: { radius: 30, speed: 46, hull: 4, score: 200, emberChance: 1.0 },
  weaver: { radius: 18, speed: 60, hull: 2, score: 150, emberChance: 0.5 },
};

export const WAVE = {
  baseBudget: 6,
  budgetPerWave: 4,
  spawnInterval: 0.9,
  spawnIntervalMin: 0.35,
  restSeconds: 6,
};

export const EMBER = {
  score: 25,
  lifetime: 9,
  driftSpeed: 26,
};

export const UPGRADES = [
  { id: 'hull', name: 'Reinforced Hull', blurb: '+1 max hull, and repair 1 hull now', icon: '♥' },
  { id: 'rapid', name: 'Rapid Caster', blurb: 'Fire 25% faster', icon: '»' },
  { id: 'spread', name: 'Twin Embers', blurb: '+1 bullet in every shot', icon: '✦' },
  { id: 'speed', name: 'Ion Thrusters', blurb: '+18% move speed', icon: '➤' },
  { id: 'magnet', name: 'Ember Magnet', blurb: 'Pull embers from much further away', icon: '◎' },
  { id: 'dash', name: 'Blink Coil', blurb: 'Dash recharges 40% faster', icon: '↯' },
];

export const PALETTE = {
  spaceTop: '#0a0a24',
  spaceBottom: '#160a2e',
  nebulaA: 'rgba(124, 58, 237, 0.20)',
  nebulaB: 'rgba(14, 165, 233, 0.16)',
  nebulaC: 'rgba(244, 114, 182, 0.12)',
  star: '#e2e8f0',
  ship: '#fde68a',
  shipGlow: '#f59e0b',
  bullet: '#fde047',
  ember: '#fbbf24',
  emberGlow: '#f59e0b',
  mote: '#f472b6',
  dart: '#fb7185',
  splitter: '#a78bfa',
  weaver: '#38bdf8',
  orb: '#f0abfc',
  hud: '#e2e8f0',
  hudDim: '#94a3b8',
  accent: '#22d3ee',
  danger: '#ef4444',
  good: '#4ade80',
  panel: 'rgba(10, 10, 36, 0.82)',
  panelEdge: 'rgba(148, 163, 184, 0.35)',
};
