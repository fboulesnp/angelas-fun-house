# Playtest and validation notes

_Written 2026-10-18. Every statement here describes something that was actually run on the
development machine; nothing below is assumed. Where a check was automated or driven by an AI
agent, it says so. No human playtesting, device testing or accessibility validation by people
has taken place yet._

## What "tested" means in this project

| Kind of check | What it is | Where the results are |
|---|---|---|
| Unit / behaviour tests | 36 Vitest tests over physics, session state machine, missions, learning engine, persistence and content integrity. Each was mutation-checked (the test fails when the behaviour it guards is broken). | `tests/*.test.ts`; `npm test` |
| Content validator | Structural, coverage, citation, originality and duplicate checks over 29 lesson files and question banks; cross-lesson duplicate scan. | `npm run check:content`; `docs/content-review.md` |
| Content review | Per lesson: an author agent, an independent science/source reviewer, an independent pedagogy reviewer, a reviser, and a final verifier that alone may mark a question `reviewed`. All AI agents working from the textbook pages (rendered and OCR'd) and from external sources they opened. | `docs/content-review/Lnn.md`; `docs/content-review.md` |
| Table check | Per table: geometry lint, structural rules (one Wonder Pocket, three missions, finale), a shot map built from cradle and inlane-feed trials, and three 20-simulated-minute aiming-bot soaks that must reach the finale, with no escaped balls, non-finite values or stalls. | `node scripts/table-check.ts Lnn`; `docs/validation-report.md` |
| Table review | Each agent-built table had one independent AI review-and-fix pass (playability, science in every on-screen line against the lesson content, art, code), re-running table-check afterwards. | workflow journals; summarised in `BUILD_STATUS.md` |
| Browser e2e | Keyboard-only path through title → chapter list → a game (launch, flip, pause, resume, blur, resize, tab hide, camera change, exit) → Science Explorer question → an in-play Wonder Pocket question → save survives reload. 28 checks in system Chrome. | `npm run check:e2e` |
| Accessibility scan | axe-core over 8 screens (title, mansion list, settings, explorer index and lesson, question panel, journal, game intro). | `npm run check:a11y` |
| Hands-on first-minute sessions | For every table, 75 s of real keyboard play in Chrome driven by a script that launches and flips reactively, answers a question if one opens, and records contacts, callouts, score, balls lost and page errors. This is an AI-driven session, not a human playtest. | `docs/manual-review.json`; `node scripts/first-minute.ts` |
| Performance | Frame-time measurement in Chrome (Metal) at 1600×1000 per quality tier, and whole-frame draw-call counts. | `npm run perf`; numbers below |
| Production build | `npm run build` (TypeScript check + Vite build), then the `dist/` folder served and loaded in Chrome. | numbers below |

## Environments actually used

- One machine: Apple-silicon iMac, macOS 25.6, Google Chrome (system install) driven by
  playwright-core with `--use-angle=metal`. Headless for scripts; the same build was opened in
  the Claude desktop app's browser pane for visual checks.
- Viewports exercised: 1600×1000 and 1400×900 (desktop), 820×1100 (resize mid-game),
  390×844 with a mobile user agent and touch (portrait layout, 3× pixel ratio).
- Not tested: any physical phone or tablet, Safari, Firefox, Windows, a screen reader, a
  gamepad (the gamepad code path is untested), or a child playing. The 2D fallback renderer was played
  by the same scripted first-minute session on L01 (`--renderer 2d`) and screenshotted on
  others (`scripts/shot2d.ts`); it has not had its own full pass.

## Performance (measured)

Measured with `scripts/perf.ts`: 400 frames of auto-flip play per run, headless Chrome with
Metal, 1600×1000, on this Apple-silicon iMac. Draw calls and triangles are whole-frame counts
(all post-processing passes included). The game defaults to **auto**, which starts on High and
steps down if frames run long; Ultra (reflections, ambient occlusion, glass ball) is an opt-in
tier that this machine does not hold at 60 fps.

| Table | Ultra | High | Medium | Low |
|---|---|---|---|---|
| L01 Neon Atom Midway | 24.8 ms avg (40 fps), p95 33 ms, 1599 calls | 7.8 ms (128 fps), p95 15 ms, 644 calls | 4.3 ms (234 fps), p95 7 ms | 2.6 ms (392 fps), p95 5 ms |
| L13 Conservation Clockworks | 24.4 ms (41 fps), p95 40 ms, 2701 calls | 8.3 ms (120 fps), p95 17 ms, 553 calls | 4.5 ms (220 fps), p95 9 ms | 2.7 ms (371 fps), p95 5 ms |
| L17 Rock-Cycle Rollercoaster | 25.4 ms (39 fps), p95 41 ms, 1503 calls | 8.7 ms (115 fps), p95 23 ms, 601 calls | 4.7 ms (212 fps), p95 9 ms | 2.8 ms (360 fps), p95 5 ms |
| L29 Future Garden Grand Finale | 24.3 ms (41 fps), p95 47 ms, 1516 calls | 11.2 ms (89 fps), p95 29 ms, 930 calls | 7.9 ms (127 fps), p95 14 ms | 5.1 ms (195 fps), p95 9 ms |

No phone or tablet was measured; the Medium and Low tiers exist for that class of device but
their real-device frame rates are unknown.

## Results summary

| Area | Result (2026-10-18) |
|---|---|
| Lessons and questions | 29 lesson files; **844 reviewed questions** in play (24–32 per lesson; requirement 696 / 24). Validator: 0 errors, 0 warnings, including the cross-lesson duplicate scan. Every lesson has an author pass, two independent reviews, a revision and a final verification on record. |
| Tables | **29 of 29 pass** `table-check` with 3 × 20-simulated-minute aiming-bot soaks each (finale reached, no escaped balls, no non-finite values, no stalls, 0 warnings). Every table except L01 (hand-built vertical slice) had one independent review-and-fix pass; L24 had its one soak warning (a plunger race in multiball) fixed in the engine. |
| Kickbacks | 24 tables have one; a 15-ball probe returns the ball to play 15/15 on 23 of them and 11/15 on L09. |
| Saucer loops | Probe on L05, L07, L12, L17, L27: no eject feeds back into a saucer by itself (max one pass into a neighbour). |
| Unit / behaviour tests | 72 pass (physics, session, missions, learning, persistence, content), each mutation-checked when added. |
| Keyboard e2e | 28/28 in Chrome: menus, launch, flip, pause/resume, blur, resize, tab hide, camera change, exit, Explorer question, in-play Wonder Pocket question, save survives reload. A separate check confirmed classify questions are one tab stop per row with arrow-key selection. |
| Accessibility scan | axe-core: 0 violations on 8 screens. |
| Hands-on first-minute sessions | 29 tables × 75 s of scripted keyboard play in Chrome (plus L01 on the 2D renderer): 118 launches, 46 balls lost, 3 missions completed, 3 discovery questions answered, scores 37,090–692,090 (median 80,290), **0 page errors**. Per-table notes in `docs/manual-review.json`. |
| Production build | `npm run build` passes (TypeScript check + Vite); main bundle ≈ 87 KB gzipped, three.js ≈ 206 KB gzipped, each table lazy-loaded (12–31 KB gzipped). `dist/` served with `vite preview` and a table loaded and played in Chrome. |
| Content and asset safety | No network calls, no outside images, models or audio; everything procedural or synthesized. No trademarked names in the app. The textbook PDF and extracted text are outside the repository and ignored by git. |

## Known limitations and open items

These are the honest gaps as of this build. None of them blocks play; all of them are worth a
human's eyes before the game is used with a child.

**Not yet done by a person**
- No human has played any table. The hands-on sessions above are scripted keyboard play in
  Chrome; they prove each table launches, flips, scores, parks for questions and saves, not
  that it is fun or fair to a 12-year-old. A real first-minute playtest of a few tables is the
  single most valuable next step.
- No teacher has reviewed the 844 questions. Every question was written and reviewed by AI
  agents against the textbook pages and cited sources, with a verifier that could only mark a
  question `reviewed` after re-checking it. The per-lesson records in `docs/content-review/`
  list the places where the textbook (or its OCR) looked wrong or dated and how the content
  handles each; a teacher should spot-check those first.
- No physical phone or tablet, no Safari or Firefox, no screen reader, no gamepad. The portrait
  layout and touch controls were exercised only in Chrome's mobile emulation.

**Known rough edges in the engine (all tables play around them)**
- The aiming bot that validates tables only aims the lower flippers and learns inlane timings
  from a slow feed, so soak drain counts are pessimistic; a person will drain less. A
  multi-target drop bank always shows as "not reachable" in a shot map because each trial is
  one shot.
- The 3D view draws floor labels for rollovers, targets and saucers but not for ramps,
  portals or spinners, and saucer labels sit at a fixed offset; tables paint those names into
  the playfield art instead.
- Set pieces behind the head of the cabinet (Z < −6.4) are visible only during the opening
  fly-in at desktop framing; every table keeps its spectacle in the side regions.
- L09's left kickback returns 11 of 15 probe balls (all others return 15 of 15).
- The 2D fallback renderer is complete but has had far less attention than the 3D view.

**Content**
- Each lesson bank has 28–32 questions; 24+ per lesson are `reviewed` and in play, a few are
  `needs-review` or `rejected` and never shown. They are kept in the files for the record.
- Explanations and glossary definitions are original wording; the only textbook phrases
  reproduced are section titles and short quoted claims inside review flags.

**Process**
- Work was interrupted three times by account usage limits and resumed from `BUILD_STATUS.md`
  and the workflow journals; the per-table polish pass therefore ran in two batches on
  different days. Nothing was lost, but the dates in the review records reflect that.

## How to reproduce every number above

```bash
npm run check          # typecheck, content validator, unit tests, table-check on all 29 tables
```

```bash
npm run dev            # then, in another terminal:
```

```bash
npm run check:e2e && npm run check:a11y && npm run perf
```

```bash
node scripts/first-minute.ts     # hands-on sessions for all tables (writes docs/manual-review.json)
```

```bash
node scripts/report.ts           # regenerates docs/content-review.md and docs/validation-report.md
```
