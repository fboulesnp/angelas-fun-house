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
  gamepad (the gamepad code path is untested), or a child playing. The 2D fallback renderer
  was only checked by screenshot (`scripts/shot2d.ts`), not played.

## Performance (measured)

RESULTS_PERF

## Results summary

RESULTS_SUMMARY

## Known limitations and open items

RESULTS_LIMITATIONS

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
