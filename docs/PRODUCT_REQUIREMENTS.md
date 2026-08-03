# FF14_Moon Product Requirements

Status: public MVP implemented and locally verified on 2026-08-03
Public data baseline: Traditional Chinese service Patch 7.2, client build
`2026.07.22.0000.0000`
Interface language: Traditional Chinese

## Product Goal

FF14_Moon is a focused, local-first crafting workbench for FINAL FANTASY XIV.
It lets a player search Traditional Chinese recipes, set the current crafting
job level for verified level-synced recipes, solve with locally saved effective
attributes, inspect the result, and copy executable in-game macros without
opening or operating the BestCraft website.

The site may adapt BestCraft source, data tooling, translations, and WebAssembly
solver integrations, but runtime operation must remain independent of the
BestCraft website and its user state.

## Supported Jobs

The MVP supports independent workspaces for:

- 木工師
- 鍛鐵匠
- 甲冑師
- 雕金匠
- 製革匠
- 裁衣匠
- 鍊金術士
- 烹調師

Each job keeps its own recipe records, active attribute profile, and profile
collection.

## Core Flow

1. Select a crafting job.
2. Search the versioned local recipe dataset by Traditional Chinese name.
3. Select an exact recipe row. Selection adds or opens that job's existing
   record using recipe ID identity.
4. For an audited dynamic recipe, enter the player's current level for that job.
5. Select the active effective-attribute profile.
6. Configure the target quality and allowed solver options.
7. Solve in a browser Worker through Rust/WebAssembly.
8. Re-simulate the returned sequence with the same simulator version.
9. Display the result, action sequence, and segmented Traditional Chinese macro.
10. Reopen, change level, or solve again from the job's recipe list.

## Recipe Identity and Search

- Recipe identity MUST be `dataVersion + job + recipeId`.
- A localized name MUST NOT be used for identity or deduplication.
- Same-name normal and expert recipe rows must be shown as distinct choices.
- Searching the same job and recipe ID opens the existing record.
- Fixed RecipeLevel recipes may be searched and solved, but their level cannot
  be arbitrarily modified.

## Dynamic Recipe Level

- The UI asks for the player's current crafting-job level, not a RecipeLevel ID.
- The verified MVP input range is integer Lv.10 through Lv.100.
- Only Patch 7.2 Cosmic Exploration A-rank-and-below recipes present in the
  audited manifest expose this input.
- Every supported player level maps to one complete, audited RecipeLevel row.
- Mapping replaces the full RecipeLevel payload before recipe factors are
  applied.
- Missing or ambiguous mappings block solving with an understandable error.
- Internal IDs, stars, dividers, modifiers, and condition bitmasks are not
  exposed as ordinary player controls.

## Attribute Profiles

Every crafting job may save multiple profiles and select one active profile.
The Traditional Chinese UI labels these profiles as `配裝`. The left-sidebar
panel is collapsible and shows the current crafting-job level in its collapsed
summary.
MVP profile fields are:

- name;
- crafting job level;
- final effective craftsmanship;
- final effective control;
- final effective CP;
- optional food note;
- optional medicine note;
- player-selected specialist-job flag.

The numeric values are the final values after food, medicine, and specialist
bonuses. MVP does not automatically calculate those bonuses. Selecting
specialist status does not add stats again; it controls specialist-dependent
permissions and is included in solution snapshots.

## Solving and Validity

- Solving runs locally through a Web Worker and Rust/WebAssembly.
- Raphael is the preferred solver; the project does not rewrite its algorithm.
- Reliable/adversarial solving is enabled by default and may be disabled
  explicitly.
- `掌握` is disabled for new recipe records until the player explicitly confirms
  that the current crafting job has learned it.
- A non-guaranteed result is visibly labelled.
- A solution is successful only when same-version simulation reports no errors
  and final progress reaches the recipe requirement.
- Target quality is separate from completion. A sequence that completes progress
  but misses target quality is reported as such.
- The default target is maximum recipe quality. Custom numeric targets are
  supported; collectability threshold shortcuts may be shown when data exists.
