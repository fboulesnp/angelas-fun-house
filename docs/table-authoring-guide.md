# Table authoring guide (one attraction per lesson)

Every lesson gets its own fully playable pinball attraction in **one file**:
`src/tables/Lnn.ts`, which must `export default` a `TableDef` (see
`src/game/table/tableDef.ts`). The reference implementation is
**`src/tables/L01.ts` (Neon Atom Midway)** — read it completely first.

The master brief (`../Angelas-Fun-House-Claude-Code-Master-Prompt.md`, sections 1, 3, 4, 5,
6, 7) describes the experience. Section 7 has each lesson's attraction concept.

## Hard rules

- **Only write `src/tables/Lnn.ts`** (and scratch files outside the project). Never edit the
  engine, renderer, kit, other tables, content files, or `src/tables/index.ts` (tables are
  auto-registered). If you need a helper the kit lacks, write it inside your table file using
  `three` directly. If you find an engine bug, describe it in your final report.
- `node scripts/table-check.ts Lnn` must print **PASS** (default: 3 seeds × 20 simulated
  minutes with an aiming bot). Read every warning and fix what you can.
- Original art and characters only. No copying Disney (or any) characters, logos, songs,
  attraction layouts or castles. No emoji as art.
- All learner-facing text (mission titles, briefs, stage texts, discovery lines, Angela /
  Quark / Pip lines, labels) must be scientifically accurate, original, short, and consistent
  with the lesson. Discovery lines state one true idea from the lesson. Follow the science
  guardrails in `docs/content-authoring-guide.md`.

## Coordinates and the standard frame

Table units: the playfield is 600 × 1150, **x right, y toward the drain** (gravity is +y).
The ball radius is 12. `b.standardFrame({ kickback?: 'left'|'right'|'both'|'none', centerPost? })`
builds (do not duplicate any of this):

- Outer walls at x = 24 and x = 596, a semicircular top arch (center 310,300, radius 286,
  top at y = 14), the shooter lane x 548–596 with its one-way gate at y ≈ 300–330, plunger.
- Lower playfield: slingshots (A 104,812 / B 104,900 / C 158,930 and mirrored about x = 286),
  in/outlane dividers at x = 62 / 510 from y = 846, inlane guides down to the flipper pivots,
  inlane/outlane rollovers (`left_inlane`, `left_outlane`, …), flippers `flipper_left`
  (pivot 186,996) and `flipper_right` (386,996), drain at y = 1112, optional kickbacks.
- **Reserved space:** keep solids out of y > 790 below x < 125 or x > 447 (in/outlanes and
  slings), out of the flipper sweeps, out of the shooter lane (x ≥ 546), and leave the area
  between the slings and flippers open. Your features live mainly in **x 30–542, y 30–790**.
- The arch carries a ball launched from the shooter lane leftward over the top; a full-power
  launch circles to the left side. Give the left side an orbit channel + exit deflector (as in
  L01) or other guide so launched balls don't fall straight into the left outlane.
- Upper-area safety: a ball must never be able to rest anywhere except a flipper cradle or a
  saucer. Avoid horizontal ledges, V-shaped corners narrower than 40 units, and gaps between
  solids of 24–34 units (the ball jams). Gaps either < 18 (blocked) or ≥ 36 (lanes).

## Builder vocabulary (`TableBuilder`, see `src/game/table/builder.ts`)

| Call | What it makes | Notes |
|---|---|---|
| `wall(points, {r, style, layer, closed, id})` | polyline wall | style `rail` (default), `wood`, `rubber`, `glass`, `invisible`, `guide` |
| `arc(cx, cy, r, fromDeg, toDeg, opts)` / `curve(points, opts)` | smooth walls | degrees, y-down: 0 = +x, 90 = down |
| `post(x, y, r)` | rubber post | |
| `bumper(id, x, y, {r, label, icon, group, kick})` | pop bumper (r ≈ 22–28) | emits `bumper` |
| `sling(id, a, b, c)` | extra slingshot; face is a→c | emits `sling` |
| `rollover(id, x, y, {group, label, role})` | lane switch | emits `rollover` |
| `target(id, a, b, {group, label})` | standup target | emits `target` |
| `dropBank(id, x, y, deg, count, {size, gap, labels})` | drop targets; resets safely | emits `drop`, `dropBank` (ids `id_1..n`) — put a backstop wall behind |
| `spinner(id, a, b, {label})` | spinner across a lane | emits `spinner` (value = spins) |
| `shotSwitch(id, x, y, dirDeg)` | direction-aware switch for orbits/loops/lanes | emits `shot` only when travelling along dirDeg |
| `saucer(id, x, y, {role, ejectDeg, ejectSpeed, label, icon})` | kick-out hole; `role:'pocket'` = the **Wonder Pocket** (exactly one, required) | eject path must be clear for 60 units; eject toward a flipper, not straight down the middle |
| `gate(id, a, b, passDeg)` | one-way gate | |
| `diverter(id, pivot, length, degA, degB)` | switching guide (moves only when no ball is in its sweep) | switch it from `onProgress` (below) to open alternate routes as missions advance |
| `ramp(id, {path, width, footprintTo, peak, label})` | raised ramp on layer 1 | **flare the mouth** with two angled walls, start the path just inside the mouth, smooth path, exit into an inlane or open playfield; the exit point must be clear of walls |
| `portal(id, entry, {x, y, deg, speed})` | marked magic portal with exit ball save | visible entry/exit; never hidden |
| `flipper(id, x, y, side, {length, restDeg, upDeg, button})` | extra (upper) flipper | keep sweep clear; give it a shot worth making |
| `insert(id, x, y, {deg, shape, label, color})` | arrow/circle/star lamp | one per shot for previews |

