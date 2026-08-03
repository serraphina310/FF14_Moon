# Data Provenance and Build Policy

Status: approved policy; production dataset not yet generated.

## Production Source

The Patch 7.51 production recipe package must be generated from a legally
installed, version-pinned Traditional Chinese FINAL FANTASY XIV client using a
documented and reviewable extraction toolchain.

BestCraft's upstream `src-data` implementation is the primary reference. It
reads game Excel sheets through Ironworks and can extract Recipe,
RecipeLevelTable, Item, CraftType, CollectablesShopRefine, WKSMissionRecipe,
WKSMissionToDo, and WKSMissionUnit data.

The implementation must not commit a private local installation path or copy
unrelated client files into the repository.

## Prohibited Production Inputs

- crawling BestCraft pages;
- browser automation or DOM extraction;
- iframe integration;
- treating the live `yyyy.games` API as the production runtime source;
- silently substituting simplified Chinese names;
- combining rows from different patches without an explicit migration and
  verification process;
- selecting ambiguous RecipeLevel rows at runtime by an undocumented
  first-match query.

Remote BestCraft API calls made during the grill were read-only investigations
and cross-checks. They do not authorize a production scraper.

## Required Manifest

Every generated data package must record:

- product data schema version;
- target game patch and client build identity;
- locale;
- extraction-tool repository and immutable commit;
- extraction-tool dependency lockfile hash;
- generation timestamp;
- normalized record counts;
- dynamic-recipe manifest version;
- checksum for each shipped data asset;
- known validation fixtures and results.

## Required Normalized Data

Ship only fields required by the workbench:

- exact recipe ID and crafting job;
- Traditional Chinese result name and item ID;
- original RecipeLevel ID;
- difficulty, quality, durability, and material-quality factors;
- fixed recipe requirements and expert flag;
- recipe notebook or other source fields needed to audit dynamic classification;
- complete RecipeLevel fields used by Status construction;
- collectability thresholds when applicable;
- Cosmic mission duty-action kind and maximum charges;
- explicit supported-dynamic-recipe membership;
- explicit player-level-to-complete-RecipeLevel mapping.

Do not ship internal source fields merely because they are available.

## Dynamic Mapping Audit

The generator must fail when:

- a manifest recipe is missing;
- a recipe's original classification fields differ from the audited expectation;
- a supported player level has no candidate RecipeLevel;
- a player level has multiple candidates and no audited selection;
- a selected row changes without an intentional data-version update;
- an expected complete RecipeLevel field is missing or out of range.

The generated runtime package must contain the selected complete row or an
unambiguous reference to it. Runtime code must not reconstruct the choice by
sorting arbitrary candidates.

## Initial Validation Fixtures

### Recipe 36173 - 宇宙探索用的紡車

- job: Carpenter / 木工師;
- original RecipeLevel: 690;
- RecipeNotebookList: 1496;
- normal recipe;
- dynamic manifest member;
- factors: difficulty 70%, quality 62%, durability 100%;
- Lv.79 selected RecipeLevel: 418;
- Lv.79 effective recipe: difficulty 1197, quality 2790, durability 80.

### Recipe 36206 - 宇宙探索用的紡車

- same localized name as Recipe 36173;
- original RecipeLevel: 743;
- expert recipe;
- not a dynamic manifest member.

### Recipe 36178 - 宇宙探索用的樹液

- original RecipeLevel: 690;
- RecipeNotebookList: 1496;
- normal recipe;
- factors: difficulty 62%, quality 50%, durability 50%;
- Lv.79 selected RecipeLevel: 418;
- required in-game result: difficulty 1060, quality 2250, durability 40.

## Release Update Policy

MVP has no automatic online data updates. A patch update is a deliberate
release change that regenerates data, reviews changed mappings, runs mapping and
browser fixtures, updates notices, increments the data version, and publishes a
matching corresponding-source build.

If a Patch 7.51 zh-TW client or compatible extraction environment cannot be
obtained, data generation is blocked. Stop and report the exact missing input;
do not weaken this policy without a new user decision.
