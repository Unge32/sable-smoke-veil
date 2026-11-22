// The alarm meter, 0–100. It climbs while any guard or camera sees Sable — about 1.5 to 2.5
// seconds of exposure to reach 100 — and cools down while Sable is unseen. At 100 Sable is caught.

import { ALARM } from './config.js';

export function createAlarm() {
  const state = { value: 0, seen: false, seenBy: null };

  function reset() {
    state.value = 0;
    state.seen = false;
    state.seenBy = null;
  }

  /**
   * One step. `rate` is the alarm points per second while seen (0 when unseen).
   * Returns true the moment the meter hits 100.
   */
  function step(dt, rate, seenBy) {
    state.seen = rate > 0;
    state.seenBy = state.seen ? seenBy : null;
    if (state.seen) state.value = Math.min(ALARM.max, state.value + rate * dt);
    else state.value = Math.max(0, state.value - ALARM.decayRate * dt);
    return state.value >= ALARM.max;
  }

  function spike(amount) {
    state.value = Math.min(ALARM.max, state.value + amount);
    return state.value >= ALARM.max;
  }

  return { state, reset, step, spike };
}