Geometry tips that the bot exposed on L01: orbit channels ≥ 44 wide with an exit deflector;
ramp mouths flared (≈ 70 wide narrowing to the ramp width); don't put targets in front of a
ramp mouth or orbit entrance; drop banks need a backstop with < 12-unit gap behind them.

Lessons from the first twelve builds (engine behaviour to design around):

- **Kickbacks:** an exit deflector directly above an outlane blocks the kickback, which then
  fires into the deflector and drains. If you use a kickback, keep its column clear (one-way
  gates make good loop exits) and confirm in a soak that kickback saves happen.
- **Pockets:** `Saucer` captures below `captureMaxSpeed` (default 1700). Mid-table pockets hit
  by direct flipper shots usually need ≈ 2400. The sensor radius is 11, so funnel the ball.
- **Sensors** (rollovers, switches) fire only when the ball centre enters the sensor radius.
- **Drop banks:** a bank only re-raises targets the ball isn't touching, but in-line banks can
  still close behind a ball; guard with a small Mechanism subclass if your layout needs it.
  Shot-map trials are single shots, so a multi-target bank shows as "not reachable from a
  cradle or inlane feed" — that is expected. Match single `drop` events (`distinct`) for
  collect stages so the aiming bot can target them.
- **Aiming bot limits:** it aims only the lower flippers and learns inlane timings from a slow
  feed, so fast ramp/orbit returns straight into an inlane drain more often in soaks. Make
  every mission-critical shot reachable from the lower flippers; serpentine or gated returns
  help.
- **3D labels:** the 3D view draws rollover, target and saucer floor labels, but not ramp,
  portal or spinner labels, nor saucer/rollover icons; paint those names and icons into
  `scenery.backdrop`. Saucer floor labels sit 45 units below the saucer; keep them short.
- `set.update` keeps running while paused: route motion through `kit.animate`.
- `kit.mats.wood()` (clearcoat) under a spot can bloom; prefer a matte material there.
- `kit.stringLights` uses one mesh per bulb; count them against the mesh budget.
- **Scratch files:** the scratchpad is shared by parallel agents. Keep yours in a
  sub-folder named after your lesson (e.g. `scratchpad/L19/`).

## Shots, missions, finale

- `shots`: named shots (`{ id, label, on: Match[], insert }`). Matches use event `type`
  (`bumper|sling|rollover|target|drop|dropBank|spinner|saucer|ramp|shot|portal|...`), `id`,
  and/or `group`.
- `missions`: exactly three, kinds **observe**, **relate**, **apply** (one each, any order),
  each ending with a `discover` stage at the Wonder Pocket. Stage kinds: `collect`
  (count matching events, optional `distinct`, `lamps`, `preview`), `shots` (named shots,
  `order: 'any'|'sequence'`), `discover` (park the ball, ask `questions` 1–2, optional
  preferred `types` like `['order','classify','match']` for model-building missions).
