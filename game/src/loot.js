// The loot: the Sapphire of the Tide on its pedestal (mandatory) and three optional trinkets.
// A trinket pays loot points and one extra smoke veil. Taking the Sapphire spikes the alarm and
// opens the getaway door.

import { LOOT, ROOM } from './config.js';

export function createLoot() {
  const state = {
    sapphireTaken: false,
    trinkets: ROOM.trinkets.map((def) => ({ ...def, taken: false })),
    trinketsTaken: 0,
  };

  function reset() {
    state.sapphireTaken = false;
    state.trinketsTaken = 0;
    for (const trinket of state.trinkets) trinket.taken = false;
  }

  /**
   * Pick up whatever Sable stands on. Returns 'sapphire', 'trinket' or null.
   * `score` is the loot total, mutated here so a trinket pays at once.
   */
  function collect(thief, score) {
    if (!state.sapphireTaken) {
      const dx = thief.x - ROOM.sapphire.x;
      const dy = thief.y - ROOM.sapphire.y;
      if (Math.hypot(dx, dy) <= ROOM.sapphire.radius + thief.radius) {
        state.sapphireTaken = true;
        score.value += LOOT.sapphire;
        return 'sapphire';
      }
    }
    for (const trinket of state.trinkets) {
      if (trinket.taken) continue;
      const dx = thief.x - trinket.x;
      const dy = thief.y - trinket.y;
      if (Math.hypot(dx, dy) <= trinket.radius + thief.radius) {
        trinket.taken = true;
        state.trinketsTaken += 1;
        score.value += LOOT.trinket;
        return 'trinket';
      }
    }
    return null;
  }

  /** True when Sable stands in the getaway door with the Sapphire in hand. */
  function atExit(thief) {
    if (!state.sapphireTaken) return false;
    const exit = ROOM.exit;
    return (
      thief.x >= exit.x &&
      thief.x <= exit.x + exit.width &&
      thief.y >= exit.y &&
      thief.y <= exit.y + exit.height
    );
  }

  return { state, reset, collect, atExit };
}
