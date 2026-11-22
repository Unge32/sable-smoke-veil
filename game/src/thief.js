// Sable the thief: movement, sneak, collision against walls, railing and cover, and the
// smoke veil / decoy tools. No drawing and no browser here — pure state and geometry.

import { FIELD, ROOM, THIEF } from './config.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Push a circle out of a solid rectangle; returns nothing, mutates the position in place. */
function pushOutOfRect(pos, radius, rect) {
  const nearestX = clamp(pos.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(pos.y, rect.y, rect.y + rect.height);
  const dx = pos.x - nearestX;
  const dy = pos.y - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= radius * radius) return;
  if (distSq === 0) {
    // Centre inside the rect: push out along the smallest penetration.
    const left = pos.x - rect.x;
    const right = rect.x + rect.width - pos.x;
    const top = pos.y - rect.y;
    const bottom = rect.y + rect.height - pos.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) pos.x = rect.x - radius;
    else if (min === right) pos.x = rect.x + rect.width + radius;
    else if (min === top) pos.y = rect.y - radius;
    else pos.y = rect.y + rect.height + radius;
    return;
  }
  const dist = Math.sqrt(distSq);
  pos.x = nearestX + (dx / dist) * radius;
  pos.y = nearestY + (dy / dist) * radius;
}

export function createThief() {
  const pos = { x: ROOM.entry.x, y: ROOM.entry.y };
  const state = {
    x: pos.x,
    y: pos.y,
    radius: THIEF.radius,
    sneaking: false,
    moving: false,
    /** Radians Sable faces (for the decoy toss); defaults to facing right. */
    facing: 0,
    veils: THIEF.veilsStart,
    decoys: THIEF.decoysStart,
    /** Seconds of smoke cloud left (0 = no cloud). The cloud follows Sable. */
    veilTime: 0,
    /** Where the last veil was dropped — the nearest guard investigates this spot. */
    veilDrop: null,
    /** Active decoy coin: { x, y, timeLeft } or null. */
    decoy: null,
  };

  function reset() {
    state.x = ROOM.entry.x;
    state.y = ROOM.entry.y;
    state.sneaking = false;
    state.moving = false;
    state.facing = 0;
    state.veils = THIEF.veilsStart;
    state.decoys = THIEF.decoysStart;
    state.veilTime = 0;
    state.veilDrop = null;
    state.decoy = null;
  }

  function collide() {
    const r = state.radius;
    const wall = FIELD.wall;
    state.x = clamp(state.x, wall + r, FIELD.width - wall - r);
    state.y = clamp(state.y, wall + r, FIELD.height - wall - r);
    const pos = { x: state.x, y: state.y };
    for (const rect of ROOM.railing) pushOutOfRect(pos, r, rect);
    for (const rect of ROOM.cover) pushOutOfRect(pos, r, rect);
    state.x = pos.x;
    state.y = pos.y;
  }

  /**
   * Move Sable one step. `input` is { dx, dy, sneak } with dx/dy in [-1, 1].
   * Returns true when Sable actually moved.
   */
  function move(dt, input) {
    const length = Math.hypot(input.dx, input.dy);
    state.sneaking = !!input.sneak;
    if (length < 0.01) {
      state.moving = false;
      return false;
    }
    const speed = state.sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
    const nx = input.dx / length;
    const ny = input.dy / length;
    state.x += nx * speed * dt;
    state.y += ny * speed * dt;
    state.facing = Math.atan2(ny, nx);
    state.moving = true;
    collide();
    return true;
  }

  /** Spend one veil if any remain; returns true when a cloud starts. */
  function useVeil() {
    if (state.veils <= 0 || state.veilTime > 0) return false;
    state.veils -= 1;
    state.veilTime = THIEF.veilSeconds;
    state.veilDrop = { x: state.x, y: state.y };
    return true;
  }

  /**
   * Toss a decoy coin ahead of Sable. Costs loot points (checked by the caller through the
   * score) and one decoy. Returns the landing spot, or null when no decoy is left.
   */
  function useDecoy() {
    if (state.decoys <= 0) return null;
    state.decoys -= 1;
    const spot = {
      x: clamp(state.x + Math.cos(state.facing) * 170, FIELD.wall + 20, FIELD.width - FIELD.wall - 20),
      y: clamp(state.y + Math.sin(state.facing) * 170, FIELD.wall + 20, FIELD.height - FIELD.wall - 20),
    };
    state.decoy = { x: spot.x, y: spot.y, timeLeft: 4 };
    return spot;
  }

  function tick(dt) {
    if (state.veilTime > 0) state.veilTime = Math.max(0, state.veilTime - dt);
    if (state.decoy) {
      state.decoy.timeLeft -= dt;
      if (state.decoy.timeLeft <= 0) state.decoy = null;
    }
  }

  return { state, reset, move, useVeil, useDecoy, tick };
}
