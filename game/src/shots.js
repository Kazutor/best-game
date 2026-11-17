// EMBERDRIFT — the screenshot scenes behind ?shot=start|play|upgrade|end.
// Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
// The start scene decorates a fresh field; the play scene pilots well; the
// upgrade scene pilots until the first wave clears; the end scene never
// moves or fires, so the void catches it — as a careless player is.

import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';

const STEP = 1 / 60;
const PLAY_SECONDS = 60;
const UPGRADE_LIMIT_SECONDS = 240;
const END_LIMIT_SECONDS = 300;

/** The autopilot's input for one step: chase the nearest ember, else the
 * nearest enemy; always aim at the nearest enemy and fire. */
function autopilotInput(state) {
  const player = state.player;
  let target = null;
  let targetKind = '';
  for (const ember of state.embers) {
    const d = Math.hypot(ember.x - player.x, ember.y - player.y);
    if (!target || d < target.d) target = { x: ember.x, y: ember.y, d };
    targetKind = 'ember';
  }
  let enemy = null;
  for (const foe of state.enemies) {
    const d = Math.hypot(foe.x - player.x, foe.y - player.y);
    if (!enemy || d < enemy.d) enemy = { x: foe.x, y: foe.y, d };
  }
  let moveX = 0;
  let moveY = 0;
  if (target && (!enemy || target.d < 260)) {
    const d = Math.max(1, target.d);
    moveX = (target.x - player.x) / d;
    moveY = (target.y - player.y) / d;
  } else if (enemy) {
    // Close in until firing range, then hold position and shoot.
    if (enemy.d > 320) {
      const d = Math.max(1, enemy.d);
      moveX = (enemy.x - player.x) / d;
      moveY = (enemy.y - player.y) / d;
    }
  }
  // Keep the action in frame: near an edge, drift back toward the middle
  // instead of chasing a target off-screen.
  const centreX = 640;
  const centreY = 360;
  if (player.x < 260 || player.x > 1020 || player.y < 180 || player.y > 540) {
    const d = Math.max(1, Math.hypot(centreX - player.x, centreY - player.y));
    moveX = (centreX - player.x) / d;
    moveY = (centreY - player.y) / d;
  }
  const aim = enemy ?? { x: player.x, y: player.y - 100 };
  return {
    moveX, moveY,
    aimX: aim.x, aimY: aim.y,
    firing: enemy !== null,
    dash: false,
  };
}

function idleInput(state) {
  return { moveX: 0, moveY: 0, aimX: state.player.x, aimY: state.player.y - 100, firing: false, dash: false };
}

function decorateTitle(world) {
  const state = world.state;
  const spots = [
    [220, 180], [1060, 200], [980, 560], [300, 540], [640, 150], [150, 420],
  ];
  for (const [x, y] of spots) {
    state.embers.push({ x, y, vx: 0, vy: 10, life: 9, spin: 2, phase: 0 });
  }
  const foes = [
    ['mote', 180, 620], ['mote', 1120, 420], ['dart', 1020, 120],
  ];
  for (const [kind, x, y] of foes) {
    state.enemies.push({
      kind, x, y, vx: 0, vy: 0,
      radius: kind === 'dart' ? 12 : 15, hull: 1, speed: 60,
      fireTimer: 2, strafeDir: 1, wobble: 0, hitFlash: 0,
    });
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the upgrade choices to show (only for the upgrade scene).
 */
export function stageShot(name, world, rng) {
  world.reset(0);
  if (name !== 'play' && name !== 'upgrade' && name !== 'end') {
    decorateTitle(world);
    return { screen: SCREEN_TITLE, choices: [] };
  }
  world.begin();
  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'upgrade' ? UPGRADE_LIMIT_SECONDS : PLAY_SECONDS;
  const drive = name === 'end' ? idleInput : autopilotInput;
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, drive(world.state));
    if (name === 'play') {
      if (world.state.waveState === 'clear') {
        // Play through the upgrade into the next wave: wave 2 is denser
        // and makes a far better action frame than the sparse wave 1.
        const picks = world.upgradeChoices();
        world.applyUpgrade(picks[0].id);
        world.nextWave();
        continue;
      }
      if (world.state.wave >= 2 && world.state.score >= 1500 && world.state.enemies.length >= 3 && world.state.bullets.length > 0) {
        return { screen: SCREEN_PLAY, choices: [] };
      }
    }
    if (name === 'upgrade' && world.state.waveState === 'clear') {
      return { screen: SCREEN_UPGRADE, choices: world.upgradeChoices() };
    }
    if (name === 'end' && world.state.waveState === 'clear') {
      // The idle pilot never picks an upgrade; push straight into the next
      // wave so the void eventually catches it.
      world.nextWave();
    }
    if (events & EVENT_OVER) break;
  }
  if (name === 'end' && world.state.over) {
    return { screen: SCREEN_OVER, choices: [] };
  }
  // The end scene's idle pilot should always be caught; if it somehow
  // survives, show the play frame rather than a wrong screen.
  return { screen: SCREEN_PLAY, choices: [] };
}
