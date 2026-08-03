# Local Storage Schema

Status: schema version 1 implemented on 2026-08-03.

## Boundary

- Storage mechanism: browser `localStorage`.
- Application-owned key: `ff14-moon:workbench`.
- Current schema version: 1.
- No account, backend, database, cloud sync, or cross-origin migration is
  implied.
- Clearing all FF14_Moon data removes only the application-owned key.

Schema version 1 is the first persisted schema released by this repository, so
there is no earlier production schema to migrate. The loader has an explicit
version boundary: malformed data and unknown older or newer versions are
reported and left untouched. A future schema change must add and test a
specific forward migration before increasing the current version.

## Document shape

The root document records schema, app, data, and solver versions plus created
and updated timestamps. It contains exactly one workspace for each of the eight
crafting jobs.

Each job workspace owns:

- saved recipe records, keyed semantically by Recipe ID;
- effective-attribute profiles with stable IDs;
- the active profile ID.

Each recipe record owns:

- current player/sync level;
- created, updated, last-viewed, and last-solved timestamps;
- the latest typed solve failure;
- at most one adopted successful solution for each player level.

Each adopted solution is a deep-copied immutable snapshot containing:

- Recipe ID, player level, complete RecipeLevel, and recipe factors;
- profile identity, final effective values, enhancer notes, and specialist
  flag;
- solver options;
- action sequence, same-version simulation result, and formatted macro;
- app, data, and solver versions;
- solved timestamp and deterministic input fingerprint.

## Replacement and stale rules

- Reopening the same Recipe ID in the same job updates its view timestamp and
  does not add a duplicate.
- A successful verified solve replaces only the solution at that recipe's
  current level.
- Other-level solutions remain lightweight history.
- A failed solve updates the latest error but never replaces a successful
  solution.
- Staleness is derived by comparing the saved fingerprint with the current
  complete RecipeLevel, recipe factors, profile ID and solver-relevant values,
  options, and app/data/solver versions.
- Renaming a profile alone does not make a mathematically identical solution
  stale; changing values, enhancer notes, specialist state, active profile,
  RecipeLevel, options, or version boundary does.

## Failure behavior

- Parse and structural validation failures return an empty in-memory fallback
  for continued operation but do not overwrite the stored raw payload.
- Unknown schema versions are never downgraded.
- Quota, access, write-verification, and clear-verification failures are typed
  and user-displayable.
- In-memory changes remain distinguishable from successfully persisted state so
  the UI can report an unsaved condition.
