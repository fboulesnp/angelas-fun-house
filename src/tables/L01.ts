// Lesson 1 — Atoms and Elements — "Neon Atom Midway"
// A carnival midway at the scale of atoms: element-sign pop bumpers, a microscope Wonder
// Pocket, a Property Ramp, twin orbits and a periodic "group bank" that powers the marquee.

import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { SetBuilder, RoomBuilder } from '../game/render3d/setKit.ts';
import {
  TAU, glowDot, neonPath, neonText, rgba, rng, stage, stars, stringLights, vgrad, drift, rrect,
} from '../game/render/art.ts';

const PLUM = '#291B46';
const SAPPHIRE = '#273A86';
const GOLD = '#FFC75B';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Top lanes: N E O N (light all four to spell the marquee) ---
  const laneXs = [214, 262, 310, 358];
  const letters = ['N', 'E', 'O', 'N'];
  laneXs.forEach((x, i) => b.rollover(`lane_${i + 1}`, x, 152, { group: 'neon', label: letters[i] }));
  for (const gx of [190, 238, 286, 334, 382]) {
    b.wall([[gx, 122], [gx, 172]], { r: 3 });
    b.post(gx, 120, 5);
  }

  // --- Element-sign pop bumpers ---
  b.bumper('bumper_he', 230, 262, { group: 'elements', label: 'He', r: 26 });
  b.bumper('bumper_ne', 342, 262, { group: 'elements', label: 'Ne', r: 26 });
  b.bumper('bumper_c', 286, 345, { group: 'elements', label: 'C', r: 26 });

  // --- Left orbit channel + exit deflector ---
  b.wall([[74, 640], [74, 372]], { id: 'left_orbit_inner', r: 3 });
  b.post(74, 368, 5);
  b.shotSwitch('left_orbit_sw', 49, 470, -90);
  b.wall([[FRAME.left, 646], [54, 694]], { id: 'left_orbit_deflect', r: 3 });

  // --- Right orbit channel + exit deflector ---
  b.wall([[498, 640], [498, 372]], { id: 'right_orbit_inner', r: 3 });
  b.post(498, 368, 5);
  b.shotSwitch('right_orbit_sw', 523, 470, -90);
  b.wall([[FRAME.laneSep, 646], [518, 694]], { id: 'right_orbit_deflect', r: 3 });

  // --- Property Ramp: climbs from mid-left, arcs over the left orbit, drops into the left inlane ---
  // Flared mouth so angled shots from the right flipper funnel in.
  b.wall([[118, 676], [133, 612]], { r: 3 });
  b.wall([[204, 672], [167, 612]], { r: 3 });
  b.ramp('property_ramp', {
    path: [[150, 612], [150, 470], [144, 330], [118, 248], [74, 236], [50, 290], [48, 430], [48, 600], [62, 730], [83, 806]],
    width: 34,
    footprintTo: 2,
    label: 'PROPERTY RAMP',
  });

  // --- Microscope Wonder Pocket in a protective cup ---
  b.wall([[258, 440], [258, 486]], { r: 4 });
  b.wall([[314, 440], [314, 486]], { r: 4 });
  b.wall([[258, 440], [286, 428], [314, 440]], { r: 4 });
  b.saucer('microscope', 286, 462, { role: 'pocket', ejectDeg: 82, ejectSpeed: 760, label: 'MICROSCOPE POCKET', icon: 'microscope' });

  // --- Group Bank: four drop targets against the right orbit wall ---
  b.dropBank('group_bank', 486, 478, 90, 4, { size: 26, gap: 6, group: 'groups', labels: ['1', '2', '17', '18'] });

  // --- Standup targets: "Matter / not matter" sorting pair on the left ---
  b.target('matter_target', [244, 446], [244, 478], { group: 'sort', label: 'MATTER' });
  b.target('nonmatter_target', [328, 478], [328, 446], { group: 'sort', label: 'LIGHT' });

  // --- Inserts that preview shots ---
  b.insert('ins_left_orbit', 49, 600, { deg: -90, label: 'ORBIT' });
  b.insert('ins_ramp', 160, 704, { deg: -110 });
  b.insert('ins_pocket', 286, 530, { deg: -90 });
  b.insert('ins_bank', 440, 540, { deg: 0, label: 'GROUPS' });
  b.insert('ins_right_orbit', 523, 600, { deg: -90, label: 'ORBIT' });
  b.insert('ins_bumpers', 286, 210, { shape: 'star', size: 12 });
}


