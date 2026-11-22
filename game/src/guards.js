// The three patrol guards: Bram, Pip and Odo. Each walks its waypoints, pauses at each end to
// sweep its gaze, investigates smoke and decoys, and chases Sable's last seen spot when the
// alarm runs high. Detection is a cone test with line-of-sight blocking (cover rectangles).

import { GUARD, ROOM } from './config.js';

/** True when the segment (x1,y1)-(x2,y2) touches any solid cover rectangle. */
export function segmentBlocked(x1, y1, x2, y2) {
  for (const rect of ROOM.cover) {
    if (segmentHitsRect(x1, y1, x2, y2, rect)) return true;
  }
  return false;
}

function segmentHitsRect(x1, y1, x2, y2, rect) {
  // Trivial reject: both ends on one side of the rect.
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (maxX < rect.x || minX > rect.x + rect.width || maxY < rect.y || minY > rect.y + rect.height) return false;
  if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) return true;
  return (
    segmentsCross(x1, y1, x2, y2, rect.x, rect.y, rect.x + rect.width, rect.y) ||
    segmentsCross(x1, y1, x2, y2, rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height) ||
    segmentsCross(x1, y1, x2, y2, rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height) ||
    segmentsCross(x1, y1, x2, y2, rect.x, rect.y + rect.height, rect.x, rect.y)
  );
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Smallest absolute angle between two headings, in radians. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * Cone test: can an eye at (ex,ey) facing `facing` see a target at (tx,ty)?
 * Range, half-angle and cover blocking all apply. Smoke hides the target outright.
 */
export function canSee(ex, ey, facing, range, halfAngle, tx, ty, smoked) {
  if (smoked) return false;
  const dx = tx - ex;
  const dy = ty - ey;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1) return true;
  if (angleDiff(Math.atan2(dy, dx), facing) > halfAngle) return false;
  return !segmentBlocked(ex, ey, tx, ty);
}

export function createGuards() {
  const guards = ROOM.guards.map((def) => ({
    name: def.name,
    x: def.waypoints[0].x,
    y: def.waypoints[0].y,
    waypoints: def.waypoints,
    wpIndex: 1,
    speed: def.speed,
    /** patrol | pause | investigate | chase */
    mode: 'patrol',
    facing: 0,
    baseFacing: 0,
    pauseTime: 0,
    sweepPhase: 0,
    investigate: null,
    chaseTarget: null,
    /** -1 / 0 / 1: vertical travel direction, used by the autopilot's gates. */
    dirY: 0,
    alerted: false,
  }));

  function reset() {
    for (const guard of guards) {
      guard.x = guard.waypoints[0].x;
      guard.y = guard.waypoints[0].y;
      guard.wpIndex = 1;
      guard.mode = 'patrol';
      guard.facing = 0;
      guard.baseFacing = 0;
      guard.pauseTime = 0;
      guard.sweepPhase = 0;
      guard.investigate = null;
      guard.chaseTarget = null;
      guard.dirY = 0;
      guard.alerted = false;
    }
  }

  function moveToward(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    const step = Math.min(dist, speed * dt);
    guard.x += (dx / dist) * step;
    guard.y += (dy / dist) * step;
    guard.facing = Math.atan2(dy, dx);
    guard.dirY = dy === 0 ? 0 : Math.sign(dy);
    return dist - step < 6;
  }

  /**
   * One step for every guard. `world` carries Sable's position, the alarm level, the active
   * smoke and decoy, and the last spot Sable was seen. Returns true when any guard touches Sable.
   */
  function step(dt, world) {
    let caught = false;
    for (const guard of guards) {
      if (guard.mode === 'patrol' || guard.mode === 'pause') {
        if (guard.mode === 'patrol') {
          const target = guard.waypoints[guard.wpIndex];
          if (moveToward(guard, target.x, target.y, guard.speed, dt)) {
            guard.mode = 'pause';
            guard.pauseTime = GUARD.pauseSeconds;
            guard.sweepPhase = 0;
            guard.baseFacing = guard.facing;
            guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
          }
        } else {
          guard.pauseTime -= dt;
          guard.sweepPhase += dt;
          // Sweep the gaze back and forth around the facing held when the pause began.
          guard.facing =
            guard.baseFacing +
            Math.sin((guard.sweepPhase / GUARD.pauseSeconds) * Math.PI * 2) * GUARD.sweepHalfAngle * 0.9;
          if (guard.pauseTime <= 0) {
            guard.mode = 'patrol';
            guard.facing = Math.atan2(
              guard.waypoints[guard.wpIndex].y - guard.y,
              guard.waypoints[guard.wpIndex].x - guard.x,
            );
          }
        }
      } else if (guard.mode === 'investigate') {
        const spot = guard.investigate;
        // Stop a little short of the spot and look around: walking onto the exact spot would
        // let a guard blunder straight into Sable standing in her own smoke.
        const dist = spot ? Math.hypot(spot.x - guard.x, spot.y - guard.y) : 0;
        if (!spot || dist < 70 || moveToward(guard, spot.x, spot.y, GUARD.investigateSpeed, dt)) {
          guard.mode = 'pause';
          guard.pauseTime = GUARD.pauseSeconds * 2;
          guard.sweepPhase = 0;
          guard.baseFacing = guard.facing;
          guard.investigate = null;
        }
      } else if (guard.mode === 'chase') {
        const spot = guard.chaseTarget ?? world.lastSeen;
        if (spot) moveToward(guard, spot.x, spot.y, GUARD.chaseSpeed, dt);
        if (world.alarm < GUARD.calmAlarm) {
          guard.mode = 'patrol';
          guard.chaseTarget = null;
        }
      }

      // A guard that spots Sable raises the alarm through the world; chasing starts there.
      if (world.alarm >= GUARD.chaseAlarm && guard.mode !== 'chase' && world.lastSeen) {
        guard.mode = 'chase';
        guard.chaseTarget = { x: world.lastSeen.x, y: world.lastSeen.y };
      }

      const dist = Math.hypot(world.thief.x - guard.x, world.thief.y - guard.y);
      if (dist < GUARD.catchRadius) caught = true;
    }
    return caught;
  }

  /** The nearest guard walks to `spot` to look around (smoke drop or decoy coin). */
  function investigate(spot) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const guard of guards) {
      if (guard.mode === 'chase') continue;
      const dist = Math.hypot(spot.x - guard.x, spot.y - guard.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = guard;
      }
    }
    if (nearest) {
      nearest.mode = 'investigate';
      nearest.investigate = { x: spot.x, y: spot.y };
    }
  }

  return { guards, reset, step, investigate };
}
