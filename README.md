# Angela's Fun House

*Where curiosity lights up the world.*

A 3D science pinball adventure for a seventh-grade learner. Every one of the 29 lessons in
*Bring Science Alive! 7th Grade Integrated* is its own playable pinball attraction inside an
impossible fun-house mansion. Restore all 29 Wonderlights by completing science missions
and answering discovery questions in the Wonder Pocket.

## Requirements

- Node.js 20.11+ (developed on Node 26) and npm.
- A modern browser. Full 3D needs WebGL2 (Chrome, Edge, Safari 15+, Firefox); otherwise the
  game falls back to a classic 2D view automatically.
- No accounts, servers, API keys or network access are needed to play.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5199. For the production build:

```bash
npm run build
```

```bash
npm run preview
```

The production build lives in `dist/` and is fully static: copy that folder to any static
host (or open it through any local static file server). It uses relative paths, so it works
from a sub-folder.

## Modes

- **Story Adventure** — the 3D dollhouse map; rooms are suggested in order but all are open.
  Wing openings and celebrations, and a whole-house parade when all 29 Wonderlights return.
- **Choose a Chapter** — every lesson directly selectable from a list.
- **Free Play** — pinball for fun; questions follow the Free Play setting (off / some / lots);
  adventure progress is not changed.
- **Science Explorer** — the calm path: explainer cards, diagrams and the same reviewed
  questions per lesson objective, no flippers needed. Earns the same Science Stars.
- **Practice** (toggle in the room list) — unlimited balls; progress still counts.

## Controls

| Action | Keyboard | Touch | Gamepad |
|---|---|---|---|
| Left / right flipper | ← / → or A / D | left / right half of the table, or ◀ ▶ | bumpers / triggers |
| Launch | hold Space (or ↓), release | tap Launch (or hold for power) | A |
| Pause | P or Esc | ⏸ button | Start |
| Nudge (optional) | N | — | Y |

Keys are remappable in Settings. Keys are ignored while a menu, dialog or text field has focus.

## Saving

Progress (missions, Wonderlights, Science Stars, learning records, settings, cosmetics,
personal bests) saves automatically to this browser's local storage at each checkpoint.
Settings → *Progress and saving* offers export to a file, import, and a confirmed reset. A
damaged save is backed up and replaced with a fresh one (with a notice); if the browser
blocks storage the game still runs and tells you to export.

## Accessibility and comfort

Reduced motion, text size up to 160%, high-contrast panels, sound captions, read-aloud
questions (device voice), separate music/effects volumes, mute, no question timers, auto-
flippers, wider flippers, longer ball save, slower simulation, unlimited-ball practice,
answer lanes, full keyboard operation, and a list view equivalent to the 3D map.

## Checks

```bash
npm run check
```

runs the TypeScript check, the content validator (29 lessons, ≥ 24 reviewed questions each),
the unit/behaviour tests, and `table-check` on every table (geometry lint + aiming-bot soaks).
Browser checks need the dev server running:

```bash
npm run check:e2e
```

```bash
npm run check:a11y
```

```bash
npm run perf
```

## What has been tested, and what has not

Every check that was run is listed with its real result in `docs/playtest-notes.md` and
`docs/validation-report.md`: automated physics and session tests, the content validator, the
per-table geometry lint and aiming-bot soaks, keyboard-only browser checks, an axe-core
accessibility scan, frame-time measurements, and scripted hands-on "first minute" sessions.
All of it ran on one Mac in Chrome, and all content and table reviews were done by AI agents.
No human has playtested the game yet, no physical phone or tablet has run it, and nobody has
tried it with a screen reader. Treat those as the next steps, not as done.

## Where things are

| Path | What |
|---|---|
| `src/game/physics` | fixed-step pinball physics (ball, flippers, collisions) |
| `src/game/table` | mechanisms, builder, table definition types |
| `src/game/rules` | game session state machine, missions |
| `src/game/render3d` | Three.js renderer, set kit, materials, camera |
| `src/game/render` | 2D fallback renderer, procedural art |
| `src/game/audio` | synthesized music and effects |
| `src/tables/Lnn.ts` | one attraction per lesson |
| `src/content` | curriculum index, schema, lesson content and question banks |
| `src/learning` | evaluation, question selection, mastery rule |
| `src/persistence` | versioned local saves |
| `src/app` | screens, mansion scene, components |
| `docs/` | architecture, art direction, authoring guides, content review, validation report, playtest notes, asset ledger |
| `BUILD_STATUS.md` | chapter checklist and current status |

The textbook PDF and any text extracted from it are never part of the app or the repository.
