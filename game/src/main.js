// EMBERDRIFT — the entry point: the animation loop, the screen state machine
// (title → play → upgrade → play … → over → title), input wiring and the
// ?shot= hook the screenshots use. The simulation itself lives in world.js;
// this file only decides which screen is showing and what input reaches it.

import { FIELD } from './config.js';
import { makeRng } from './random.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import {
  createWorld,
  EVENT_KILL, EVENT_EMBER, EVENT_HURT, EVENT_WAVE, EVENT_CLEAR,
  EVENT_OVER, EVENT_DASH, EVENT_HIT,
} from './world.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_UPGRADE, SCREEN_PAUSED, SCREEN_OVER } from './render.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'emberdrift-best-score';
const STEP = 1 / 60;

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Storage may be unavailable (private mode); the game plays on regardless.
  }
}

function readMove(input) {
  let x = 0;
  let y = 0;
  if (input.held('a', 'ArrowLeft')) x -= 1;
  if (input.held('d', 'ArrowRight')) x += 1;
  if (input.held('w', 'ArrowUp')) y -= 1;
  if (input.held('s', 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

export function startGame(canvas) {
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  const seed = Number(params.get('seed') ?? 1) || 1;
  const rng = makeRng(seed * 2654435761);
  const audio = createAudio();
  const input = createInput(canvas);
  const world = createWorld(rng);
  const renderer = createRenderer(canvas);
  const ctx = canvas.getContext('2d');

  let best = loadBest();
  let screen = SCREEN_TITLE;
  let choices = [];
  let accumulator = 0;
  let lastTime = performance.now();
  let shotStaged = false;

  world.reset(best);

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = FIELD.width;
    canvas.height = FIELD.height;
    canvas.style.width = `${FIELD.width * scale}px`;
    canvas.style.height = `${FIELD.height * scale}px`;
    input.setViewport(scale, (window.innerWidth - FIELD.width * scale) / 2, (window.innerHeight - FIELD.height * scale) / 2);
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  function handleEvents(events) {
    if (events & EVENT_KILL) audio.explode();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_EMBER) audio.ember();
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_WAVE) audio.wave();
    if (events & EVENT_CLEAR) audio.upgrade();
    if (events & EVENT_OVER) audio.gameOver();
  }

  function launch() {
    audio.unlock();
    world.reset(best);
    handleEvents(world.begin());
    screen = SCREEN_PLAY;
  }

  function frame(now) {
    const elapsed = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    accumulator += elapsed;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      accumulator -= STEP;
      guard += 1;
      stepOnce();
    }
    if (guard === 8) accumulator = 0;
    renderer.draw(world.state, screen, { best, choices });
    input.endStep();
    requestAnimationFrame(frame);
  }

  function stepOnce() {
    if (shotName) {
      // Screenshot mode: stage one deterministic frame, then hold it still
      // so the captured image is exactly the staged scene.
      if (!shotStaged) {
        const staged = stageShot(shotName, world, rng);
        screen = staged.screen;
        choices = staged.choices;
        shotStaged = true;
      }
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (input.wasPressed('Enter', ' ') || input.wasClicked()) launch();
      if (input.wasPressed('m')) audio.toggleMute();
      return;
    }
    if (screen === SCREEN_OVER) {
      if (input.wasPressed('r', 'R', 'Enter', ' ') || input.wasClicked()) {
        world.reset(best);
        screen = SCREEN_TITLE;
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (input.wasPressed('p', 'P', 'Escape') || input.wasClicked()) screen = SCREEN_PLAY;
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      const keys = ['1', '2', '3'];
      for (let i = 0; i < choices.length; i += 1) {
        if (input.wasPressed(keys[i])) {
          chooseUpgrade(i);
          return;
        }
      }
      if (input.wasClicked()) {
        const card = cardAt(input.mouse.x, input.mouse.y);
        if (card >= 0) chooseUpgrade(card);
      }
      return;
    }
    // SCREEN_PLAY
    if (input.wasPressed('p', 'P', 'Escape')) {
      screen = SCREEN_PAUSED;
      return;
    }
    if (input.wasPressed('m')) audio.toggleMute();
    const move = readMove(input);
    const events = world.step(STEP, {
      moveX: move.x,
      moveY: move.y,
      aimX: input.mouse.x,
      aimY: input.mouse.y,
      firing: input.mouse.down || input.held(' '),
      dash: input.wasPressed('Shift'),
    });
    handleEvents(events);
    if (world.state.waveState === 'clear') {
      choices = world.upgradeChoices();
      screen = SCREEN_UPGRADE;
    }
    if (world.state.over) {
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      screen = SCREEN_OVER;
    }
  }

  function cardAt(x, y) {
    const cardW = 300;
    const gap = 30;
    const total = cardW * 3 + gap * 2;
    const startX = (FIELD.width - total) / 2;
    if (y < 230 || y > 450) return -1;
    for (let i = 0; i < 3; i += 1) {
      const cardX = startX + i * (cardW + gap);
      if (x >= cardX && x <= cardX + cardW) return i;
    }
    return -1;
  }

  function chooseUpgrade(index) {
    const choice = choices[index];
    if (!choice) return;
    world.applyUpgrade(choice.id);
    audio.upgrade();
    world.nextWave();
    screen = SCREEN_PLAY;
  }

  // A small read-only handle for automated play-testing: the test harness
  // reads state and can drive the ship without touching the DOM.
  window.EMBERDRIFT = {
    get state() {
      return world.state;
    },
    get screen() {
      return screen;
    },
    get best() {
      return best;
    },
    launch,
    world,
    input,
  };

  requestAnimationFrame(frame);
}

const canvas = document.getElementById('game');
startGame(canvas);
