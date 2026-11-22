// SABLE — Smoke & Sapphire: every tuning number, colour and room measurement in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window, so no
// rule below depends on the screen size. One room, no scrolling: the whole heist fits one frame.

export const FIELD = { width: 1280, height: 720, wall: 24 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 16,
  walkSpeed: 210,
  sneakSpeed: 115,
  /** Seconds of smoke after a veil; the cloud follows Sable. */
  veilSeconds: 6,
  veilsStart: 3,
  veilsMax: 5,
  decoysStart: 3,
  /** Loot points one decoy coin costs. */
  decoyCost: 100,
};

export const GUARD = {
  patrolSpeed: 72,
  chaseSpeed: 152,
  investigateSpeed: 120,
  /** How far a guard can see, in pixels. */
  sightRange: 240,
  /** Half-angle of a guard's vision cone, in radians. */
  sightHalfAngle: (36 * Math.PI) / 180,
  /** Alarm points per second while a guard sees Sable. */
  alarmRate: 48,
  /** Alarm points per second while a guard sees a sneaking Sable. */
  alarmRateSneak: 26,
  /** Seconds a guard waits at each waypoint, sweeping its gaze. */
  pauseSeconds: 0.9,
  /** Radians a pausing guard sweeps its gaze either side of its facing. */
  sweepHalfAngle: (45 * Math.PI) / 180,
  /** Touch distance that catches Sable outright. */
  catchRadius: 30,
  /** Alarm above this makes guards chase Sable's last seen spot. */
  chaseAlarm: 55,
  /** Alarm below this makes a chasing guard give up. */
  calmAlarm: 25,
};

export const CAMERA = {
  sightRange: 280,
  sightHalfAngle: (30 * Math.PI) / 180,
  /** Radians a camera sweeps either side of its base angle. */
  sweepHalfAngle: (42 * Math.PI) / 180,
  /** Seconds for one full sweep cycle. */
  sweepSeconds: 5,
  alarmRate: 36,
  alarmRateSneak: 20,
};

export const ALARM = {
  max: 100,
  /** Points per second the alarm cools down while Sable is unseen. */
  decayRate: 28,
  /** Alarm spike when the Sapphire leaves its pedestal. */
  sapphireSpike: 15,
};

export const LOOT = { sapphire: 1000, trinket: 250 };

export const PALETTE = {
  backdrop: '#0a0c16',
  wall: '#232946',
  wallTrim: '#8f7b4f',
  floor: '#1a1d33',
  floorTile: '#20243d',
  carpet: '#5e1f2d',
  carpetTrim: '#c9a227',
  balcony: '#2a2f52',
  corridor: '#171a2e',
  pedestal: '#3a3f66',
  pedestalTop: '#4a5080',
  caseGlass: '#9fd8e8',
  crate: '#5a4632',
  bench: '#4a3550',
  statue: '#6b6f8f',
  painting: '#c9a227',
  paintingArt: '#3d6b8e',
  door: '#2f6b4f',
  doorGlow: '#7dffb0',
  thief: '#101018',
  thiefCoat: '#2b4acb',
  thiefCoatDark: '#1d3494',
  guard: '#3d3d4d',
  guardUniform: '#4d4d5e',
  guardSkin: '#e8b98a',
  cone: 'rgba(255, 214, 90, 0.16)',
  coneEdge: 'rgba(255, 214, 90, 0.55)',
  coneSeen: 'rgba(255, 70, 70, 0.28)',
  cameraCone: 'rgba(255, 90, 90, 0.13)',
  cameraBody: '#8a2f2f',
  smoke: 'rgba(200, 205, 220, 0.55)',
  smokeEdge: 'rgba(220, 225, 240, 0.35)',
  sapphire: '#4de3ff',
  sapphireGlow: 'rgba(77, 227, 255, 0.35)',
  trinket: '#f2c94c',
  trinketGlow: 'rgba(242, 201, 76, 0.30)',
  panel: '#171a2e',
  panelEdge: '#c9a227',
  text: '#eef1f5',
  muted: '#9aa1b8',
  alarmLow: '#7dffb0',
  alarmMid: '#f2c94c',
  alarmHigh: '#ff5252',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best loot is kept between visits (this browser only). */
export const BEST_KEY = 'sable-smoke-sapphire.best';

/**
 * The Grand Gallery, in room coordinates. Walls are the 24 px border. The balcony is the strip
 * along the top (y < 150), reached only through the two stair gaps in its railing. The service
 * corridor is the lane at y ~600 between the benches and the crates; the trinket pocket sits
 * between the first two crates at y 620..696.
 */
export const ROOM = {
  // Railing segments across y=150 (solid), with stair gaps at x 200..260 and 1020..1080.
  railing: [
    { x: 24, y: 146, width: 176, height: 8 },
    { x: 260, y: 146, width: 760, height: 8 },
    { x: 1080, y: 146, width: 176, height: 8 },
  ],
  // Solid cover: blocks movement and line of sight.
  cover: [
    { x: 610, y: 150, width: 60, height: 40, label: 'Sapphire pedestal' },
    { x: 300, y: 250, width: 70, height: 50, label: 'Pedestal' },
    { x: 910, y: 250, width: 70, height: 50, label: 'Pedestal' },
    { x: 180, y: 380, width: 90, height: 60, label: 'Display case' },
    { x: 1010, y: 380, width: 90, height: 60, label: 'Display case' },
    { x: 605, y: 470, width: 70, height: 70, label: 'Statue' },
    { x: 330, y: 540, width: 120, height: 30, label: 'Bench' },
    { x: 830, y: 540, width: 120, height: 30, label: 'Bench' },
    { x: 420, y: 620, width: 60, height: 50, label: 'Crate' },
    { x: 700, y: 620, width: 60, height: 50, label: 'Crate' },
    { x: 980, y: 620, width: 60, height: 50, label: 'Crate' },
  ],
  // Wall paintings (decoration only, drawn on the wall band).
  paintings: [
    { x: 300, y: 24, width: 120, height: 18 },
    { x: 560, y: 24, width: 160, height: 18 },
    { x: 860, y: 24, width: 120, height: 18 },
    { x: 24, y: 200, width: 18, height: 110 },
    { x: 24, y: 460, width: 18, height: 110 },
    { x: 1238, y: 200, width: 18, height: 110 },
    { x: 1238, y: 460, width: 18, height: 110 },
  ],
  entry: { x: 75, y: 645 },
  exit: { x: 1160, y: 600, width: 96, height: 96 },
  sapphire: { x: 640, y: 196, radius: 36 },
  trinkets: [
    { id: 'scarab', name: 'Gilded Scarab', x: 110, y: 95, radius: 30, labelBelow: true },
    { id: 'fan', name: 'Pearl Fan', x: 1150, y: 470, radius: 30 },
    { id: 'compass', name: 'Ivory Compass', x: 640, y: 648, radius: 30 },
  ],
  guards: [
    {
      name: 'Bram',
      waypoints: [
        { x: 420, y: 380 },
        { x: 860, y: 380 },
      ],
      speed: 75,
    },
    {
      name: 'Pip',
      waypoints: [
        { x: 300, y: 260 },
        { x: 300, y: 560 },
      ],
      speed: 70,
    },
    {
      name: 'Odo',
      waypoints: [
        { x: 980, y: 260 },
        { x: 980, y: 560 },
      ],
      speed: 70,
    },
  ],
  cameras: [
    { x: 56, y: 300, baseAngle: 0, phase: 0 },
    { x: 1224, y: 300, baseAngle: Math.PI, phase: 0.5 },
  ],
};
