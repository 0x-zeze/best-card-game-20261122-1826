// TIDECHART DUEL — boot and the one loop: input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. The game moves between five screens: title, play, paused, win and
// loss (game over).
//
// ?shot=title|play|win|loss stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady (and the document title) for
// a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_WIN, EVENT_LOSS, EVENT_PLAY, EVENT_TIDE, PHASE_CHOOSE } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, handRects, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { selected: world.state.selected, hover: -1 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      document.title = 'SHOT-READY';
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastMove = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.state.best = best;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Your deck is your life — mill the rival deck to zero.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.you.damageDealt > best) {
      best = world.state.you.damageDealt;
      saveBest(best);
    }
    announce(won
      ? `You win. Rival deck empty. Damage dealt ${world.state.you.damageDealt}.`
      : `You lose. Your deck ran dry. Damage dealt ${world.state.you.damageDealt}.`);
  }

  function playSelected(index) {
    const events = world.playCard(index);
    if (!(events & EVENT_PLAY)) return;
    audio.play();
    if (world.state.lastDamage && (world.state.lastDamage.toRival > 0 || world.state.lastDamage.toYou > 0)) {
      audio.mill();
    }
    if (events & EVENT_WIN) {
      audio.win();
      endGame(true);
    } else if (events & EVENT_LOSS) {
      audio.lose();
      endGame(false);
    } else {
      announce(world.state.message);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const now = performance.now();
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen !== SCREEN_PLAY) return;
    // Arrow-key selection, throttled so one press moves one card.
    const move = input.selection();
    if (move !== 0 && now - lastMove > 160) {
      const n = world.state.you.hand.length;
      world.state.selected = (world.state.selected + move + n) % n;
      lastMove = now;
    }
    const keyIndex = input.takePlayIndex();
    if (keyIndex >= 0) playSelected(keyIndex);
    else if (actions & ACTION_CONFIRM && world.state.phase === PHASE_CHOOSE) {
      playSelected(world.state.selected);
    }
    const click = input.takeClick();
    if (click) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
        startGame();
        return;
      }
      const rects = handRects(world.state);
      for (const rect of rects) {
        if (click.x >= rect.x && click.x <= rect.x + rect.w && click.y >= rect.y && click.y <= rect.y + rect.h) {
          world.state.selected = rect.index;
          playSelected(rect.index);
          return;
        }
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    const events = world.step(STEP);
    if (events & EVENT_TIDE) announce(world.state.message);
    if (events & EVENT_WIN) {
      audio.win();
      endGame(true);
    } else if (events & EVENT_LOSS) {
      audio.lose();
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, { selected: world.state.selected, hover: -1 });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Tidechart Duel. Press Space or click to start. Your deck is your life.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
