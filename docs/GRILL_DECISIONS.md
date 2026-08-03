# Approved Grill Decisions

Status: confirmed by the user on 2026-08-03.

This document records decisions and evidence from the pre-implementation grill.
It is not an implementation status report.

## Locked Decisions

| Area | Approved decision |
| --- | --- |
| Repository | FF14_Moon is a new standalone application root. |
| Game baseline | Public MVP is pinned to Patch 7.51. The older zh-TW fork's 7.4 data may be used only as an internal investigation fixture. |
| Dynamic scope | Editable levels are limited to audited Patch 7.51 Cosmic Exploration A-rank-and-below synced recipes. Fixed recipes remain fixed. |
| Runtime data | No BestCraft or yyyy.games recipe API dependency at runtime. |
| Offline scope | Browser-local after load; PWA offline reopening is deferred. |
| License | Publish the combined application and complete build source as AGPL-3.0-or-later. |
| Best solution | Finish progress, maximize quality up to target, then minimize steps and duration. |
| Target quality | Maximum quality by default with a custom numeric target. |
| Attribute input | Directly enter final effective level, craftsmanship, control, and CP. |
| Enhancers | Food and medicine are notes in MVP; they do not recalculate stats. |
| Specialist | Player-selectable profile flag, separate from recipe `is_expert`. |
| Reliability | Reliable/adversarial macros are the default; other results are labelled non-guaranteed. |
| Solution history | Keep one adopted successful solution for each recipe and sync level. |
| Failed solve | Keep latest error without replacing a successful solution. |
| Storage | Namespaced, versioned localStorage; IndexedDB is deferred. |
| Clear data | Remove one recipe record or clear all application-owned local data, both with confirmation. |
| Level input | Player's current crafting-job level, integer Lv.10-Lv.100. |
| Mapping | Only versioned, audited complete RecipeLevel mappings may solve. |
| Macro lock | `/mlock` is available but disabled by default. |
| Macro copy | Copy each section independently; no MVP copy-all action. |
| Batch solve | Deferred. Solve one recipe at a time. |
| Frontend | Minimal Vue 3 + TypeScript + Vite app; selectively adapt solver components, not the full BestCraft UI. |
| Data source | Generate production data from a version-pinned Patch 7.51 zh-TW game client. Remote API is cross-check only. |
| Deployment | GitHub Pages is the only formal MVP deployment target. |
| Governance | Create project-specific AGENTS and specification documents before implementation. |
| Test gate | Vitest, Rust tests, and Playwright cover the first Worker/WASM vertical slice. |

## Dynamic Recipe Evidence

The Patch 7.51 BestCraft upstream detector identifies level-synced Cosmic
Exploration recipes by specific RecipeNotebookList ranges and original
RecipeLevel `690`. This is implementation evidence, not a general game-data
semantic contract, so FF14_Moon must compile the supported recipe IDs into a
versioned manifest rather than repeat unversioned magic numbers in the UI.

### Same-name disambiguation fixture

Traditional Chinese BestCraft data returns two rows named `宇宙探索用的紡車`:

| Recipe ID | Original rlv | Notebook | Expert | Expected behavior |
| ---: | ---: | ---: | --- | --- |
| 36173 | 690 | 1496 | false | audited dynamic recipe |
| 36206 | 743 | 1496 | true | fixed expert recipe |

This proves localized name is not a safe identity key.

### In-game mapping fixture

User-provided in-game evidence for Carpenter Lv.79:

- final craftsmanship: 1555;
- final control: 1534;
- final CP: 421;
- recipe: `宇宙探索用的樹液`, Recipe ID 36178;
- original RecipeLevel: 690;
- recipe factors: difficulty 62%, quality 50%, durability 50%;
- displayed difficulty: 1060;
- displayed quality: 2250;
- displayed durability: 40.

The lowest-ID Lv.79 RecipeLevel candidate is ID 418 with base difficulty 1710,
quality 4500, durability 80, progress divider 109, quality divider 89, progress
modifier 100, quality modifier 100, and conditions flag 15.

Applying the recipe factors reproduces the screenshot exactly:

- `floor(1710 * 62 / 100) = 1060`;
- `floor(4500 * 50 / 100) = 2250`;
- `floor(80 * 50 / 100) = 40`.

This verifies the canonical-row convention for this family at Lv.79. It does
not prove every Lv.10-Lv.100 mapping, so transition and ambiguity tests remain
mandatory.

For Recipe 36173 at Lv.79, the audited expected effective recipe is:

- difficulty factor 70% -> difficulty 1197;
- quality factor 62% -> quality 2790;
- durability factor 100% -> durability 80.

## First Technical Gate

Before broad UI work, the application must:

1. load local zh-TW Recipe 36173;
2. resolve audited RecipeLevel 418 for Carpenter Lv.79;
3. construct Status with level 79, craftsmanship 1555, control 1534, CP 421;
4. call Raphael in a browser Worker through WASM;
5. obtain an action sequence or a typed, understandable insufficiency result;
6. re-simulate any sequence with the same simulator version;
7. accept success only with no errors and completed progress;
8. format Traditional Chinese FF14 macro sections of at most 15 lines;
9. verify Recipe 36178 produces 1060/2250/40;
10. record app, data, solver, RecipeLevel, attributes, options, and errors.

If the real profile cannot meet maximum quality, a labelled synthetic profile
may prove the end-to-end integration. The real fixture remains an acceptance
case and must not be rewritten.

## Principal Risks

1. Player-visible level does not uniquely identify a RecipeLevel row.
2. Upstream's lowest-ID query is a convention, not an explicit relation in the
   Recipe sheet.
3. The inspected reference zh-TW fork was a 7.4 snapshot and is insufficient for
   the 7.51 public baseline.
4. The current upstream repository's bundled SQLite is not a zh-TW production
   dataset.
5. Production data generation depends on a readable, version-pinned zh-TW game
   client and compatible extraction tools.
6. Rust, Cargo, and wasm-pack were not present on PATH during the grill.
7. A solver result can fail same-version simulation or miss target quality.
8. Reliable solving may use more time or produce lower quality than optimistic
   solving.
9. localStorage is per origin/browser and can be cleared or evicted.
10. AGPL compliance does not settle game-data, icon, font, translation, or
    trademark redistribution questions.

## Inspected References

- Traditional Chinese fork: <https://github.com/Isla-Liu/ffxiv-best-craft-zhtw>
- Inspected fork commit: `29b6c51442f4756e8c9ff0e9b849a846fd2f8d72`
- BestCraft upstream: <https://github.com/Tnze/ffxiv-best-craft>
- Inspected upstream commit: `e2f363e`
- Upstream release metadata observed during the grill: BestCraft 1.4.0,
  `ffxiv-crafting` 7.4.5, Raphael v0.28.6
- Raphael: <https://github.com/KonaeAkira/raphael-rs>
- AGPL-3.0: <https://www.gnu.org/licenses/agpl-3.0.html>
- Cosmic Exploration guide: <https://na.finalfantasyxiv.com/lodestone/cosmic_exploration/>
- Patch 7.51 notes: <https://na.finalfantasyxiv.com/lodestone/topics/detail/c46881a31a2c90d0965493c921b434eca09113f8>

Observed upstream versions are research inputs, not an automatic dependency
selection. Implementation must pin immutable revisions after compatibility and
license verification.
