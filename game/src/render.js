// EMBERDRIFT — everything drawn on the canvas: the starfield and nebulae,
// the ship, enemies, bullets, embers and particles, the HUD, and the title,
// upgrade, pause and game-over screens. It reads state and draws it; it
// never changes state.

import { FIELD, PALETTE, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowCircle(ctx, x, y, radius, color, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawStarfield(ctx, stars, time) {
  for (const star of stars) {
    const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time * star.twinkle + star.phase));
    ctx.globalAlpha = star.alpha * twinkle;
    ctx.fillStyle = star.color;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

function drawNebula(ctx, time) {
  const drift = Math.sin(time * 0.05) * 30;
  glowCircle(ctx, 300 + drift, 180, 320, PALETTE.nebulaA, 1);
  glowCircle(ctx, 1000 - drift, 560, 360, PALETTE.nebulaB, 1);
  glowCircle(ctx, 900 + drift * 0.5, 140, 240, PALETTE.nebulaC, 1);
}

function drawShip(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invulnerable > 0 && Math.floor(time * 12) % 2 === 0) ctx.globalAlpha = 0.35;
  const flame = 10 + Math.sin(time * 30) * 4;
  ctx.rotate(player.angle);
  glowCircle(ctx, 0, 0, 34, PALETTE.shipGlow, 0.5);
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.lineTo(-14 - flame, 0);
  ctx.lineTo(-14, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.ship;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-12, 12);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, enemy, time) {
  const flash = enemy.hitFlash > 0;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.kind === 'mote') {
    ctx.rotate(Math.sin(enemy.wobble) * 0.4);
    glowCircle(ctx, 0, 0, enemy.radius + 12, '#f472b6', 0.4);
    ctx.fillStyle = flash ? '#ffffff' : '#ec4899';
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? enemy.radius : enemy.radius * 0.55;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === 'dart') {
    ctx.rotate(Math.atan2(enemy.vy, enemy.vx));
    glowCircle(ctx, 0, 0, enemy.radius + 10, '#fb7185', 0.4);
    ctx.fillStyle = flash ? '#ffffff' : '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(enemy.radius + 6, 0);
    ctx.lineTo(-enemy.radius, enemy.radius * 0.8);
    ctx.lineTo(-enemy.radius * 0.4, 0);
    ctx.lineTo(-enemy.radius, -enemy.radius * 0.8);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === 'splitter') {
    ctx.rotate(time * 0.6);
    glowCircle(ctx, 0, 0, enemy.radius + 16, '#a78bfa', 0.45);
    ctx.fillStyle = flash ? '#ffffff' : '#8b5cf6';
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.lineTo(Math.cos(angle) * enemy.radius, Math.sin(angle) * enemy.radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c4b5fd';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(time * 1.4);
    glowCircle(ctx, 0, 0, enemy.radius + 12, '#38bdf8', 0.45);
    ctx.strokeStyle = flash ? '#ffffff' : '#38bdf8';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, angle, angle + Math.PI * 0.7);
      ctx.stroke();
    }
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHud(ctx, state, best) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.hud;
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, 20, 14);
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(`BEST ${Math.max(best, state.score).toLocaleString('en-US')}`, 20, 54);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hud;
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText(`WAVE ${state.wave}`, FIELD.width / 2, 16);
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  const left = state.spawnQueue.length + state.enemies.length;
  ctx.fillText(left > 0 ? `${left} hostiles left` : 'Wave clear!', FIELD.width / 2, 48);
  ctx.textAlign = 'right';
  for (let i = 0; i < state.player.maxHull; i += 1) {
    ctx.fillStyle = i < state.player.hull ? '#fb7185' : 'rgba(148,163,184,0.3)';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('♥', FIELD.width - 20 - i * 32, 12);
  }
  if (state.combo >= 2) {
    const mult = Math.min(8, 1 + Math.floor(state.combo / 5));
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText(`COMBO ×${mult}`, FIELD.width - 20, 48);
    ctx.fillStyle = 'rgba(251,191,36,0.35)';
    ctx.fillRect(FIELD.width - 120, 82, 100, 6);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(FIELD.width - 120, 82, 100 * (state.comboTimer / 3), 6);
  }
  const dashReady = state.player.dashCooldown <= 0;
  ctx.fillStyle = dashReady ? PALETTE.accent : PALETTE.hudDim;
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText(dashReady ? 'DASH READY  [SHIFT]' : 'dash recharging…', FIELD.width - 20, 104);
}

function centreText(ctx, text, y, font, color) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(text, FIELD.width / 2, y);
}

function drawTitle(ctx, best) {
  ctx.fillStyle = 'rgba(5, 5, 20, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  glowCircle(ctx, FIELD.width / 2, 250, 260, PALETTE.nebulaA, 1);
  centreText(ctx, 'EMBERDRIFT', 218, '800 84px system-ui, sans-serif', '#fde68a');
  centreText(ctx, 'Harvest the falling embers. Survive the void.', 292, '600 24px system-ui, sans-serif', PALETTE.hud);
  centreText(ctx, 'WASD / Arrows — fly      Mouse — aim      Hold Click / Space — fire', 350, '600 19px system-ui, sans-serif', PALETTE.hudDim);
  centreText(ctx, 'SHIFT — dash through danger      P — pause      M — mute', 382, '600 19px system-ui, sans-serif', PALETTE.hudDim);
  centreText(ctx, 'Chain kills and embers to raise your combo multiplier — up to ×8.', 414, '600 19px system-ui, sans-serif', PALETTE.hudDim);
  centreText(ctx, 'Clear a wave to choose an upgrade. Three hull hits and the drift ends.', 446, '600 19px system-ui, sans-serif', PALETTE.hudDim);
  ctx.fillStyle = PALETTE.accent;
  roundRect(ctx, FIELD.width / 2 - 220, 500, 440, 62, 12);
  ctx.fill();
  centreText(ctx, 'CLICK OR PRESS ENTER TO LAUNCH', 532, '800 20px system-ui, sans-serif', '#082f49');
  if (best > 0) centreText(ctx, `Best score: ${best.toLocaleString('en-US')}`, 596, '600 20px system-ui, sans-serif', '#fbbf24');
}

