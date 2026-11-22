// The world: Sable, the guards, the cameras, the loot and the alarm, stepped together in fixed
// 1/60 s steps. No drawing and no browser in here — step() takes the player's input and returns
// what happened as bit flags, so the caller can react (sound, announcements) without the world
// knowing about screens.

import { ALARM, CAMERA, FIELD, GUARD, LOOT, ROOM, STEP, THIEF } from './config.js';
import { createThief } from './thief.js';
import { canSee, createGuards } from './guards.js';
import { createCameraSet } from './cameras.js';
import { createLoot } from './loot.js';
import { createAlarm } from './alarm.js';

export const EVENT_SEEN = 1;
export const EVENT_LOOT = 2;
export const EVENT_SAPPHIRE = 4;
export const EVENT_VEIL = 8;
export const EVENT_DECOY = 16;
export const EVENT_CAUGHT = 32;
export const EVENT_ESCAPED = 64;

/** Input for one step: move direction, sneak, and edge-triggered veil / decoy presses. */
export function emptyInput() {
  return { dx: 0, dy: 0, sneak: false, veil: false, decoy: false };
}

export function createWorld() {
  const thief = createThief();
  const guardSet = createGuards();
  const cameraSet = createCameraSet(ROOM.cameras);
  const loot = createLoot();
  const alarm = createAlarm();
  const score = { value: 0 };

  const state = {
    thief: thief.state,
    guards: guardSet.guards,
    cameras: cameraSet.cameras,
    loot: loot.state,
    alarm: alarm.state,
    score,
    /** play | caught | escaped */
    phase: 'play',
    elapsed: 0,
    lastSeen: null,
  };

  function reset() {
    thief.reset();
    guardSet.reset();
    cameraSet.reset();
    loot.reset();
    alarm.reset();
    score.value = 0;
    state.phase = 'play';
    state.elapsed = 0;
    state.lastSeen = null;
  }

  /**
   * One fixed step. Returns event flags. Once the phase is caught or escaped the world stops
   * advancing (the renderer keeps painting the frozen frame).
   */
  function step(dt, input) {
    if (state.phase !== 'play') return 0;
    let events = 0;
    state.elapsed += dt;

    thief.move(dt, input);
    thief.tick(dt);
    cameraSet.step(dt);

    if (input.veil && thief.useVeil()) {
      guardSet.investigate({ x: thief.state.veilDrop.x, y: thief.state.veilDrop.y });
      events |= EVENT_VEIL;
    }
    if (input.decoy && thief.state.decoys > 0 && score.value >= THIEF.decoyCost) {
      const spot = thief.useDecoy();
      if (spot) {
        score.value -= THIEF.decoyCost;
        guardSet.investigate(spot);
        events |= EVENT_DECOY;
      }
    }

    // Detection: guards and cameras, each with its own rate; smoke hides Sable outright.
    const smoked = thief.state.veilTime > 0;
    const sneak = thief.state.sneaking;
    let rate = 0;
    let seenBy = null;
    for (const guard of guardSet.guards) {
      if (canSee(guard.x, guard.y, guard.facing, GUARD.sightRange, GUARD.sightHalfAngle, thief.state.x, thief.state.y, smoked)) {
        const guardRate = sneak ? GUARD.alarmRateSneak : GUARD.alarmRate;
        if (guardRate > rate) {
          rate = guardRate;
          seenBy = guard.name;
        }
      }
    }
    if (cameraSet.sees(thief.state, smoked)) {
      const cameraRate = sneak ? CAMERA.alarmRateSneak : CAMERA.alarmRate;
      if (cameraRate > rate) {
        rate = cameraRate;
        seenBy = 'Camera';
      }
    }
    if (rate > 0) state.lastSeen = { x: thief.state.x, y: thief.state.y };

    const alarmFull = alarm.step(dt, rate, seenBy);
    if (rate > 0) events |= EVENT_SEEN;

    const touched = guardSet.step(dt, {
      thief: thief.state,
      alarm: alarm.state.value,
      lastSeen: state.lastSeen,
    });

    const picked = loot.collect(thief.state, score);
    if (picked === 'sapphire') {
      events |= EVENT_SAPPHIRE;
      if (alarm.spike(ALARM.sapphireSpike)) {
        state.phase = 'caught';
        return events | EVENT_CAUGHT;
      }
    } else if (picked === 'trinket') {
      events |= EVENT_LOOT;
      if (thief.state.veils < THIEF.veilsMax) thief.state.veils += 1;
    }

    if (alarmFull || (touched && thief.state.veilTime <= 0)) {
      state.phase = 'caught';
      return events | EVENT_CAUGHT;
    }
    if (loot.atExit(thief.state)) {
      state.phase = 'escaped';
      return events | EVENT_ESCAPED;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}

export { FIELD, LOOT, STEP };
