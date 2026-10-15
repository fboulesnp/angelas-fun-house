# Build status — Angela's Fun House

_Last updated: 2026-10-15 13:40 (in progress). This file is the resume point if work is interrupted._

**Resume point (2026-10-15):** both workflows hit the account session limit on 2026-10-14 and were
resumed on 2026-10-15 from their journals (completed agents replay from cache):

- Content: run `wf_bd7e9274-73c` (script `afh-content-banks`, args in the session scratchpad
  `content-args.json`). All 29 lessons are authored; L01/L06/L13 are reviewed; the other 26 are in
  science/pedagogy review → revise → verify.
- Tables: run `wf_7a38e426-cf1` (script `afh-tables`). L02–L10, L12, L14, L15 are built (table-check
  PASS) and in review; L11, L13, L16–L29 are being built.
- The shared dev server runs with `AFH_NO_HMR=1` so screenshots aren't interrupted by reloads.

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Audit + foundation (manifest verified, schema, validator, architecture) | Done |
| 2 | Vertical slice: L01 Neon Atom Midway (physics, missions, questions, audio, saving, 3D) | Done — passes table-check (4 seeds × 20 min) |
| 3 | Architecture stress check (cycle table + ecosystem table) | In progress via table workflow (L07, L06) |
| 4 | Full game: 29 tables, 696+ questions, mansion map, journal, explorer, celebrations | In progress (two background workflows) |
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
| L02 | Molecule Masquerade | in workflow | in workflow | |
| L03 | Mystery Material Manor | in workflow | in workflow | |
| L04 | Sunbeam Conservatory | in workflow | in workflow | |
| L05 | Mitochondria Midnight Express | in workflow | in workflow | |
| L06 | Food-Web Forest | 28 reviewed, 0 errors | in workflow | |
| L07 | Planet Carousel | in workflow | in workflow | |
| L08 | Canyon of Clues | in workflow | in workflow | |
| L09 | Deep-Time Dream Machine | in workflow | in workflow | |
| L10 | Four-Sphere Skyworks | in workflow | in workflow | |
| L11 | Glacier Clocktower | in workflow | in workflow | |
| L12 | Reaction Revelry | in workflow | in workflow | |
| L13 | Conservation Clockworks | 30 reviewed, 0 errors | in workflow | |
| L14 | Firelight & Frost Pavilion | in workflow | in workflow | |
| L15 | Inventor's Wonderworks | in workflow | in workflow | |
| L16 | Pangaea Puzzle Palace | in workflow | in workflow | |
| L17 | Rock-Cycle Rollercoaster | in workflow | in workflow | |
| L18 | Raindrop Royal Regatta | in workflow | in workflow | |
| L19 | Resource Treasure Railway | in workflow | in workflow | |
| L20 | Habitat Hide-and-Seek | in workflow | in workflow | |
| L21 | Wild Alliance Ballroom | in workflow | in workflow | |
| L22 | Comeback Garden | in workflow | in workflow | |
| L23 | Particle Dance Party | in workflow | in workflow | |
| L24 | Heatwave Ice Palace | in workflow | in workflow | |
| L25 | Rumble Mountain Rescue | in workflow | in workflow | |
| L26 | Stormwater Harbor | in workflow | in workflow | |
| L27 | Biodiversity Lantern Festival | in workflow | in workflow | |
| L28 | Living World Market | in workflow | in workflow | |
| L29 | Future Garden Grand Finale | in workflow | in workflow | |

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
