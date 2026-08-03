# Architecture Boundary

Status: public MVP boundaries implemented and verified locally on 2026-08-03.

## Shape

FF14_Moon is one static Vue application deployed to GitHub Pages. It has no
runtime backend and no runtime recipe-data service.

```text
Versioned static recipe assets
             |
             v
Vue workbench/domain state ----> Web Worker ----> Rust/WASM solver
             |                                      |
             |                                      v
             |                              same-version simulator
             v                                      |
versioned localStorage <---- adopted result <-------+
             |
             v
Traditional Chinese macro formatter
```

## Components

### Static data package

Contains normalized recipes, RecipeLevel rows, item and job names,
collectability metadata, Cosmic mission duty-action limits, and a dynamic-recipe
manifest. It is read-only at runtime and includes a version manifest and
checksum.

### Domain layer

Plain TypeScript owns recipe identity, complete RecipeLevel application, factor
rounding, solution fingerprints, stale detection, history replacement, macro
sectioning, and persistence schema migration. Domain behavior must remain
testable without Vue components.

### Vue UI

Owns job navigation, search, forms, visible solver state, results, history, and
destructive confirmations. It does not infer internal RecipeLevel IDs or mutate
solver state outside typed domain operations.

### Worker adapter

Each solve runs off the UI thread. The adapter returns typed loading, success,
cancelled, insufficient, mapping, simulation, WASM-load, out-of-memory, and
unexpected-error states. Avoid unbounded parallel Workers.

### Rust/WASM core

Adapts the audited recipe and attributes into the existing BestCraft-compatible
Status, invokes pinned Raphael solver code, and exposes same-version simulation.
Do not rewrite solver algorithms or duplicate game formulas in Vue.
For the Patch 7.2 baseline, `ffxiv-crafting` is fixed to 7.2.0 and Raphael is
fixed to commit `9ec209b40f9962df51d60f17a11301c771dc17d9` (v0.25.3).

### Persistence adapter

MVP uses one namespaced localStorage root with explicit schema version. The
adapter owns parse validation, migration, write verification, corruption
reporting, and scoped reset. Vue components do not call localStorage directly.

### Macro formatter

Transforms verified actions into executable Traditional Chinese game commands,
accounts for every auxiliary line, and validates sections at or below 15 lines.
`/mlock` is opt-in. Each section is copied independently.

## Data Ownership

- Static recipe assets own immutable game and mapping data.
- Attribute profiles own user-entered final effective values and enhancer notes.
- Recipe records own current player level, timestamps, latest error, and
  adopted per-level solutions.
- A solution owns immutable recipe, RecipeLevel, attribute, option, app, data,
  and solver snapshots.
- Derived stale state is calculated from fingerprints; it is not silently
  cleared when the current profile changes.

## Route and Deployment Boundary

The application should remain usable as one focused route. If settings or
license information requires separate routes, use hash routing so direct reload
works on GitHub Pages. All static asset URLs must honor the configured Vite base
path.

## Failure Boundaries

- Data or mapping failure blocks Status construction.
- Worker or WASM loading failure preserves existing results and local data.
- Solver insufficiency is a normal typed outcome, not an exception-only UI.
- Simulation failure rejects adoption of the candidate sequence.
- Storage failure leaves in-memory state visibly unsaved and preserves the last
  readable serialized payload where possible.
- Unknown persisted schema versions are never downgraded or overwritten.

## Deliberately Excluded Architecture

- backend API, database, authentication, and cloud sync;
- runtime access to BestCraft or yyyy.games;
- Tauri desktop integration;
- iframe, DOM control, or browser automation integration with another site;
- service worker/PWA during MVP;
- IndexedDB before measured need;
- generic plugin systems or solver abstractions for hypothetical solvers;
- complete gear, materia, food, or medicine calculation engines.