function drawUpgrade(ctx, choices) {
  ctx.fillStyle = 'rgba(5, 5, 20, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  centreText(ctx, 'WAVE CLEAR — CHOOSE AN UPGRADE', 130, '800 40px system-ui, sans-serif', '#4ade80');
  centreText(ctx, 'Press 1, 2 or 3 — or click a card', 178, '600 19px system-ui, sans-serif', PALETTE.hudDim);
  const cardW = 300;
  const gap = 30;
  const total = cardW * 3 + gap * 2;
  const startX = (FIELD.width - total) / 2;
  choices.forEach((choice, i) => {
    const x = startX + i * (cardW + gap);
    const y = 230;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, cardW, 220, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.font = '52px system-ui, sans-serif';
    ctx.fillText(choice.icon, x + cardW / 2, y + 62);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText(choice.name, x + cardW / 2, y + 122);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(choice.blurb, x + cardW / 2, y + 158);
    ctx.fillStyle = PALETTE.accent;
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, x + cardW / 2, y + 192);
  });
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(5, 5, 20, 0.65)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  centreText(ctx, 'PAUSED', 320, '800 64px system-ui, sans-serif', PALETTE.hud);
  centreText(ctx, 'Press P or click to resume', 400, '600 20px system-ui, sans-serif', PALETTE.hudDim);
}

function drawOver(ctx, state, best) {
  ctx.fillStyle = 'rgba(5, 5, 20, 0.68)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  centreText(ctx, 'THE DRIFT ENDS', 220, '800 64px system-ui, sans-serif', '#fb7185');
  centreText(ctx, `FINAL SCORE  ${state.score.toLocaleString('en-US')}`, 310, '700 34px system-ui, sans-serif', '#fde68a');
  const isBest = state.score >= best && state.score > 0;
  centreText(ctx, isBest ? '★ NEW BEST SCORE ★' : `Best: ${best.toLocaleString('en-US')}`, 360, '700 22px system-ui, sans-serif', isBest ? '#4ade80' : PALETTE.hudDim);
  centreText(ctx, `Waves survived: ${state.wave}      Void shards destroyed: ${state.kills}      Embers gathered: ${state.embersCollected}`, 420, '600 19px system-ui, sans-serif', PALETTE.hud);
  ctx.fillStyle = PALETTE.accent;
  roundRect(ctx, FIELD.width / 2 - 220, 480, 440, 62, 12);
  ctx.fill();
  centreText(ctx, 'PRESS R OR CLICK TO FLY AGAIN', 512, '800 20px system-ui, sans-serif', '#082f49');
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    stars.push({
      x: Math.random() * FIELD.width,
      y: Math.random() * FIELD.height,
      size: Math.random() < 0.85 ? 1 : 2,
      alpha: 0.35 + Math.random() * 0.65,
      twinkle: 0.5 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() < 0.8 ? PALETTE.star : '#bae6fd',
    });
  }

  return {
    stars,
    draw(state, screen, extras) {
      const time = state.time;
      const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
      gradient.addColorStop(0, PALETTE.spaceTop);
      gradient.addColorStop(1, PALETTE.spaceBottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.save();
      if (state.shake > 0.5) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      drawNebula(ctx, time);
      drawStarfield(ctx, stars, time);
      for (const ember of state.embers) {
        const blink = ember.life < 2 ? (Math.floor(time * 8) % 2 === 0 ? 0.35 : 1) : 1;
        ctx.globalAlpha = blink;
        const pulse = 1 + Math.sin(ember.phase) * 0.18;
        glowCircle(ctx, ember.x, ember.y, 22 * pulse, PALETTE.emberGlow, 0.55);
        ctx.fillStyle = PALETTE.ember;
        ctx.save();
        ctx.translate(ember.x, ember.y);
        ctx.rotate(ember.phase * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(6, 0);
        ctx.lineTo(0, 9);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      for (const orb of state.orbs) {
        glowCircle(ctx, orb.x, orb.y, 16, PALETTE.orb, 0.6);
        ctx.fillStyle = '#e879f9';
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const enemy of state.enemies) drawEnemy(ctx, enemy, time);
      for (const bullet of state.bullets) {
        glowCircle(ctx, bullet.x, bullet.y, 12, PALETTE.bullet, 0.7);
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!state.over && state.player) drawShip(ctx, state.player, time);
      for (const p of state.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const p of state.popups) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.font = '700 17px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (screen === SCREEN_PLAY || screen === SCREEN_UPGRADE || screen === SCREEN_PAUSED) {
        drawHud(ctx, state, extras.best);
      }
      if (screen === SCREEN_TITLE) drawTitle(ctx, extras.best);
      else if (screen === SCREEN_UPGRADE) drawUpgrade(ctx, extras.choices);
      else if (screen === SCREEN_PAUSED) drawPaused(ctx);
      else if (screen === SCREEN_OVER) drawOver(ctx, state, extras.best);
    },
  };
}
