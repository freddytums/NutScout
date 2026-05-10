# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173/NutScout/)
npm run build     # TypeScript check + Vite production build → dist/
npm run lint      # ESLint
npm run preview   # Preview the production build locally
```

## Environment Setup

Copy `.env.example` to `.env.local` and fill in Firebase credentials before running the dev server. Without a real Firebase project, the app will load but auth and data persistence won't work.

## Architecture

**Tech stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Firebase (Auth + Firestore + Storage)

**Hosting:** GitHub Pages via `/.github/workflows/deploy.yml`. Firebase secrets live in GitHub repository secrets. The Vite `base` is `/NutScout/`.

### Modular Game Config System

The core abstraction enabling multi-season support is `src/config/games/`. Each FRC season is a single config file implementing `GameConfig` from `src/types/game.ts`.

```
src/config/games/
  index.ts     # getGameConfig(year) + getAvailableYears()
  2026.ts      # 2026 "Rebuilt" season config
  types.ts     # Re-exports from src/types/game.ts
```

To add a new season: create `20XX.ts` following `2026.ts`, register it in `index.ts`. The `FormRenderer` dynamically generates UI for any `GameField[]` without code changes.

**Field types:** `counter | toggle | select | rating | text | textarea | timer | path`

The `path` type renders the **Auto Path Tracer** — a canvas overlay where scouts draw the robot's autonomous path by touch/mouse. Paths are stored as arrays of normalized `[0,1]` coordinate segments in Firestore.

### Data Flow

```
Firebase Firestore (real-time)
  └─ events/{eventId}
       ├─ (EventConfig document)
       ├─ pits/{teamNumber}    ← PitEntry (status, dibbedBy, data)
       └─ matches/{matchId}   ← MatchEntry (data, flags, metadata)

src/lib/firestore.ts  ← all Firestore reads/writes + real-time subscriptions
src/hooks/
  useAuth.ts     ← Google Auth via Firebase, syncs to AppUser in Firestore
  usePits.ts     ← subscribes to pits collection, exposes claim/unclaim/submitPit
  useMatches.ts  ← subscribes to matches collection, exposes submit/flag
src/store/
  authStore.ts   ← Zustand: current AppUser + loading state
  eventStore.ts  ← Zustand (persisted): current event ID + EventConfig
```

Firestore IndexedDB persistence is enabled in `src/lib/firebase.ts` so the app works offline at FRC venues with unreliable WiFi.

### Pit Map

`src/pages/PitMap.tsx` renders an interactive grid from `EventConfig.pitLayout` (rows × cols). Each cell maps `"row-col"` keys to team numbers via `EventConfig.teamAssignments`.

Pit status transitions: `unclaimed → dibbed → scouted`. Dibs are real-time — all scouts see updates instantly via Firestore listeners. Only the dibber can release or mark complete.

### Data Quality (Lead Dashboard)

`src/lib/dataQuality.ts` contains pure functions for:
- **Duplicate detection:** same team + match + alliance + type
- **Outlier detection:** IQR method on numeric fields, flags anything >1.5× IQR outside Q1/Q3
- **Coverage gaps:** teams with fewer than N matches scouted

The `LeadDashboard` page calls `runAllChecks(matches, teams)` and categorizes results as `error` (duplicates, zero coverage) or `warning` (outliers, low coverage).

### Roles

`AppUser.role` is `scout | lead | admin`. The `lead` nav item only appears for `lead` and `admin` roles. Role is set in Firestore and must be updated manually (or by an admin UI — not yet built).

### Design Tokens

All colors use CSS custom properties defined in `src/index.css` as HSL values (e.g. `hsl(var(--accent))`). The palette is OLED dark mode with a green (`#22C55E`) accent. Typography: Orbitron (headings), JetBrains Mono (`font-data` utility class for numbers/data), Inter (body).

## Adding a New Season

1. Create `src/config/games/20XX.ts` — copy structure from `2026.ts`
2. Register in `src/config/games/index.ts`
3. Set `activeGameYear: 20XX` on the `EventConfig` document in Firestore
4. Optionally add the field image to `public/field-20XX.png`
