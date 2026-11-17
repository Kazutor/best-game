// EMBERDRIFT — the game world: the player ship, enemies, bullets, embers,
// waves, upgrades and the combo. Pure simulation: it reads a small input
// snapshot each step ({moveX, moveY, aimX, aimY, firing, dash}) and returns
// the events that happened, so the sound and shake live elsewhere and the
// screenshot scenes can drive it with an autopilot instead of a human.

import { FIELD, PLAYER, COMBO, ENEMY, WAVE, EMBER, UPGRADES } from './config.js';
import { clamp, distance, intIn, pick, range, shuffle } from './random.js';

export const EVENT_KILL = 1;
export const EVENT_EMBER = 2;
export const EVENT_HURT = 4;
export const EVENT_WAVE = 8;
export const EVENT_CLEAR = 16;
export const EVENT_OVER = 32;
export const EVENT_DASH = 64;
export const EVENT_ORB = 128;
export const EVENT_HIT = 256;

const TWO_PI = Math.PI * 2;

function enemyKindForBudget(rng, wave, budget) {
  const table = ['mote', 'mote', 'dart'];
  if (wave >= 2) table.push('splitter', 'dart');
  if (wave >= 3) table.push('dart', 'splitter');
  if (wave >= 4) table.push('weaver', 'weaver');
  if (wave >= 6) table.push('weaver', 'splitter');
  let kind = pick(rng, table);
  let cost = kind === 'splitter' ? 3 : kind === 'weaver' ? 2 : 1;
  while (cost > budget && table.length > 1) {
    kind = pick(rng, table);
    cost = kind === 'splitter' ? 3 : kind === 'weaver' ? 2 : 1;
  }
  return { kind, cost };
}

function spawnEdge(rng) {
  const side = intIn(rng, 0, 3);
  if (side === 0) return { x: range(rng, 40, FIELD.width - 40), y: -30 };
  if (side === 1) return { x: range(rng, 40, FIELD.width - 40), y: FIELD.height + 30 };
  if (side === 2) return { x: -30, y: range(rng, 40, FIELD.height - 40) };
  return { x: FIELD.width + 30, y: range(rng, 40, FIELD.height - 40) };
}