// ---------------------------------------------------------------- 3D attraction set

const ELEMENT_GLOW: Record<string, string> = { Ne: '#ff5a2e', He: '#ff9fc0', Ar: '#b388ff', Kr: '#e8f0ff', Xe: '#6aa8ff', Hg: '#7ad9ff' };

const midwaySet: SetBuilder = (kit) => {
  kit.sky('#1b1040', '#05030a');
  kit.boardwalk('#3b2a22', 30);
  // Left: "Is it matter?" balloon booth (the lesson's balloon phenomenon).
  kit.booth([-6.2, 0, -1.2], 3.2, [CORAL, IVORY], 0.5);
  const matterSign = kit.neonSign('IS IT MATTER?', [-6.4, 2.75, -1.6], { height: 0.45, color: CORAL, rotY: 0.5 });
  const balloonColors = [CORAL, GOLD, MINT, '#9fb4ff', '#ff9fc0'];
  for (let i = 0; i < kit.n(7); i++) kit.balloon([-7.6 + i * 0.42, 2.0 + (i % 3) * 0.35, -0.2 + (i % 2) * 0.5], balloonColors[i % balloonColors.length]);
  // Right: noble-gas tube shelf (each gas glows its own colour in a discharge tube).
  kit.booth([6.2, 0, -1.2], 3.2, [MINT, IVORY], -0.5);
  const gasSign = kit.neonSign('GLOWING GASES', [6.4, 2.75, -1.6], { height: 0.45, color: MINT, rotY: -0.5 });
  const gases = Object.entries(ELEMENT_GLOW).slice(0, kit.n(6));
  const tubes = gases.map(([el, c], i) => kit.gasTube([5.05 + i * 0.42, -0.42 + 0.95, -0.3 - i * 0.24], c, el, 0.9));
  // Pole-mounted element signs flanking the cabinet, tilted back toward the player's view.
  const heSign = kit.neonSign('He', [-4.5, 1.7, 1.2], { height: 0.7, color: '#ff9fc0', rotY: 0.25, backing: false });
  const neSign = kit.neonSign('Ne', [4.5, 1.7, 1.2], { height: 0.7, color: '#ff5a2e', rotY: -0.25, backing: false });
  heSign.rotation.x = -0.6;
  neSign.rotation.x = -0.6;
  kit.pole([-4.5, 0, 1.2], 1.6);
  kit.pole([4.5, 0, 1.2], 1.6);
  // Head: periodic marquee wall and the periodic wheel.
  const mask = [
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];
  const wall = kit.tileWall([5.9, 0.3, -5.6], 18, 7, 0.2, mask, (c) => (c < 2 ? CORAL : c > 11 ? (c === 17 ? '#9fb4ff' : MINT) : GOLD));
  wall.rotation.set(-0.55, -0.45, 0);
  const marquee = kit.neonSign('NEON ATOM MIDWAY', [0, 1.4, -7.2], { height: 0.7, color: GOLD });
  marquee.rotation.x = -0.75;
  const wheel = kit.wheel([-5.9, 2.0, -5.9], 1.5, ['H', 'He', 'Li', 'C', 'N', 'O', 'Ne', 'Na', 'Fe', 'Au'].map((label, i) => ({ label, color: [GOLD, CORAL, MINT, '#9fb4ff'][i % 4] })), 0.45);
  kit.pole([-9, 0, -7], 4.6);
  kit.pole([9, 0, -7], 4.6);
  kit.pole([-8.5, 0, -2], 3.4);
  kit.pole([8.5, 0, -2], 3.4);
  kit.pole([-4.4, 0, 4.2], 2.8);
  kit.pole([4.4, 0, 4.2], 2.8);
  const lightsA = kit.stringLights([-9, 4.4, -7], [9, 4.4, -7], 0.7, kit.n(30), [GOLD, CORAL, MINT]);
  const lightsB = kit.stringLights([-8.5, 3.2, -2], [-4.4, 2.6, 4.2], 0.4, kit.n(14), [GOLD, MINT]);
  const lightsC = kit.stringLights([8.5, 3.2, -2], [4.4, 2.6, 4.2], 0.4, kit.n(14), [GOLD, CORAL]);
  const motes = kit.motes({ x0: -10, x1: 10, y0: 0, y1: 6, z0: -10, z1: 6 }, 120, MINT, { speed: 0.12, size: 0.1 });
  const fw = kit.fireworks({ x0: -6, x1: 6, y0: 5.5, y1: 8, z: -10 }, [GOLD, CORAL, MINT, '#9fb4ff']);
  kit.spot([-5, 6, 3], [-6, 0, -1], CORAL, 34, 0.45);
  kit.spot([5, 6, 3], [6, 0, -1], MINT, 34, 0.45);
  let wheelAngle = 0;
  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      // Dormant midway still glows faintly so it is never a black void.
      heSign.setLit(0.15 + 0.85 * s1);
      neSign.setLit(0.15 + 0.85 * s1);
      matterSign.setLit(0.25 + 0.75 * s1);
      gasSign.setLit(0.25 + 0.75 * s1);
      tubes.forEach((tb, i) => tb.setLit(Math.max(0.12, kit.stage(level, 0.4 + i * 0.12, 1 + i * 0.12)) * (0.85 + 0.15 * energy)));
      marquee.setLit(0.1 + 0.9 * s2);
      lightsA.setLit(0.2 + 0.8 * s2);
      lightsB.setLit(0.3 + 0.7 * s0);
      lightsC.setLit(0.3 + 0.7 * s0);
      wall.light(0.08 + 0.92 * s3, t);
      wheel.setLit(0.15 + 0.85 * s3);
      if (!kit.reducedMotion) wheelAngle += dt * (0.05 + 0.25 * s3);
      wheel.rotor.rotation.z = wheelAngle;
      motes.setLit(0.3 + 0.5 * s1);
      fw.setLit(kit.stage(level, 3.6, 4));
    },
    celebrate(p) {
      fw.setLit(Math.sin(p * Math.PI));
    },
  };
};