- Cosmic duty-action availability and charges come from recipe metadata.
- Solver, Worker, WASM, insufficient-attribute, mapping, simulation, and storage
  failures must have understandable UI states.

The adopted solution ordering is:

1. finish progress;
2. maximize quality up to the configured target;
3. minimize action count;
4. minimize macro duration.

"Best" always means best under the recorded recipe, attributes, solver version,
and options. It is not an absolute cross-version claim.

## Result and Macro Output

At minimum, show:

- solve status and reliability;
- action sequence;
- final progress and target;
- final quality and target;
- remaining durability;
- remaining CP;
- total action count;
- estimated macro time;
- formatted Traditional Chinese game macros.

Macro rules:

- no section may exceed 15 lines;
- auxiliary commands count toward the limit;
- `/mlock` is available but disabled by default;
- completion notification uses the inherited automatic strategy;
- each section can be copied by clicking its content or its independent copy
  button, and the same section can be copied repeatedly;
- MVP has no combined "copy all" action;
- Patch 7.2 non-solver Cosmic duty actions are displayed with their audited
  charge limit and are not fabricated into a macro; a future synthesis-state
  action requires a separately verified executable command before support;
- simulator-only or alias actions require a verified executable equivalent.

## Local Persistence

MVP uses a namespaced, versioned localStorage document containing:

- per-job recipe records;
- current sync level;
- attribute profiles and active profile;
- one adopted successful solution per recipe and sync level;
- solution input snapshot and options;
- latest solve error and timestamps;
- schema, app, data, and solver versions.

Changing attributes, RecipeLevel, options, data version, or solver version marks
an existing solution stale instead of silently accepting or deleting it.
Re-solving the same level replaces that level's adopted successful solution.
A failed solve does not replace a successful one.

Provide:

- removal of one recipe record from the current job;
- clearing all application-owned local data;
- explicit confirmation and scope description for both actions.

Normal refresh and reopening on the same browser origin must retain data.
Cross-device sync, permanent backup, and migration across origins are not MVP
guarantees.

## Information Architecture

The focused workbench contains:

1. crafting-job switcher;
2. current job's recipe search and saved recipe list;
3. recipe details and identity disambiguation;
4. verified dynamic-level input;
5. active effective-attribute profile in the left sidebar;
6. solver controls and state;
7. result and macro sections;
8. lightweight other-level solution history;
9. settings and destructive-data controls.

Do not reproduce the complete BestCraft interface.

## Runtime and Deployment

- Public deployment target is GitHub Pages.
- Recipe data, translations, Worker, simulator, and WASM are deployed assets.
- Core search, solve, simulation, macro formatting, and persistence have no
  runtime dependency on BestCraft or `yyyy.games` APIs.
- Hash routing is preferred if multiple routes are required.
- Repository-path deployment must use the correct Vite base path.
- Full offline/PWA reopening is deferred; after the application has loaded,
  solving remains local.

## Licensing

- The combined site and build source are published under AGPL-3.0-or-later.
- Deployed builds prominently link to matching complete corresponding source.
- BestCraft attribution and modified-file notices are retained.
- Raphael and other dependencies retain their own notices.
- FFXIV game data, names, images, fonts, translations, and marks receive separate
  provenance and notice review.

## MVP Acceptance

Automated and/or browser acceptance must cover:

- eight independent job recipe collections;
- recipe-ID deduplication and same-name disambiguation;
- dynamic-level changes selecting new audited RecipeLevel data;
- attribute changes marking old solutions stale;
- active-profile switching;
- persistence after refresh;
- macro sections of at most 15 lines;
- Traditional Chinese action names;
- same-version simulation success;
- safe failure for missing RecipeLevel mapping;
- understandable Worker/WASM failure;
- scoped destructive-data operations;
- source and license links for the deployed version.

## Deferred Scope

- PWA/offline reopening;
- IndexedDB;
- JSON import/export;
- batch re-solving;
- combined macro copy;
- full equipment and materia simulation;
- automatic food and medicine calculation;
- accounts, cloud sync, backend services, and social sharing;
- automatic online data updates;
- multiple same-level solution versions;
- generic dynamic-recipe mechanisms outside the audited Patch 7.2 scope.
