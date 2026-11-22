// The screenshot scenes behind ?shot=start|play|veil|getaway. Each one plays the real rules
// forward from a fresh world, steered by the same autopilot that proves the heist is winnable,
// so every frame is what a real game looks like and the same seed always gives the same frame.
//
//   start   — title panel over the gallery at rest.
//   play    — mid-heist, Sable deep in the gallery with the alarm climbing.
//   veil    — the smoke veil up, Sable hidden in the cloud, a guard coming to investigate.
//   getaway — the clean getaway screen after the autopilot steals the Sapphire and escapes.
import { STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_ESCAPED, EVENT_VEIL } from './world.js';
import { SCREEN_ESCAPED, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAutopilot } from './autopilot.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 16;
const LIMIT_SECONDS = 600;

export function stageShot(name, world) {
  const pilot = createAutopilot();
  world.reset();
  pilot.reset();
  if (name !== 'play' && name !== 'veil' && name !== 'getaway') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { dx: 0, dy: 0, sneak: false, veil: false, decoy: false });
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  let veiledAt = -1;
  let playedSeconds = 0;
  for (let index = 0; index < LIMIT_SECONDS / STEP; index += 1) {
    const input = pilot.decide(world.state);
    const events = world.step(STEP, input);
    playedSeconds += STEP;
    if (events & EVENT_VEIL) veiledAt = playedSeconds;
    if (name === 'veil' && veiledAt >= 0 && playedSeconds - veiledAt >= 1.5) break;
    if (name === 'play' && playedSeconds >= PLAY_SECONDS) break;
    if (events & (EVENT_CAUGHT | EVENT_ESCAPED)) break;
  }

  if (name === 'getaway') {
    const escaped = world.state.phase === 'escaped';
    return { screen: escaped ? SCREEN_ESCAPED : SCREEN_OVER, best: world.state.score.value };
  }
  return { screen: SCREEN_PLAY, best: world.state.score.value };
}
