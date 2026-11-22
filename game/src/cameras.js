// The two wall cameras: they sweep their cones back and forth on a fixed cycle and raise the
// alarm while Sable is inside a cone with a clear line of sight. Smoke blinds them.

import { CAMERA } from './config.js';
import { canSee } from './guards.js';

export function createCameraSet(defs) {
  const list = defs.map((def) => ({
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    phase: def.phase,
    angle: def.baseAngle,
    time: def.phase * CAMERA.sweepSeconds,
  }));

  function reset() {
    for (const cam of list) {
      cam.time = cam.phase * CAMERA.sweepSeconds;
      cam.angle = cam.baseAngle;
    }
  }

  function step(dt) {
    for (const cam of list) {
      cam.time += dt;
      const cycle = (cam.time % CAMERA.sweepSeconds) / CAMERA.sweepSeconds;
      cam.angle = cam.baseAngle + Math.sin(cycle * Math.PI * 2) * CAMERA.sweepHalfAngle;
    }
  }

  /** True when any camera currently sees Sable (Sable hidden while the smoke cloud is up). */
  function sees(thief, smoked) {
    for (const cam of list) {
      if (canSee(cam.x, cam.y, cam.angle, CAMERA.sightRange, CAMERA.sightHalfAngle, thief.x, thief.y, smoked)) {
        return true;
      }
    }
    return false;
  }

  return { cameras: list, reset, step, sees };
}
