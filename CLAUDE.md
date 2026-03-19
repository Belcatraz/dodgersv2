# CLAUDE.md — dodgersv2

Youth baseball game tracking app for the Dodgers. Mobile-first, real-time play logging with lineup management, pitch tracking, defensive setup, and stats dashboard.

## Tech Stack

- **React 19** + **TypeScript 5** (strict mode)
- **Vite 7** — dev server and build tool
- **Zustand 5** — state management with localStorage persistence
- **Lucide React** — icons
- **UUID** — unique IDs

## Commands

```bash
npm run dev       # Dev server (http://localhost:5173)
npm run build     # tsc + vite build → /dist
npm run preview   # Serve production build locally
npm run lint      # ESLint
```

## Project Structure

```
src/
├── App.tsx              # Root component, 4-mode router (lineup/offense/defense/dashboard)
├── store.ts             # Zustand store — all game state and actions (1000+ lines)
├── index.css            # Design system (Dodgers colors, dark theme, utility classes)
├── isCoachView.ts       # Detects coach-view URL param, generates shareable coach link
├── components/
│   ├── LineupManager.tsx    # Roster and batting order setup
│   ├── PitchTracker.tsx     # Pitch count, batter selection
│   ├── BaseballField.tsx    # Interactive SVG field for logging plays
│   └── Dashboard.tsx        # Stats, spray charts, game history
```

## Architecture

**State:** Single Zustand store in `store.ts` with `persist` middleware. Storage key: `dodgers-stats-storage-v2`. Undo history capped at 50 entries as serialized state snapshots.

**App modes:** `lineup` → `offense` ↔ `defense` → `dashboard`. Mode stored in Zustand, not React Router.

**Offense flow:** Pitch logging → hit/out event → baserunner resolution modal → next batter

**Special rules implemented:**
- 5-run rule: auto-switch to defense
- 3-out rule: end of offensive inning
- Force-out logic: triggered for groundouts with runners on base
- HR auto-resolution: all runners score

**Inning advancement:** Automatic only. `computeNextInning(inningLog)` scans the log for innings where both offense (`isOffense: true`) and defense (`isOffense: false`) entries exist — the inning increments to the next incomplete one. Never increments from tab switching alone; only from completing 3 outs on offense or defense.

**Coach view:** Read-only dashboard accessible via `?coach=<token>` URL param. Shows Season and History tabs only. Token generated from `isCoachView.ts`.

**Coordinates:** Click/tap on SVG field records `{x, y}` percentage coordinates for spray chart visualization.

## Data Model

```ts
Player:          { id, name }
AtBatState:      { batterId, inning, pitches, strikes, events[] }
AtBatEvent:      { type: 'pitch'|'hit'|'out'|'error', coordinates? }
Bases:           { first, second, third }  // playerId | null
InningLogEntry:  { inning, isOffense, batterId?, batterName?, result, details[], rbis, outsAfter }
HistoricalGame:  { id, date, opponent, runsScored, opponentScore, atBats[], defensiveActions[], inningLog[], excluded? }
```

`HistoricalGame.excluded?: boolean` — when true, game is hidden from season stats calculations but remains in history. Toggle via `toggleGameExclusion(id)`.

## Defensive Strikeout

`logDefensiveAction('K', 'Out')` — records an out with no fielder assigned. Used for the "K — Strikeout" button in `BaseballField.tsx` (defense mode). Counts toward the 3-out limit and triggers inning advancement.

## Design System

Defined in `index.css`:
- `--dodger-blue: #005A9C`
- `--dodger-red: #EF3340`
- `--bg-dark: #121212`
- Mobile-optimized: 600px max-width, 100dvh, 64px touch targets
- No text selection (`user-select: none`), no iOS elastic scroll

## TypeScript

Strict mode enabled. `noUnusedLocals` and `noUnusedParameters` are enforced — all new code must pass. Target: ES2022.

## Conventions

- All state and actions live in `store.ts` — do not create separate state files
- New store actions must be added to the `functionKeys` array in `store.ts` to be excluded from undo serialization
- Components are thin wrappers over store actions
- Prefer editing existing components over creating new ones
- Mobile-first — all UI decisions optimize for phone use during live games
- No test suite currently exists — verify changes manually in the dev server