export function createWorld(rng) {
  const state = {
    time: 0,
    score: 0,
    best: 0,
    wave: 0,
    kills: 0,
    embersCollected: 0,
    combo: 0,
    comboTimer: 0,
    waveState: 'idle', // idle | fighting | clear
    restTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    emberTimer: 2,
    player: null,
    bullets: [],
    enemies: [],
    orbs: [],
    embers: [],
    particles: [],
    popups: [],
    shake: 0,
    over: false,
  };

  function resetPlayer() {
    state.player = {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hull: PLAYER.maxHull,
      maxHull: PLAYER.maxHull,
      fireTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      invulnerable: 0,
      spread: 0,
      fireRateMult: 1,
      speedMult: 1,
      magnetRadius: PLAYER.pickupRadius,
      dashRechargeMult: 1,
    };
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * TWO_PI;
      const velocity = range(rng, speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: range(rng, 0.3, 0.7),
        maxLife: 0.7,
        size: range(rng, 2, 5),
        color,
      });
    }
  }

  function popup(x, y, text, color) {
    state.popups.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  function multiplier() {
    return Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / 5));
  }

  function addScore(base, x, y) {
    const gained = base * multiplier();
    state.score += gained;
    popup(x, y, `+${gained}`, '#fde68a');
    return gained;
  }

  function dropEmber(x, y) {
    state.embers.push({
      x: clamp(x, 20, FIELD.width - 20),
      y: clamp(y, 20, FIELD.height - 20),
      vx: range(rng, -14, 14),
      vy: range(rng, 8, EMBER.driftSpeed),
      life: EMBER.lifetime,
      spin: range(rng, 1, 3),
      phase: rng() * TWO_PI,
    });
  }

  function spawnEnemy(kind) {
    const pos = spawnEdge(rng);
    const def = ENEMY[kind];
    state.enemies.push({
      kind,
      x: pos.x, y: pos.y,
      vx: 0, vy: 0,
      radius: def.radius,
      hull: def.hull,
      speed: def.speed * range(rng, 0.9, 1.15),
      fireTimer: range(rng, 1.5, 3),
      strafeDir: rng() < 0.5 ? -1 : 1,
      wobble: rng() * TWO_PI,
      hitFlash: 0,
    });
  }

  function startWave(number) {
    state.wave = number;
    const budget = WAVE.baseBudget + WAVE.budgetPerWave * (number - 1);
    const queue = [];
    let left = budget;
    while (left > 0) {
      const pickKind = enemyKindForBudget(rng, number, left);
      queue.push(pickKind.kind);
      left -= pickKind.cost;
    }
    shuffle(rng, queue);
    state.spawnQueue = queue;
    state.spawnTimer = 0.4;
    state.waveState = 'fighting';
    return EVENT_WAVE;
  }

  function killEnemy(index, award) {
    const enemy = state.enemies[index];
    const def = ENEMY[enemy.kind];
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.combo += COMBO.perKill;
    state.comboTimer = COMBO.windowSeconds;
    burst(enemy.x, enemy.y, enemy.kind === 'splitter' ? '#a78bfa' : enemy.kind === 'weaver' ? '#38bdf8' : '#f472b6', enemy.kind === 'splitter' ? 26 : 14, 220);
    if (award) addScore(def.score, enemy.x, enemy.y);
    if (rng() < def.emberChance) dropEmber(enemy.x, enemy.y);
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 3; i += 1) {
        state.enemies.push({
          kind: 'mote',
          x: enemy.x + range(rng, -24, 24), y: enemy.y + range(rng, -24, 24),
          vx: range(rng, -90, 90), vy: range(rng, -90, 90),
          radius: ENEMY.mote.radius, hull: 1,
          speed: ENEMY.mote.speed * 1.25,
          fireTimer: 0, strafeDir: 1, wobble: rng() * TWO_PI, hitFlash: 0,
        });
      }
    }
    state.shake = Math.min(14, state.shake + 5);
  }

  function hurtPlayer() {
    const player = state.player;
    if (player.invulnerable > 0 || state.over) return 0;
    player.hull -= 1;
    player.invulnerable = PLAYER.invulnerableTime;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = 18;
    burst(player.x, player.y, '#ef4444', 22, 260);
    if (player.hull <= 0) {
      state.over = true;
      burst(player.x, player.y, '#f59e0b', 60, 340);
      return EVENT_HURT | EVENT_OVER;
    }
    return EVENT_HURT;
  }

  function fireBullet() {
    const player = state.player;
    const spreadCount = player.spread;
    const total = spreadCount + 1;
    for (let i = 0; i < total; i += 1) {
      const offset = (i - spreadCount / 2) * 0.14;
      const angle = player.angle + offset;
      state.bullets.push({
        x: player.x + Math.cos(angle) * 22,
        y: player.y + Math.sin(angle) * 22,
        vx: Math.cos(angle) * PLAYER.bulletSpeed,
        vy: Math.sin(angle) * PLAYER.bulletSpeed,
        radius: PLAYER.bulletRadius,
        life: 1.1,
      });
    }
  }

  return {
    state,
    multiplier,
    reset(best) {
      state.time = 0;
      state.score = 0;
      state.best = best;
      state.wave = 0;
      state.kills = 0;
      state.embersCollected = 0;
      state.combo = 0;
      state.comboTimer = 0;
      state.waveState = 'idle';
      state.restTimer = 0;
      state.spawnQueue = [];
      state.spawnTimer = 0;
      state.emberTimer = 2;
      state.bullets = [];
      state.enemies = [];
      state.orbs = [];
      state.embers = [];
      state.particles = [];
      state.popups = [];
      state.shake = 0;
      state.over = false;
      resetPlayer();
    },
    begin() {
      return startWave(1);
    },
    upgradeChoices() {
      const pool = shuffle(rng, UPGRADES.slice());
      return pool.slice(0, 3);
    },
    applyUpgrade(id) {
      const player = state.player;
      if (id === 'hull') {
        player.maxHull += 1;
        player.hull = Math.min(player.maxHull, player.hull + 1);
      } else if (id === 'rapid') {
        player.fireRateMult *= 1.25;
      } else if (id === 'spread') {
        player.spread = Math.min(3, player.spread + 1);
      } else if (id === 'speed') {
        player.speedMult *= 1.18;
      } else if (id === 'magnet') {
        player.magnetRadius *= 1.8;
      } else if (id === 'dash') {
        player.dashRechargeMult *= 1.4;
      }
    },
    nextWave() {
      return startWave(state.wave + 1);
    },
    step(dt, input) {
      let events = 0;
      const player = state.player;
      state.time += dt;
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 0;
      }
      if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 40);

      // --- player movement ---
      const speed = PLAYER.maxSpeed * player.speedMult;
      player.vx += input.moveX * PLAYER.accel * dt;
      player.vy += input.moveY * PLAYER.accel * dt;
      const moving = Math.hypot(player.vx, player.vy);
      if (moving > speed) {
        player.vx = (player.vx / moving) * speed;
        player.vy = (player.vy / moving) * speed;
      }
      player.vx *= Math.pow(PLAYER.drag, dt * 60);
      player.vy *= Math.pow(PLAYER.drag, dt * 60);
      player.x = clamp(player.x + player.vx * dt, 20, FIELD.width - 20);
      player.y = clamp(player.y + player.vy * dt, 20, FIELD.height - 20);
      player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

      // --- dash ---
      if (player.dashCooldown > 0) player.dashCooldown -= dt * player.dashRechargeMult;
      if (input.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
        player.dashTimer = PLAYER.dashTime;
        player.dashCooldown = PLAYER.dashCooldown;
        const dashAngle = moving > 10 ? Math.atan2(player.vy, player.vx) : player.angle;
        player.vx = Math.cos(dashAngle) * PLAYER.dashSpeed;
        player.vy = Math.sin(dashAngle) * PLAYER.dashSpeed;
        events |= EVENT_DASH;
      }
      if (player.dashTimer > 0) player.dashTimer -= dt;
      if (player.invulnerable > 0) player.invulnerable -= dt;

      // --- firing ---
      player.fireTimer -= dt;
      if (input.firing && player.fireTimer <= 0) {
        fireBullet();
        player.fireTimer = PLAYER.fireInterval / player.fireRateMult;
      }

      // --- spawning ---
      if (state.waveState === 'fighting') {
        state.spawnTimer -= dt;
        if (state.spawnQueue.length > 0 && state.spawnTimer <= 0) {
          spawnEnemy(state.spawnQueue.shift());
          state.spawnTimer = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval - state.wave * 0.05);
        }
        state.emberTimer -= dt;
        if (state.emberTimer <= 0) {
          state.emberTimer = range(rng, 1.8, 3.2);
          dropEmber(range(rng, 60, FIELD.width - 60), -20);
        }
        if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
          state.waveState = 'clear';
          state.restTimer = WAVE.restSeconds;
          events |= EVENT_CLEAR;
        }
      }

      // --- bullets ---
      for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
        const bullet = state.bullets[i];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
        if (bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
          state.bullets.splice(i, 1);
          continue;
        }
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = state.enemies[j];
          if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < bullet.radius + enemy.radius) {
            state.bullets.splice(i, 1);
            enemy.hull -= 1;
            enemy.hitFlash = 0.12;
            burst(bullet.x, bullet.y, '#fde047', 4, 120);
            if (enemy.hull <= 0) {
              killEnemy(j, true);
              events |= EVENT_KILL;
            } else {
              events |= EVENT_HIT;
            }
            break;
          }
        }
      }

      // --- enemies ---
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = state.enemies[i];
        if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
        enemy.wobble += dt * 2;
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (enemy.kind === 'mote' || enemy.kind === 'splitter') {
          const wobble = Math.sin(enemy.wobble) * 0.35;
          const nx = dx / dist;
          const ny = dy / dist;
          enemy.vx += (nx * Math.cos(wobble) - ny * Math.sin(wobble)) * enemy.speed * 2.2 * dt;
          enemy.vy += (nx * Math.sin(wobble) + ny * Math.cos(wobble)) * enemy.speed * 2.2 * dt;
        } else if (enemy.kind === 'dart') {
          enemy.vx += (dx / dist) * enemy.speed * 3.2 * dt;
          enemy.vy += (dy / dist) * enemy.speed * 3.2 * dt;
          const speedNow = Math.hypot(enemy.vx, enemy.vy);
          if (speedNow > enemy.speed * 1.6) {
            enemy.vx = (enemy.vx / speedNow) * enemy.speed * 1.6;
            enemy.vy = (enemy.vy / speedNow) * enemy.speed * 1.6;
          }
        } else if (enemy.kind === 'weaver') {
          const want = 260;
          const toward = dist > want ? 1 : -0.6;
          enemy.vx += (dx / dist) * toward * enemy.speed * 2 * dt + (-dy / dist) * enemy.strafeDir * enemy.speed * 1.4 * dt;
          enemy.vy += (dy / dist) * toward * enemy.speed * 2 * dt + (dx / dist) * enemy.strafeDir * enemy.speed * 1.4 * dt;
          enemy.fireTimer -= dt;
          if (enemy.fireTimer <= 0 && dist < 520) {
            enemy.fireTimer = range(rng, 2.2, 3.2);
            state.orbs.push({
              x: enemy.x, y: enemy.y,
              vx: (dx / dist) * 190, vy: (dy / dist) * 190,
              radius: 7, life: 5,
            });
            events |= EVENT_ORB;
          }
        }
        const eSpeed = Math.hypot(enemy.vx, enemy.vy);
        const cap = enemy.kind === 'dart' ? enemy.speed * 1.6 : enemy.speed * 1.15;
        if (eSpeed > cap) {
          enemy.vx = (enemy.vx / eSpeed) * cap;
          enemy.vy = (enemy.vy / eSpeed) * cap;
        }
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        if (distance(enemy.x, enemy.y, player.x, player.y) < enemy.radius + PLAYER.radius - 4) {
          killEnemy(i, false);
          events |= hurtPlayer();
          events |= EVENT_KILL;
        }
      }

      // --- enemy orbs ---
      for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
        const orb = state.orbs[i];
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        orb.life -= dt;
        if (orb.life <= 0 || orb.x < -20 || orb.x > FIELD.width + 20 || orb.y < -20 || orb.y > FIELD.height + 20) {
          state.orbs.splice(i, 1);
          continue;
        }
        if (distance(orb.x, orb.y, player.x, player.y) < orb.radius + PLAYER.radius - 4) {
          state.orbs.splice(i, 1);
          events |= hurtPlayer();
        }
      }

      // --- embers ---
      for (let i = state.embers.length - 1; i >= 0; i -= 1) {
        const ember = state.embers[i];
        ember.life -= dt;
        ember.phase += dt * 3;
        ember.x += ember.vx * dt;
        ember.y += ember.vy * dt;
        const pull = distance(ember.x, ember.y, player.x, player.y);
        if (pull < player.magnetRadius) {
          ember.x += ((player.x - ember.x) / pull) * 340 * dt;
          ember.y += ((player.y - ember.y) / pull) * 340 * dt;
        }
        if (ember.life <= 0) {
          state.embers.splice(i, 1);
          continue;
        }
        if (pull < PLAYER.radius + 14) {
          state.embers.splice(i, 1);
          state.embersCollected += 1;
          state.combo += COMBO.perEmber;
          state.comboTimer = COMBO.windowSeconds;
          addScore(EMBER.score, ember.x, ember.y);
          burst(ember.x, ember.y, '#fbbf24', 8, 140);
          events |= EVENT_EMBER;
        }
      }

      // --- particles and popups ---
      for (let i = state.particles.length - 1; i >= 0; i -= 1) {
        const p = state.particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        if (p.life <= 0) state.particles.splice(i, 1);
      }
      for (let i = state.popups.length - 1; i >= 0; i -= 1) {
        const p = state.popups[i];
        p.life -= dt;
        p.y -= 42 * dt;
        if (p.life <= 0) state.popups.splice(i, 1);
      }

      if (state.over) events |= EVENT_OVER;
      return events;
    },
  };
}
