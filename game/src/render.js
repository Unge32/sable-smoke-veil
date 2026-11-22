// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. One room,
// no scrolling: walls, balcony, service corridor, cover, cones, loot, Sable and the alarm meter
// are all visible in a single frame.

import { CAMERA, FIELD, FONT, GUARD, PALETTE, ROOM } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_ESCAPED = 'escaped';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const lootLabel = cachedLabel('LOOT $');
  const veilLabel = cachedLabel('SMOKE ×');
  const decoyLabel = cachedLabel('DECOY ×');
  const trinketLabel = cachedLabel('TRINKETS ');
  const timeLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function sector(x, y, facing, range, halfAngle, fill, edge) {
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, facing - halfAngle, facing + halfAngle);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    if (edge) {
      context.strokeStyle = edge;
      context.lineWidth = 1.5;
      context.stroke();
    }
  }

  function drawRoom(state) {
    const wall = FIELD.wall;
    // Floor.
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Floor tiles.
    context.fillStyle = PALETTE.floorTile;
    for (let x = wall; x < FIELD.width - wall; x += 80) {
      for (let y = wall; y < FIELD.height - wall; y += 80) {
        if (((x + y) / 80) % 2 === 0) context.fillRect(x + 2, y + 2, 76, 76);
      }
    }
    // Balcony zone (top strip) and service corridor (bottom lane).
    context.fillStyle = PALETTE.balcony;
    context.fillRect(wall, wall, FIELD.width - wall * 2, 150 - wall);
    context.fillStyle = PALETTE.corridor;
    context.fillRect(wall, 596, FIELD.width - wall * 2, FIELD.height - wall - 596);
    // Red carpet down the main floor.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(560, 190, 160, 406);
    context.fillStyle = PALETTE.carpetTrim;
    context.fillRect(560, 190, 4, 406);
    context.fillRect(716, 190, 4, 406);
    // Route labels, so the three routes read at a glance.
    context.textBaseline = 'alphabetic';
    text('— BALCONY —', FIELD.width / 2, 66, 15, PALETTE.muted, 'center');
    text('SERVICE CORRIDOR', 140, 692, 13, PALETTE.muted, 'left');
    text('MAIN FLOOR', FIELD.width / 2, 470, 13, 'rgba(238,241,245,0.35)', 'center');

    // Walls.
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, wall);
    context.fillRect(0, FIELD.height - wall, FIELD.width, wall);
    context.fillRect(0, 0, wall, FIELD.height);
    context.fillRect(FIELD.width - wall, 0, wall, FIELD.height);
    context.fillStyle = PALETTE.wallTrim;
    context.fillRect(0, wall, FIELD.width, 3);
    context.fillRect(0, FIELD.height - wall - 3, FIELD.width, 3);
    context.fillRect(wall, 0, 3, FIELD.height);
    context.fillRect(FIELD.width - wall - 3, 0, 3, FIELD.height);
    // Paintings on the walls.
    for (const painting of ROOM.paintings) {
      context.fillStyle = PALETTE.painting;
      context.fillRect(painting.x, painting.y, painting.width, painting.height);
      context.fillStyle = PALETTE.paintingArt;
      context.fillRect(painting.x + 3, painting.y + 3, painting.width - 6, painting.height - 6);
    }
    // Balcony railing (with its two stair gaps).
    context.fillStyle = PALETTE.wallTrim;
    for (const rail of ROOM.railing) context.fillRect(rail.x, rail.y, rail.width, rail.height);
    // Stair hints at the gaps.
    context.fillStyle = 'rgba(238,241,245,0.25)';
    context.fillRect(200, 154, 60, 6);
    context.fillRect(200, 166, 60, 6);
    context.fillRect(1020, 154, 60, 6);
    context.fillRect(1020, 166, 60, 6);

    // Doors: entry bottom-left, getaway bottom-right (glows once the Sapphire is taken).
    context.fillStyle = PALETTE.door;
    context.fillRect(36, 648, 76, 48);
    text('IN', 74, 678, 15, PALETTE.text, 'center');
    if (state.loot.sapphireTaken) {
      context.fillStyle = PALETTE.doorGlow;
      context.fillRect(1168, 648, 76, 48);
      context.fillStyle = '#0a2e1a';
      text('OUT', 1206, 678, 15, '#0a2e1a', 'center');
    } else {
      context.fillStyle = '#1d2b23';
      context.fillRect(1168, 648, 76, 48);
      context.fillStyle = PALETTE.muted;
      text('LOCKED', 1206, 678, 13, PALETTE.muted, 'center');
    }
  }

  function drawCover() {
    for (const rect of ROOM.cover) {
      if (rect.label === 'Sapphire pedestal') {
        context.fillStyle = PALETTE.pedestal;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.fillStyle = PALETTE.pedestalTop;
        context.fillRect(rect.x - 4, rect.y - 6, rect.width + 8, 10);
      } else if (rect.label === 'Display case') {
        context.fillStyle = PALETTE.pedestal;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.fillStyle = PALETTE.caseGlass;
        context.globalAlpha = 0.35;
        context.fillRect(rect.x + 6, rect.y + 6, rect.width - 12, rect.height - 12);
        context.globalAlpha = 1;
      } else if (rect.label === 'Statue') {
        context.fillStyle = PALETTE.statue;
        context.beginPath();
        context.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, 26, 0, Math.PI * 2);
        context.fill();
        context.fillRect(rect.x + 8, rect.y + rect.height - 16, rect.width - 16, 16);
      } else if (rect.label === 'Bench') {
        context.fillStyle = PALETTE.bench;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
      } else if (rect.label === 'Crate') {
        context.fillStyle = PALETTE.crate;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.strokeStyle = 'rgba(0,0,0,0.4)';
        context.lineWidth = 2;
        context.strokeRect(rect.x + 4, rect.y + 4, rect.width - 8, rect.height - 8);
      } else {
        context.fillStyle = PALETTE.pedestal;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.fillStyle = PALETTE.pedestalTop;
        context.fillRect(rect.x, rect.y, rect.width, 8);
      }
    }
  }

  function drawLoot(state) {
    // The Sapphire: a glowing gem above its pedestal.
    if (!state.loot.sapphireTaken) {
      const pulse = 0.7 + 0.3 * Math.sin(state.elapsed * 4);
      context.fillStyle = PALETTE.sapphireGlow;
      context.globalAlpha = pulse;
      context.beginPath();
      context.arc(ROOM.sapphire.x, ROOM.sapphire.y, 30, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = PALETTE.sapphire;
      context.beginPath();
      context.moveTo(ROOM.sapphire.x, ROOM.sapphire.y - 16);
      context.lineTo(ROOM.sapphire.x + 13, ROOM.sapphire.y);
      context.lineTo(ROOM.sapphire.x, ROOM.sapphire.y + 16);
      context.lineTo(ROOM.sapphire.x - 13, ROOM.sapphire.y);
      context.closePath();
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(ROOM.sapphire.x - 4, ROOM.sapphire.y - 5, 3, 0, Math.PI * 2);
      context.fill();
      text('SAPPHIRE', ROOM.sapphire.x, ROOM.sapphire.y - 26, 13, PALETTE.sapphire, 'center');
    }
    for (const trinket of state.loot.trinkets) {
      if (trinket.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 3 + trinket.x);
      context.fillStyle = PALETTE.trinketGlow;
      context.globalAlpha = pulse;
      context.beginPath();
      context.arc(trinket.x, trinket.y, 22, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = PALETTE.trinket;
      context.beginPath();
      context.arc(trinket.x, trinket.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a5b00';
      context.beginPath();
      context.arc(trinket.x, trinket.y, 4, 0, Math.PI * 2);
      context.fill();
      text(trinket.name.toUpperCase(), trinket.x, trinket.labelBelow ? trinket.y + 32 : trinket.y - 18, 11, PALETTE.trinket, 'center');
    }
  }

  function drawCameras(state) {
    for (const cam of state.cameras) {
      const seen = state.alarm.seenBy === 'Camera';
      sector(
        cam.x,
        cam.y,
        cam.angle,
        CAMERA.sightRange,
        CAMERA.sightHalfAngle,
        seen ? 'rgba(255,70,70,0.25)' : PALETTE.cameraCone,
        seen ? 'rgba(255,70,70,0.7)' : 'rgba(255,90,90,0.35)',
      );
      context.fillStyle = PALETTE.cameraBody;
      context.beginPath();
      context.arc(cam.x, cam.y, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = seen ? '#ff5252' : '#ff8a80';
      context.beginPath();
      context.arc(cam.x + Math.cos(cam.angle) * 8, cam.y + Math.sin(cam.angle) * 8, 4, 0, Math.PI * 2);
      context.fill();
      text('CAM', cam.x, cam.y - 18, 11, PALETTE.muted, 'center');
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const seesSable = state.alarm.seenBy === guard.name;
      sector(
        guard.x,
        guard.y,
        guard.facing,
        GUARD.sightRange,
        GUARD.sightHalfAngle,
        seesSable ? PALETTE.coneSeen : PALETTE.cone,
        seesSable ? 'rgba(255,70,70,0.8)' : PALETTE.coneEdge,
      );
      // Body: dark uniform, head, cap.
      context.fillStyle = PALETTE.guardUniform;
      context.beginPath();
      context.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardSkin;
      context.beginPath();
      context.arc(guard.x, guard.y - 4, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guard;
      context.fillRect(guard.x - 9, guard.y - 14, 18, 5);
      // Flashlight dot where the guard looks.
      context.fillStyle = '#ffe9a8';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.facing) * 18, guard.y + Math.sin(guard.facing) * 18, 3, 0, Math.PI * 2);
      context.fill();
      text(guard.name.toUpperCase(), guard.x, guard.y - 24, 12, PALETTE.text, 'center');
      if (seesSable) text('!', guard.x, guard.y - 40, 26, '#ff5252', 'center');
      else if (guard.mode === 'investigate') text('?', guard.x, guard.y - 40, 22, PALETTE.trinket, 'center');
      else if (guard.mode === 'chase') text('!', guard.x, guard.y - 40, 26, '#ff5252', 'center');
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    // Smoke cloud: a ring of puffs that follows Sable while a veil is up.
    if (thief.veilTime > 0) {
      const puffs = [
        [0, 0, 34],
        [-26, -12, 24],
        [26, -10, 24],
        [-20, 16, 22],
        [22, 16, 22],
        [0, -24, 20],
      ];
      for (const [ox, oy, r] of puffs) {
        context.fillStyle = PALETTE.smoke;
        context.globalAlpha = 0.5;
        context.beginPath();
        context.arc(thief.x + ox, thief.y + oy, r, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      text('SMOKE VEIL', thief.x, thief.y - 52, 12, '#dfe3ee', 'center');
    }
    // Decoy coin on the floor.
    if (thief.decoy) {
      context.fillStyle = PALETTE.trinket;
      context.beginPath();
      context.arc(thief.decoy.x, thief.decoy.y, 7, 0, Math.PI * 2);
      context.fill();
    }
    // Sable: a black cat in a midnight-blue coat, tail curling behind.
    const x = thief.x;
    const y = thief.y;
    context.strokeStyle = PALETTE.thief;
    context.lineWidth = 6;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x - 10, y + 8);
    context.quadraticCurveTo(x - 26, y + 18, x - 22, y + 2);
    context.stroke();
    // Coat.
    context.fillStyle = PALETTE.thiefCoat;
    context.beginPath();
    context.arc(x, y + 2, 15, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.thiefCoatDark;
    context.fillRect(x - 15, y + 2, 30, 8);
    // Head and ears.
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(x, y - 8, 11, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(x - 9, y - 14);
    context.lineTo(x - 12, y - 24);
    context.lineTo(x - 3, y - 17);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(x + 9, y - 14);
    context.lineTo(x + 12, y - 24);
    context.lineTo(x + 3, y - 17);
    context.closePath();
    context.fill();
    // Eyes: two gold slits, brighter while sneaking.
    context.fillStyle = thief.sneaking ? '#ffe9a8' : '#f2c94c';
    context.beginPath();
    context.arc(x - 4, y - 9, 2.2, 0, Math.PI * 2);
    context.arc(x + 4, y - 9, 2.2, 0, Math.PI * 2);
    context.fill();
    text('SABLE', x, y - 30, 12, '#cdd7ff', 'center');
    if (thief.sneaking) text('sneaking', x, y + 30, 11, PALETTE.muted, 'center');
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(lootLabel(state.score.value), 32, 40, 24, PALETTE.text, 'left');
    text(trinketLabel(`${state.loot.trinketsTaken}/3`), 32, 70, 16, PALETTE.muted, 'left');
    text(veilLabel(state.thief.veils), FIELD.width - 32, 40, 24, '#dfe3ee', 'right');
    text(decoyLabel(state.thief.decoys), FIELD.width - 32, 70, 16, PALETTE.muted, 'right');
    // Alarm meter, top centre.
    const alarm = state.alarm.value;
    const barX = FIELD.width / 2 - 160;
    const barY = 36;
    const barW = 320;
    const barH = 20;
    text('ALARM', FIELD.width / 2, 12, 15, alarm >= 70 ? PALETTE.alarmHigh : PALETTE.muted, 'center');
    context.fillStyle = '#0d0f1e';
    context.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    context.fillStyle = alarm >= 70 ? PALETTE.alarmHigh : alarm >= 40 ? PALETTE.alarmMid : PALETTE.alarmLow;
    context.fillRect(barX, barY, (barW * alarm) / 100, barH);
    context.strokeStyle = 'rgba(238,241,245,0.5)';
    context.lineWidth = 1;
    context.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);
    if (state.alarm.seen) {
      text(`SPOTTED by ${state.alarm.seenBy}!`, FIELD.width / 2, 62, 18, '#ff5252', 'center');
    } else if (alarm > 0) {
      text('breaking line of sight…', FIELD.width / 2, 62, 14, PALETTE.muted, 'center');
    }
    // Sapphire status.
    text(
      state.loot.sapphireTaken ? '◆ SAPPHIRE SECURED — reach the green OUT door!' : '◆ Steal the SAPPHIRE, then reach the OUT door',
      FIELD.width / 2,
      FIELD.height - 44,
      15,
      state.loot.sapphireTaken ? PALETTE.doorGlow : PALETTE.muted,
      'center',
    );
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.globalAlpha = 0.94;
    context.fillRect(x, y, PANEL.width, height);
    context.globalAlpha = 1;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.trinket, 'center');
  }

  const TITLE_LINES = [
    'One room. Three guards. Two cameras. One Sapphire.',
    'Cross the Grand Gallery, steal the Sapphire of the Tide,',
    'grab the trinkets — and slip out the green door.',
    'WASD / arrows move · Shift sneak · Space smoke veil · E decoy coin',
    'A veil blinds every cone for 6 seconds. Trinkets pay +1 veil.',
    'Seen? The alarm climbs — break line of sight before it hits 100.',
    '',
  ];
  const PAUSED_LINES = ['The guards wait. The Sapphire waits.'];
  const OVER_LINES = ['', '', ''];
  const ESCAPED_LINES = ['', '', ''];

  /** Paint one frame: the room, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawRoom(state);
    drawCover(state);
    drawLoot(state);
    drawCameras(state);
    drawGuards(state);
    drawThief(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[6] = `Best loot $${best}`;
      drawPanel('SABLE — Smoke & Sapphire', TITLE_LINES, 'Press Enter or click to start the heist');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = state.alarm.seenBy ? `Spotted by ${state.alarm.seenBy}.` : 'Caught in the gallery.';
      OVER_LINES[1] = `Loot kept: $${state.score.value} · Trinkets ${state.loot.trinketsTaken}/3`;
      OVER_LINES[2] = `Best loot $${best}`;
      drawPanel('CAUGHT!', OVER_LINES, 'Press Enter or click to try again');
    } else if (screen === SCREEN_ESCAPED) {
      const minutes = Math.floor(state.elapsed / 60);
      const seconds = Math.floor(state.elapsed % 60).toString().padStart(2, '0');
      ESCAPED_LINES[0] = `Clean getaway in ${minutes}:${seconds} — the Sapphire is yours.`;
      ESCAPED_LINES[1] = `Loot: $${state.score.value} · Trinkets ${state.loot.trinketsTaken}/3 · Veils left ${state.thief.veils}`;
      ESCAPED_LINES[2] = `Best loot $${best}`;
      drawPanel('CLEAN GETAWAY!', ESCAPED_LINES, 'Press Enter or click to steal again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
