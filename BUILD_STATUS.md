# Build status — Angela's Fun House

_Last updated: 2026-10-14 (in progress). This file is the resume point if work is interrupted._

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

## Next actions

1. When the workflows finish: run `npm run check`, `node scripts/table-check.ts` for all 29,
   fix stragglers, assemble `docs/content-review.md`.
2. Quality pass: play each table in the browser, mobile layout, keyboard-only pass, perf.
3. Screenshots + README + validation report.
