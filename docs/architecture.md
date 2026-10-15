# Architecture decisions

## Stack

| Concern | Choice | Why |
|---|---|---|
| Language/build | TypeScript 5.9, Vite 7, pinned with `package-lock.json` | Simple, fast, static output; no server needed |
| UI | Preact 10 (+ plain CSS) | Accessible HTML menus/questions with a tiny runtime; never drives the game loop |
| Physics | **Custom** fixed-step pinball engine (`src/game/physics`) | Stock engines make poor flippers; ours is deterministic, testable headlessly, and tuned for pinball |
| 3D presentation | Three.js r186 WebGL2 (`src/game/render3d`) | PBR materials, shadows, HDR post (bloom, GTAO, ACES), procedural geometry only |
| 2D fallback | Canvas 2D renderer (`src/game/render`) | Lightest view, used when WebGL2 is missing or chosen in Settings |
| Audio | Web Audio synthesis (`src/game/audio`) | Original score + effects without recorded assets |
| Tests | Vitest + headless bot (`src/game/sim`) + system Chrome via playwright-core | Behavioural checks, long soaks, real-browser screenshots |

The user asked for a high-end 3D presentation, so the brief's "prefer 2.5D" guidance was
superseded: physics stays a planar pinball simulation with an explicit ramp layer (as real
pinball simulations do), and the renderer is fully 3D.

## One authoritative loop

`GameLoop` (`src/game/loop.ts`) runs the simulation at a fixed 120 Hz with 8 collision
substeps (960 Hz), caps catch-up after stalls (backlog dropped, never fast-forwarded), and
renders once per animation frame. It lives in refs inside `GameScreen`; Preact only samples
the session for the HUD a few times per second, so UI re-renders never touch a live ball.

## Physics model (`src/game/physics`)

- Ball: circle r = 12 table units in a 600 × 1150 table (y toward the drain).
- Colliders: capsules (segments with radius) and circles; layer 0 = playfield, 1 = ramps.
  Static colliders live in a broad-phase grid; dynamic ones (drop targets, diverters,
  plunger tip) are checked directly.
- Max speed 3,900 u/s → at most ~4 units per substep (a third of the ball radius), so no
  tunnelling (a test sweeps every phase offset at max speed; it fails with 1 substep).
- Flippers: motor-driven tapered capsules with angular acceleration, end stops and surface
  velocity at the contact point (tip contacts are faster than base contacts; early/late
  timing aims). Cradling works because a held flipper is a static slope into the inlane guide.
- Scoring contacts are debounced per ball (bumpers 0.09 s, rollovers 0.3 s, targets 0.2 s).
- One-way gates, diverters that only move when no ball is in their sweep, drop targets that
  only rise when clear, portals with clear exits and exit ball save.
- Ramps lift the ball to layer 1 at a switch inside the mouth and drop it at the exit; a
  ball that ever leaves a ramp corridor on layer 1 falls back to the playfield (or is
  rescued if over a wall). Rendering raises it along the ramp's height profile.

## Rules (`src/game/rules`)

`GameSession` owns an explicit state machine (`ready, play, parked, celebrate, drained,
gameover, paused`) with a transition table; invalid transitions are reported, not applied.
It does ball accounting (serve queue, autoplunge, multiball), ball save, tilt, stuck-ball
detection (nudge after 3.5 s still, signposted rescue after 10 s confined with no scoring),
escape detection, scoring/combos, and missions. Discoveries park every ball (physics
frozen) while the question panel is open; play resumes with a ball save and countdown.

`MissionRunner` is pure: stages `collect | shots | discover`, three missions then a finale,
encore replays after a Wonderlight. Tables can script safe changes via `onProgress`.

## Content and learning

- Schema: `src/content/schema.ts`; validator `src/content/validate.ts` (shared by the CLI
  `scripts/validate-content.ts`, tests and the runtime loader). Only `reviewed`, valid
  questions are playable; lessons load lazily (one chunk each).
- Learning engine `src/learning/engine.ts`: evaluation for six interaction types, first-
  response evidence per family, hinted answers tracked separately, spaced revisits through a
  different question, badge rule across every objective.

## Persistence

`src/persistence/save.ts`: versioned schema (v2) with migrations, validation/clamping,
corrupt-save backup + notice, private-mode fallback, export/import, confirmed reset.

## Tables

Each lesson is one module `src/tables/Lnn.ts` exporting a `TableDef`: geometry built from
tested mechanisms (`TableBuilder`), named shots, three missions + finale, theme, character
lines, a printed playfield painter (2D canvas → lacquered texture in 3D), a 3D set built
with `SetKit`, and a dollhouse room vignette. `scripts/table-check.ts` gates every table:
structure/reference checks, geometry lint (flipper sweeps, ramp exits, saucer eject paths),
a shot map from controlled cradle/inlane experiments, and multi-seed soaks with an aiming bot
that must complete every mission and the finale with no escapes, tunnelling or stuck spots.

## 3D renderer

`Renderer3D` = `Stage` (renderer, custom moody PMREM environment, HDR composer: MSAA or
FXAA, GTAO on ultra, UnrealBloom, ACES output, grade/vignette) + `TableView` (cabinet,
lacquered printed playfield, every mechanism modelled and synced, lamp light pools, GI) +
`BallView` (transmissive glass ball with a glowing core, contact shadow, light, trail) +
`Effects` + `CameraRig` (presets that always frame the whole table; cinematic moves only while
balls are parked; none with reduced motion) + the table's set. Quality tiers adapt to frame
time. The mansion (`src/app/scene/MansionScene.ts`) reuses the same stage and kit.
