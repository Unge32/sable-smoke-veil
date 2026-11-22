// The autopilot: plays the whole heist from the entry door to the getaway, using only the
// world's own state. It follows a waypoint route through all three routes — service corridor,
// balcony, main floor — waits at gates until a patrol is turned away, and drops a smoke veil
// the moment the alarm climbs. The same pilot stages the screenshots and proves the game is
// winnable end to end.

import { STEP } from './config.js';

/** Waypoints: { x, y, gate?, veil? }. A gate is a function of the world state that must be true
 * before the pilot leaves that waypoint. `veil` drops a smoke veil on arrival. */
const ROUTE = [
  { x: 75, y: 645 },
  // Service corridor, low lane between benches and crates. Cross Pip's line only while he walks up.
  { x: 180, y: 600, gate: (s) => guard('Pip', s).dirY < 0 || guard('Pip', s).y < 300 },
  { x: 480, y: 600 },
  { x: 640, y: 648 }, // Ivory Compass pocket between the crates
  { x: 640, y: 600 },
  // Cross Odo's line only while he walks up.
  { x: 900, y: 600, gate: (s) => guard('Odo', s).dirY < 0 || guard('Odo', s).y < 300 },
  { x: 1100, y: 600 },
  { x: 1150, y: 470 }, // Pearl Fan
  { x: 1080, y: 300 },
  { x: 1050, y: 180 }, // right stairs up to the balcony
  { x: 1050, y: 100 },
  // Cross Pip's line on the balcony only once he is far below it.
  { x: 400, y: 100, gate: (s) => guard('Pip', s).y > 400 },
  { x: 110, y: 95 }, // Gilded Scarab
  { x: 230, y: 140 },
  { x: 230, y: 190, gate: (s) => guard('Pip', s).y > 400 }, // left stairs down
  { x: 280, y: 260 },
  // The left camera sweeps this approach to the Sapphire: veil before crossing it.
  { x: 340, y: 230, veil: true },
  { x: 640, y: 206 }, // the Sapphire
  { x: 640, y: 420 },
  // Cross Odo's line on the way out only while he walks up.
  { x: 900, y: 600, gate: (s) => guard('Odo', s).dirY < 0 || guard('Odo', s).y < 300 },
  { x: 1100, y: 600 },
  { x: 1210, y: 645 }, // getaway door
];

function guard(name, state) {
  for (const g of state.guards) if (g.name === name) return g;
  return { dirY: 0, y: 0, x: 0 };
}

/** Pixels of slack before a waypoint counts as reached. */
const ARRIVE = 14;

export function createAutopilot() {
  let index = 0;
  let waiting = 0;

  function reset() {
    index = 0;
    waiting = 0;
  }

  /**
   * Decide one step of input for the world state. Returns { dx, dy, sneak, veil, decoy }.
   * The pilot never sneaks (it plans around patrols instead) and never uses a decoy: veils
   * and timing are enough, which keeps the win reproducible.
   */
  function decide(state) {
    const input = { dx: 0, dy: 0, sneak: false, veil: false, decoy: false };
    if (state.phase !== 'play') return input;
    const thief = state.thief;

    // Emergency veil: the alarm is climbing and a cloud is available. The cloud follows
    // Sable, so the pilot just keeps walking while hidden.
    if (state.alarm.value > 30 && thief.veils > 0 && thief.veilTime <= 0) {
      input.veil = true;
    }

    if (index >= ROUTE.length) return input;
    const wp = ROUTE[index];
    const dx = wp.x - thief.x;
    const dy = wp.y - thief.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= ARRIVE) {
      if (wp.veil && thief.veils > 0 && thief.veilTime <= 0) input.veil = true;
      if (wp.gate && !wp.gate(state)) {
        // Hold position until the patrol turns away. Waiting is free while unseen; if the
        // alarm is somehow climbing, the emergency veil above covers it.
        waiting += STEP;
        return input;
      }
      waiting = 0;
      index += 1;
      return input;
    }
    input.dx = dx / dist;
    input.dy = dy / dist;
    return input;
  }

  return { reset, decide, route: ROUTE };
}