const midwayRoom: RoomBuilder = ({ kit }) => {
  const he = kit.neonSign('He', [-0.45, 1.05, -0.7], { height: 0.38, color: '#ff9fc0' });
  const ne = kit.neonSign('Ne', [0.45, 1.05, -0.7], { height: 0.38, color: '#ff5a2e' });
  const atom = kit.orb([0, 0.55, 0], 0.14, GOLD);
  const cloudPts = kit.cloudOfPoints([0, 0.55, 0], 0.4, 70, MINT);
  for (let i = 0; i < 3; i++) kit.balloon([-0.7 + i * 0.25, 0.75, 0.3], [CORAL, GOLD, MINT][i], 0.12);
  return {
    update(t, lit) {
      he.setLit(lit);
      ne.setLit(lit);
      atom.setLit(lit);
      cloudPts.setLit(lit * 0.9);
      cloudPts.rotation.y = kit.reducedMotion ? 0 : t * 0.3;
    },
  };
};

export const L01: TableDef = {
  lessonId: 'L01',
  signature: 'Element-sign bumpers that power a neon periodic marquee',
  ballRole: 'The Wonderball is a game token, not an atom: real atoms are far too small to see with your eyes, and they do not bounce around like pinballs.',
  theme: {
    bg: ['#2a1650', '#151032'],
    rail: '#c9b8e8',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: MINT,
    bumperCap: '#ff9fb0',
    bumperRing: '#3b2466',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(113,227,207,0.16)',
    trail: MINT,
  },
  lines: {
    intro: "Welcome to the Neon Atom Midway! Every sign here is lit by atoms far too tiny to see. Let's find out what they're made of.",
    quark: '"An empty balloon and a balloon full of air must weigh the same. Air is nothing, right?" Professor Quark wonders aloud.',
    pipTip: 'Pull back the plunger and let go — a gentle launch can drop into the N-E-O-N lanes.',
  },
  build,
  skillShot: 'lane_3',
  shots: [
    { id: 'leftOrbit', label: 'Left orbit', on: [{ type: 'shot', id: 'left_orbit_sw' }], insert: 'ins_left_orbit' },
    { id: 'rightOrbit', label: 'Right orbit', on: [{ type: 'shot', id: 'right_orbit_sw' }], insert: 'ins_right_orbit' },
    { id: 'ramp', label: 'Property Ramp', on: [{ type: 'ramp', id: 'property_ramp' }], insert: 'ins_ramp' },
    { id: 'pocket', label: 'Microscope Pocket', on: [{ type: 'saucer', id: 'microscope' }], insert: 'ins_pocket' },
    { id: 'bank', label: 'Group Bank', on: [{ type: 'dropBank', id: 'group_bank' }], insert: 'ins_bank' },
    { id: 'bumpers', label: 'Element signs', on: [{ type: 'bumper', group: 'elements' }], insert: 'ins_bumpers' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Matter Detector',
      brief: 'Power the detector by striking the element signs, then test a mystery sample in the Microscope Pocket.',
      objectiveIds: ['L01-O1', 'L01-O2'],
      stages: [
        { kind: 'collect', text: 'Strike the element signs 8 times', match: { type: 'bumper', group: 'elements' }, count: 8, preview: ['bumpers'] },
        { kind: 'collect', text: 'Sort it out: hit MATTER and LIGHT', match: { type: 'target', group: 'sort' }, count: 2, distinct: true, lamps: ['matter_target', 'nonmatter_target'] },
        { kind: 'discover', text: 'Shoot the Microscope Pocket', pocket: 'microscope', questions: 1 },
      ],
      discovery: 'Air is matter: it has mass and takes up space, even though you cannot see it. Light is not matter.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'apply',
      title: 'Mystery Element',
      brief: 'Gather property clues on the ramp and both orbits, then identify the mystery element.',
      objectiveIds: ['L01-O4', 'L01-O1'],
      stages: [
        { kind: 'shots', text: 'Collect 3 clues: ramp and both orbits', shots: ['ramp', 'leftOrbit', 'rightOrbit'], order: 'any' },
        { kind: 'discover', text: 'Shoot the Microscope Pocket to examine the clues', pocket: 'microscope', questions: 1 },
      ],
      discovery: "An element's symbol, mass and place on the periodic table work together like clues: neighbours in a column share properties.",
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'relate',
      title: 'Periodic Parade',
      brief: 'Knock down the Group Bank and light N-E-O-N to arrange the elements by their pattern.',
      objectiveIds: ['L01-O3', 'L01-O4'],
      stages: [
        { kind: 'collect', text: 'Clear the Group Bank', match: { type: 'dropBank', id: 'group_bank' }, count: 1, preview: ['bank'] },
        { kind: 'collect', text: 'Light the N-E-O-N lanes', match: { type: 'rollover', group: 'neon' }, count: 4, distinct: true, lamps: ['lane_1', 'lane_2', 'lane_3', 'lane_4'] },
        { kind: 'discover', text: 'Shoot the Microscope Pocket to build the table', pocket: 'microscope', questions: 1, types: ['order', 'classify', 'match'] },
      ],
      discovery: 'Mendeleev arranged elements by mass and repeating properties, left gaps, and predicted elements that were later found.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Light the Midway',
    brief: 'Make every major shot once, then bring the Wonderball home to the Microscope Pocket.',
    stages: [
      { kind: 'shots', text: 'Light the midway: orbits, ramp and Group Bank', shots: ['leftOrbit', 'ramp', 'rightOrbit', 'bank'], order: 'any' },
      { kind: 'discover', text: 'Final look through the Microscope Pocket', pocket: 'microscope', questions: 2 },
    ],
    celebration: 'Every sign on the midway glows: elements, atoms and patterns, all made visible. The first Wonderlight is yours!',
  },
  set: midwaySet,
  room: midwayRoom,
  icons: {
    microscope(ctx, s) {
      ctx.fillRect(-s * 0.15, -s * 0.9, s * 0.3, s * 0.9);
      ctx.fillRect(-s * 0.7, s * 0.65, s * 1.4, s * 0.25);
      ctx.beginPath();
      ctx.arc(s * 0.25, s * 0.15, s * 0.45, -Math.PI / 2, Math.PI / 2);
      ctx.lineWidth = s * 0.18;
      ctx.stroke();
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      // Twilight sky of the tiny world
      ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#1d1240'], [0.45, PLUM], [1, '#120c2a']]);
      ctx.fillRect(0, 0, 600, 1150);
      stars(ctx, 11, 90, [30, 30, 570, 700], IVORY);
      // Periodic mosaic wall behind the bumpers (18 x 7 tiles, lighting up with progress)
      const lit = stage(level, 2.2, 3);
      const r = rng(4);
      const cols = 18;
      const tile = 22;
      const x0 = 300 - (cols * tile) / 2;
      const y0 = 70;
      const pattern = [
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      ];
      ctx.save();
      ctx.globalAlpha = 0.5;
      pattern.forEach((row, ry) => row.forEach((on, cx) => {
        if (!on) return;
        const colColors = [CORAL, GOLD, MINT, '#9fb4ff'];
        const c = colColors[cx < 2 ? 0 : cx > 11 ? 2 : cx === 17 ? 3 : 1];
        const flick = r();
        rrect(ctx, x0 + cx * tile + 1, y0 + ry * tile + 1, tile - 2, tile - 2, 3);
        ctx.fillStyle = lit > 0.01 ? rgba(c, 0.12 + 0.4 * lit * (0.6 + 0.4 * flick)) : 'rgba(255,247,231,0.05)';
        ctx.fill();
      }));
      ctx.restore();
      // Midway tents along the sides
      for (const [x, c] of [[120, CORAL], [460, MINT]] as [number, string][]) {
        ctx.fillStyle = rgba(c, 0.12 + 0.18 * stage(level, 0.5, 1.5));
        ctx.beginPath();
        ctx.moveTo(x - 70, 780);
        ctx.lineTo(x, 690);
        ctx.lineTo(x + 70, 780);
        ctx.closePath();
        ctx.fill();
      }
      // Neon element signs on the side walls (light at level 1)
      const s1 = stage(level, 0.2, 1);
      neonText(ctx, 'He', 108, 420, 30, MINT, s1);
      neonText(ctx, 'Ne', 468, 420, 30, CORAL, s1);
      // Atom glow-sign: nucleus with electron cloud (not a solar-system model)
      neonPath(ctx, () => {
        ctx.beginPath();
        ctx.arc(286, 640, 34, 0, TAU);
      }, MINT, stage(level, 1, 2), 3);
      if (stage(level, 1, 2) > 0) {
        const rr = rng(9);
        for (let i = 0; i < 40; i++) {
          const a = rr() * TAU;
          const d = 8 + rr() * 28;
          glowDot(ctx, 286 + Math.cos(a) * d, 640 + Math.sin(a) * d, 3, MINT, 0.6 * stage(level, 1, 2));
        }
        glowDot(ctx, 286, 640, 10, GOLD, stage(level, 1, 2));
      }
      // Marquee arch lettering (level 2+)
      neonText(ctx, 'NEON ATOM MIDWAY', 286, 46, 22, GOLD, stage(level, 1.5, 2.5));
      // Grand finale glow
      if (level >= 3.5) {
        ctx.fillStyle = rgba(GOLD, 0.06 * stage(level, 3.5, 4));
        ctx.fillRect(0, 0, 600, 1150);
      }
      // Floor stripes for depth
      ctx.save();
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = i % 2 ? SAPPHIRE : PLUM;
        ctx.fillRect(0, 700 + i * 30, 600, 15);
      }
      ctx.restore();
    },
    ambient({ ctx, t, level, reduced, energy }) {
      const s2 = stage(level, 1, 2);
      // String lights along the upper rails
      stringLights(ctx, 90, 200, 230, 190, 18, 8, [GOLD, CORAL, MINT], stage(level, 0.5, 1.5) * (0.6 + 0.4 * energy), reduced ? 0 : t);
      stringLights(ctx, 342, 190, 482, 200, 18, 8, [MINT, GOLD, CORAL], stage(level, 0.5, 1.5) * (0.6 + 0.4 * energy), reduced ? 0 : t);
      if (!reduced && s2 > 0) drift(ctx, 3, 18, t, MINT, [40, 380, 560, 760], 10, 1.6, 0.35 * s2);
      if (!reduced && level >= 3.9) {
        // gentle fireworks at the top (finale earned), slow and soft
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.35 + i / 3) % 1;
          const cx = 120 + i * 180;
          const cy = 120 + i * 20;
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * TAU;
            glowDot(ctx, cx + Math.cos(a) * ph * 50, cy + Math.sin(a) * ph * 50, 6, [GOLD, CORAL, MINT][(i + k) % 3], 0.6 * (1 - ph));
          }
        }
      }
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(286, 462, 10, 286, 462, 420);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU + t * 0.4;
        const d = 60 + p * 260;
        glowDot(ctx, 286 + Math.cos(a) * d, 462 + Math.sin(a) * d * 0.8, 10, [GOLD, CORAL, MINT][i % 3], 1 - p);
      }
    },
  },
};
export default L01;
