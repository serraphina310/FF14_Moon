# Local Storage Schema

Status: schema version 4 implemented and locally verified on 2026-08-04.

## Boundary

- Storage mechanism: browser `localStorage`.
- Application-owned key: `ff14-moon:workbench`.
- Current schema version: 4.
- No account, backend, database, cloud sync, or cross-origin migration is
  implied.
- Clearing all FF14_Moon data removes only the application-owned key.

Schema version 1 is the first persisted schema released by this repository.
The loader migrates schema 1 to schema 2 by adding zero initial quality where
the field did not exist, then migrates schema 2 to schema 3 by selecting manual
initial-quality mode and adding an empty HQ-quantity map without changing the
saved numeric value. Schema 3 migrates to schema 4 by preserving recipe-array
order as query-history order, selecting the active profile's level (or the most
recent legacy recipe level) as the job level, removing the duplicated
per-recipe current level, and creating an empty retained list. No recipe,
preference, error, or solution is discarded. Malformed data and unknown older
or newer versions are
reported and left untouched. A future schema change must add and test a
specific forward migration before increasing the current version.

## Document shape

The root document records schema, app, data, and solver versions plus created
and updated timestamps. It contains exactly one workspace for each of the eight
crafting jobs.

Each job workspace owns:

- one current player level;
- recipe records, keyed semantically by Recipe ID;
- stable query-history Recipe IDs in first-query order;
- manually retained Recipe IDs in insertion order;
- effective-attribute profiles with stable IDs;
- the active profile ID.

Each recipe record owns:

- created, updated, last-viewed, and last-solved timestamps;
- the latest typed solve failure;
- current solver and macro preferences, even before a successful solve;
- the initial-quality source (`manual` or audited HQ ingredients) and HQ amount
  for each material slot;
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

- Reopening the same Recipe ID in the same job updates its view timestamp,
  does not add a duplicate, and never reorders query history.
- Clearing query history removes only the history IDs. Unretaining removes only
  the retained ID. Both leave recipe records and solutions intact.
- A successful verified solve replaces only the solution at that recipe's
  current level.
- Other-level solutions remain lightweight history.
- A failed solve updates the latest error but never replaces a successful
  solution.
- The immutable input fingerprint records the complete solve-time profile and
  inputs for audit and persistence.
- Display staleness compares RecipeLevel, recipe factors, initial quality,
  options, and app/data/solver versions. Profile values, notes, specialist
  state, and active-profile choice do not change the updated/stale label.
- The informational `裝備有更新` flag compares the active profile `updatedAt`
  with the current solution `solvedAt`; it does not alter staleness.

## Failure behavior

- Parse and structural validation failures return an empty in-memory fallback
  for continued operation but do not overwrite the stored raw payload.
- Unknown schema versions are never downgraded.
- Quota, access, write-verification, and clear-verification failures are typed
  and user-displayable.
- In-memory changes remain distinguishable from successfully persisted state so
  the UI can report an unsaved condition.
