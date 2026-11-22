// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, caught and clean getaway.
//
// ?seed=N fixes the run (the patrols are deterministic; the seed is accepted for symmetry with
// the starter). ?shot=start|play|veil|getaway (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
// ?auto=1 starts the game with the autopilot playing, so a headless run can prove the heist
// end to end.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_CAUGHT, EVENT_DECOY, EVENT_ESCAPED, EVENT_LOOT, EVENT_SAPPHIRE, EVENT_SEEN, EVENT_VEIL } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_DECOY,
  ACTION_PAUSE,
  ACTION_VEIL,
  createInput,
} from './input.js';
import {
  createRenderer,
  SCREEN_ESCAPED,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
} from './render.js';
import { stageShot } from './shots.js';
import { createAutopilot } from './autopilot.js';
import { sfx, unlockAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const auto = params.get('auto') === '1';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const pilot = createAutopilot();

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
    // Storage can be off (private windows): the best loot then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let spottedAnnounced = false;

  // Exposed for the headless playtest: state, world and pilot, nothing else.
  window.__game = { state: () => screen, world, pilot };

  // Screen readers (and anyone watching the page's text) hear the screen changes and each catch.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    pilot.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the Sapphire, then reach the green OUT door.');
  }

  function endGame(escaped) {
    screen = escaped ? SCREEN_ESCAPED : SCREEN_OVER;
    if (world.state.score.value > best) {
      best = world.state.score.value;
      saveBest(best);
    }
    announce(
      escaped
        ? `Clean getaway. Loot $${world.state.score.value}. Best $${best}.`
        : `Caught. Loot $${world.state.score.value}. Best $${best}.`,
    );
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_ESCAPED)) {
      unlockAudio();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      // The gallery idles behind the title: guards walk their patrols, nothing scores.
      world.step(STEP, { dx: 0, dy: 0, sneak: false, veil: false, decoy: false });
      return;
    }
    let move;
    if (auto) {
      move = pilot.decide(world.state);
    } else {
      const dir = input.direction();
      move = {
        dx: dir.dx,
        dy: dir.dy,
        sneak: input.sneaking(),
        veil: !!(actions & ACTION_VEIL),
        decoy: !!(actions & ACTION_DECOY),
      };
    }
    const events = world.step(STEP, move);
    if (events & EVENT_VEIL) sfx.veil();
    if (events & EVENT_DECOY) sfx.decoy();
    if (events & EVENT_LOOT) sfx.pickup();
    if (events & EVENT_SAPPHIRE) sfx.sapphire();
    if (events & EVENT_SEEN && !spottedAnnounced) {
      sfx.spotted();
      spottedAnnounced = true;
    } else if (!(events & EVENT_SEEN)) {
      spottedAnnounced = false;
    }
    sfx.alarmDrone(world.state.alarm.value);
    if (events & EVENT_CAUGHT) {
      sfx.caught();
      endGame(false);
    } else if (events & EVENT_ESCAPED) {
      sfx.escaped();
      endGame(true);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the alarm climb unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  if (auto) startGame();
  announce('SABLE — Smoke and Sapphire. Press Enter or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
