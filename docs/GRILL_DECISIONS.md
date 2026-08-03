# Approved Grill Decisions

Status: original decisions confirmed on 2026-08-03; focused-list and shared-level
amendments confirmed on 2026-08-04.

This document records decisions and evidence from the pre-implementation grill.
It is not an implementation status report.

## Locked Decisions

| Area | Approved decision |
| --- | --- |
| Repository | FF14_Moon is a new standalone application root. |
| Game baseline | Public MVP is pinned to the Traditional Chinese service's Patch 7.2 client build `2026.07.22.0000.0000`. Upstream global-version labels are compatibility evidence, not the product data baseline. |
| Dynamic scope | Editable levels are limited to audited Patch 7.2 Cosmic Exploration A-rank-and-below synced recipes. Fixed recipes remain fixed. |
| Runtime data | No BestCraft or yyyy.games recipe API dependency at runtime. |
| Offline scope | Browser-local after load; PWA offline reopening is deferred. |
| License | Publish the combined application and complete build source as AGPL-3.0-or-later. |
| Best solution | Finish progress, maximize quality up to target, then minimize steps and duration. |
| Target quality | Maximum quality by default with a custom numeric target. |
| Initial quality | Each saved recipe accepts a manual integer from zero through the effective recipe quality. It is persisted and included in solution validity. HQ-ingredient automatic calculation remains deferred until ingredient provenance data is available. |
| Attribute input | Directly enter final effective level, craftsmanship, control, and CP. |
| Enhancers | Food and medicine are notes in MVP; they do not recalculate stats. |
| Specialist | Player-selectable profile flag, separate from recipe `is_expert`. |
| Reliability | Reliable/adversarial solving is opt-in and disabled for new recipe records; non-guaranteed results are labelled. |
| Solution history | Keep one adopted successful solution for each recipe and sync level. |
| Failed solve | Keep latest error without replacing a successful solution. |
| Storage | Namespaced, versioned localStorage; IndexedDB is deferred. |
| Clear data | Remove one recipe record or clear all application-owned local data, both with confirmation. |
| Query history | Opening search results automatically appends each Recipe ID once. Reopening updates its timestamp but never reorders the history. History is per job. |
| Retained list | A separate per-job retained list supports single and batch addition from history. Retaining and unretaining never duplicates or deletes recipe data. |
| Recipe deletion | Clearing history and unretaining are non-destructive. Deleting a full recipe record remains an exact-scope confirmed action. |
| Level input | Each job owns one player-current level. The collapsed profile summary and dynamic-recipe detail edit the same integer value; all audited dynamic recipes for that job use it. |
| Level/profile match | A level change auto-selects an existing same-level profile. If none exists, solving is blocked until the player explicitly creates or copies a same-level profile. |
| Solution state | The current level shows updated, stale (`解答未更新`), or no-solution state. Other-level solutions remain history and are never presented as current macros. |
| Mapping | Only versioned, audited complete RecipeLevel mappings may solve. |
| Macro lock | `/mlock` is available but disabled by default. |
| Macro copy | Copy each section independently; no MVP copy-all action. |
| Macro copy interaction | Clicking either a macro section or its copy button copies that section; copying remains repeatable. |
| Macro section balance | When actions require multiple macro sections, distribute their action lines as evenly as possible while retaining the 15-line limit. |
| Manipulation | `掌握` is opt-in and disabled for new recipe records until the player confirms the skill is learned. |
| Workbench layout | The active attribute-profile editor belongs in the left sidebar. |
| Gearset panel | The UI labels attribute profiles as `配裝`; its left-sidebar panel defaults open only when no profile exists, and keeps the current level visible when collapsed. |
| Compact result layout | Recipe parameters share one row, solver options are collapsed by default, and macro sections appear before the secondary action-sequence detail. |
| Batch solve | Deferred. Solve one recipe at a time. |
| Frontend | Minimal Vue 3 + TypeScript + Vite app; selectively adapt solver components, not the full BestCraft UI. |
| Data source | Generate production data from the legally installed, version-pinned Patch 7.2 zh-TW client build `2026.07.22.0000.0000`. Remote API is cross-check only. |
| Deployment | GitHub Pages is the only formal MVP deployment target. |
| Governance | Create project-specific AGENTS and specification documents before implementation. |
| Test gate | Vitest, Rust tests, and Playwright cover the first Worker/WASM vertical slice. |

## Dynamic Recipe Evidence

The inspected BestCraft upstream detector identifies level-synced Cosmic
Exploration recipes by specific RecipeNotebookList ranges and original
RecipeLevel `690`. Its upstream game-version context is separate from the
Traditional Chinese Patch 7.2 baseline. This is implementation evidence, not a
general game-data semantic contract, so FF14_Moon must compile the supported
recipe IDs into a versioned manifest rather than repeat unversioned magic
numbers in the UI.

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
3. The inspected reference zh-TW fork's version label does not establish
   compatibility with the pinned Traditional Chinese Patch 7.2 client; local
   extraction remains authoritative.
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
- Traditional Chinese Patch 7.2 page: <https://www.ffxiv.com.tw/web/special/dawntrail/patch_7_2/>
- Traditional Chinese Patch 7.2 notes: <https://www.ffxiv.com.tw/web/special/patchnote_log/patch_7.2_notes.html>

Observed upstream versions are research inputs, not an automatic dependency
selection. Implementation must pin immutable revisions after compatibility and
license verification.