- Map the brief's three missions for your lesson onto the stages. Stage HUD text ≤ 60 chars.
- `objectiveIds`: if `src/content/lessons/Lnn.json` exists, use its objective ids that fit the
  mission; otherwise leave `[]` (the game then uses the lesson's objectives of the same kind).
- `discovery`: ≤ 220 chars, one accurate idea, original wording, shown when the mission ends.
- `finale`: 1–2 stages of major shots then a `discover` (2 questions). Its celebration line
  closes the attraction.
- `reward`: `kickback | ballsave | multiball | jackpot | none` (use multiball once or twice).
- Pacing target (aiming bot): first mission in ≈ 1–4 simulated minutes, all three missions
  within ≈ 15 minutes, finale reachable in at least one 20-minute seed. Micro-objectives every
  20–40 s of play (collect counts of 3–8, short shot lists).
- `skillShot`: a rollover a soft plunge can reach (test with the soak).
- `onProgress(rt, {slot, stage, level})` (optional): runs at start and on every mission/stage
  change. Use it to switch diverters (`rt.get<Diverter>('id').set(1)`), enable/disable a
  `Portal` or non-pocket `Saucer` (`.enabled`), or set lamps. It must be idempotent.

## Make it distinct

Each attraction needs its own **shot topology** and **signature mechanism** (your task
brief suggests one). Vary: orbit vs loop vs spiral, ramp count and shape, upper flippers,
split or tiered areas, bank shapes, saucer count, portals, spinners, bumper clusters. Never
ship a recolor of L01. The playfield should read as the lesson's world at a glance.

## Theme, characters and the 2D printed playfield

- `theme`: colours for the lacquer gradient, rails, lamps, plastics, ramp tint, trail. Keep
  enough contrast that the glowing glass ball (ivory/mint) stays the brightest moving thing.
- `lines`: `intro` (Angela, ≤ 2 sentences, warm and witty), `quark` (Professor Quark voicing a
  REAL misconception from this lesson as a wondering, which the missions resolve), `pipTip`
  (a practical first-shot tip).
- `ballRole` (optional): one sentence when the ball stands in for something (atom, droplet…),
  saying it's a game token and how the real thing differs.
- `scenery.backdrop(c)`: the **printed playfield art** under the lacquer (drawn on a 600×1150
  canvas, also used by the 2D view). Paint the lesson's world with `src/game/render/art.ts`
  helpers; mid-tones where the ball travels; let it **awaken with `c.level`** (0 dormant → 4
  Wonderlight). `ambient` (2D view only) and `celebrate` are optional.

## The 3D attraction set (`set`) and dollhouse room (`room`)

`set: (kit: SetKit) => SetHandle` builds the diorama around the cabinet (see
`src/game/render3d/setKit.ts` and L01's `midwaySet`). World space: playfield X −3…3,
Z −5.75…5.75 at Y = 0; cabinet rails to ±3.35; ground at Y = −0.42.

- **Where it shows:** the side regions X ±3.8…±8.5, Z −6…5 (largest on desktop) and the top
  corners near (±5…7, y ≤ 2.5, z ≈ −5). The strip behind the head (Z < −6.4) is only seen
  during the intro fly-in, so put hero pieces and the level-4 spectacle in the side regions
  and corners. Signs should tilt back (rotation.x ≈ −0.6) to face the elevated camera.
  Nothing may hang over the playfield.
- **Kit pieces:** `sky`, `ground`, `boardwalk`, `backdrop`, `spot`, `point` (≤ 3 lights total),
  `neonTube`, `neonSign`, `panel`, `stringLights`, `pole`, `lantern`, `crystal`, `rock`,
  `tree`, `cloud`, `gear`, `water`, `motes`, `tent`, `orb`, `cloudOfPoints`, `booth`,
  `balloon`, `gasTube`, `wheel`, `tileWall`, `fireworks`, plus raw `kit.THREE` for anything
  custom (use `kit.mats` materials, `kit.add`, `kit.track` for disposables).
- **Awakening:** `update(t, dt, level, energy)` lights and animates the set by level
  (0 dormant but visible, 1–3 per mission, 4 Wonderlight spectacle). `celebrate(p, t)` runs
  while balls are parked. Animations go through `kit.animate` (auto-skipped for reduced
  motion) or check `kit.reducedMotion`. No per-frame allocations.
- **Budget:** ≈ 150 meshes, use `kit.n(count)` for instance counts (scales with quality).
- `room: (ctx) => { update(t, lit) }`: a tiny vignette (≤ 25 meshes) inside a 2.1 × 1.7 × 1.8
  dollhouse room (x ±1.05, y 0…1.7, z ±0.9, open toward +z) that glows as `lit` rises.

## Validation loop (repeat until it's genuinely good)

```
node scripts/table-check.ts Lnn                 # PASS required; read the shot map
node scripts/table-preview.ts Lnn               # geometry PNG -> screenshots/geometry/Lnn.png (Read it)
node scripts/soak.ts Lnn 600 1                  # quick soak with event counts
node scripts/shot.ts '/?table=Lnn&autostart&test' screenshots/tmp/Lnn-0.png 1600 1000 5
node scripts/shot.ts '/?table=Lnn&autostart&test' screenshots/tmp/Lnn-4.png 1600 1000 5 "eval:window.__afh.session().sceneryLevel%3D4"
```

The dev server must be running at http://localhost:5199 for `shot.ts` (if it isn't, run
`npx vite --port 5199` in the background from `game/`, or set `AFH_URL` to another port you
start). **Look at every PNG you produce** (Read tool) and judge it like an art director: is
the playfield readable, is the set handsome and on-theme, does level 4 feel like a reward?
