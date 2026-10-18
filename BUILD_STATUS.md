# Build status — Angela's Fun House

_Last updated: 2026-10-18 03:55. **Build complete.** This file stays the resume point for any follow-up work._

**State (2026-10-18):** every milestone below is done and committed. `npm run check` passes
(TypeScript, content validator 844 reviewed / 0 errors, 72 tests, 29/29 tables), `npm run build`
produces `dist/`, and the handoff documents are in `docs/` (`playtest-notes.md`,
`validation-report.md`, `content-review.md`, `manual-review.json`, `asset-ledger.md`) with the
gallery in `screenshots/`. The workflow runs that produced content and tables are finished; nothing
is left queued. The dev server used for the checks may still be running on http://localhost:5199.

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Audit + foundation (manifest verified, schema, validator, architecture) | Done |
| 2 | Vertical slice: L01 Neon Atom Midway (physics, missions, questions, audio, saving, 3D) | Done — passes table-check (4 seeds × 20 min) |
| 3 | Architecture stress check (cycle table + ecosystem table) | Done — L07 Planet Carousel and L06 Food-Web Forest built, reviewed, passing |
| 4 | Full game: 29 tables, 696+ questions, mansion map, journal, explorer, celebrations | Done — 29/29 tables pass table-check (3 × 20-min soaks, 0 warnings), every table reviewed; 844 reviewed questions |
| 5 | Quality pass (every chapter, desktop/mobile, a11y, perf, audio) | Done — every table reviewed + 20-min soaks; e2e 28/28; axe 0 violations; classify radiogroup keyboard fix; kickback + saucer-loop probes; hands-on first-minute sessions on all 29 (0 page errors); frame times measured; audio runtime check |
| 6 | Handoff (README, reports, screenshots) | Done — README, playtest notes, validation report, content review record, asset ledger, 25 screenshots, production build |

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
| L24 | Heatwave Ice Palace | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
| L25 | Rumble Mountain Rescue | 28 reviewed, 0 errors | PASS | built + independent review-and-fix pass |
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
- Tests: 72 unit/behaviour/content tests (added ramp layer return, portal transit/exit/save, lamp reset,
  celebration progress range, Free Play with questions off, plunger carrying every ball on the rod).
- 2026-10-18: plunger multiball race fixed (second ball on the rod was left trapped under the tip);
  fireworks/diverter per-frame allocations removed; warm fill lights no longer print ball-like dots;
  map first-frame dt clamped; celebration progress clamped to 0..1.

## Next actions (for a person)

1. Play the first minute of a few tables (L01, L13, L17, L29 are good contrasts) and note what
   feels unfair or unclear; everything so far was AI-driven.
2. Have a teacher spot-check `docs/content-review.md`, starting with the "Source review flags"
   table, before classroom use.
3. Open `dist/` (or `npm run dev`) on a real phone or tablet and in Safari; the Medium/Low
   graphics tiers were built for that but never measured on a device.
4. If anything is changed: `npm run check`, then `node scripts/report.ts` and
   `node scripts/first-minute.ts` to regenerate the records.
