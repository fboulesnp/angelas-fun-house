# Build status — Angela's Fun House

_Last updated: 2026-10-17 22:10 (in progress). This file is the resume point if work is interrupted._

**Resume point (2026-10-17 22:10):** the account hit its weekly limit on 2026-10-15; work resumed
after the reset.

- Content: run `wf_bd7e9274-73c` (script `afh-content-banks`, args in the session scratchpad
  `content-args.json`) resumed. All 26 remaining lessons have science + pedagogy reviews; 13 are
  revised; final verification (the only step that marks questions `reviewed`) is running.
- Tables: the original `afh-tables` run is retired. All 23 completed builds were kept. A new run
  `wf_efca48d9-78e` (script `afh-tables-finish`, args `tables-finish-args.json`) finishes the five
  interrupted drafts (L13, L26–L29) and gives all 28 agent-built tables one independent
  review-and-fix pass. Final verification is scripted (`check-all-tables.ts`, gallery), not agents.
- The shared dev server runs with `AFH_NO_HMR=1` so screenshots aren't interrupted by reloads.

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Audit + foundation (manifest verified, schema, validator, architecture) | Done |
| 2 | Vertical slice: L01 Neon Atom Midway (physics, missions, questions, audio, saving, 3D) | Done — passes table-check (4 seeds × 20 min) |
| 3 | Architecture stress check (cycle table + ecosystem table) | Done — L07 Planet Carousel and L06 Food-Web Forest built, reviewed, passing |
| 4 | Full game: 29 tables, 696+ questions, mansion map, journal, explorer, celebrations | 29/29 tables pass table-check (20-min soaks); 844 reviewed questions; L24/L25 polish pass finishing |
| 5 | Quality pass (every chapter, desktop/mobile, a11y, perf, audio) | Pending |
| 6 | Handoff (README, reports, screenshots) | Pending |

## How work is produced

- Content: workflow `afh-content-banks` (author → science review + pedagogy review → revise →
  independent verify), per lesson. Gate: `node scripts/validate-content.ts --lesson Lnn` = 0 errors.
- Tables: workflow `afh-tables` (build → review → revise → verify), per lesson. Gate:
  `node scripts/table-check.ts Lnn` = PASS, plus 3D screenshots at levels 0 and 4.

## Chapter checklist

Columns: content (reviewed questions / validator), table (table-check), manual review.

| Lesson | Attraction | Content | Table | Notes |
|---|---|---|---|---|
| L01 | Neon Atom Midway | 27 reviewed, 0 errors | PASS | vertical slice, hand-tuned |
| L02 | Molecule Masquerade | 29 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L03 | Mystery Material Manor | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L04 | Sunbeam Conservatory | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L05 | Mitochondria Midnight Express | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L06 | Food-Web Forest | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L07 | Planet Carousel | 29 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L08 | Canyon of Clues | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L09 | Deep-Time Dream Machine | 31 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L10 | Four-Sphere Skyworks | 30 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L11 | Glacier Clocktower | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L12 | Reaction Revelry | 29 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L13 | Conservation Clockworks | 30 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L14 | Firelight & Frost Pavilion | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L15 | Inventor's Wonderworks | 31 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L16 | Pangaea Puzzle Palace | 32 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L17 | Rock-Cycle Rollercoaster | 31 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L18 | Raindrop Royal Regatta | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L19 | Resource Treasure Railway | 29 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L20 | Habitat Hide-and-Seek | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L21 | Wild Alliance Ballroom | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L22 | Comeback Garden | 30 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L23 | Particle Dance Party | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L24 | Heatwave Ice Palace | 28 reviewed, 0 errors | PASS (polish pass running) | built, independent review in progress |
| L25 | Rumble Mountain Rescue | 28 reviewed, 0 errors | PASS (polish pass running) | built, independent review in progress |
| L26 | Stormwater Harbor | 29 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L27 | Biodiversity Lantern Festival | 30 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L28 | Living World Market | 31 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L29 | Future Garden Grand Finale | 32 reviewed, 0 errors | PASS | built + independent review-and-fix pass |

## Done since the 3D switch (verified)

- Three.js PBR renderer (`src/game/render3d`), quality tiers (measured on this Mac in Chrome,
  1600×1000: Ultra ≈46 fps, High ≈111 fps, Medium ≈216 fps, Low ≈324 fps), 2D fallback.
- 3D mansion title + dollhouse map with opening façade, room vignettes, 3D celebration parade.
- How-to-play, opening story, answer lanes, cosmetics (trails, trims, sticker album), error boundary.
- Tests: 30 Vitest behaviour tests (mutation-checked); keyboard e2e 20/20; axe 0 violations on
  8 screens; audio runtime check passes; production build OK (three.js split into its own chunk).

## Fixed on 2026-10-15 (verified)

- Tab hide paused and immediately un-paused the game (two handlers toggled pause); now pauses once.
- Mission lamps from a finished collect stage stayed lit; they now go dark (new unit test).
- L01's kickback fired into the left orbit's exit deflector and drained (5/15 saves in a probe);
  the deflector is now a one-way gate (15/15). L01 table-check still PASS, fewer drains.
- Celebration camera now pulls back to reveal the awakened set; camera update no longer allocates.
- Set animations freeze while paused; string lights are instanced (one draw call per colour).
- Explorer shows each lesson's key words and textbook sections; each attraction has its own key,
  motif and chime layer inside its wing theme.
- e2e now also covers resize mid-game, tab hide, camera change from Pause, and a Wonder Pocket
  question answered by keyboard with the save surviving a reload (28/28 PASS).
- Tests: 34 unit/behaviour tests (added ramp layer return, portal transit/exit/save, lamp reset).

## Next actions

1. When the workflows finish: run `npm run check`, `node scripts/table-check.ts` for all 29,
   fix stragglers, assemble `docs/content-review.md`.
2. Quality pass: play each table in the browser, mobile layout, keyboard-only pass, perf.
3. Screenshots + README + validation report.
