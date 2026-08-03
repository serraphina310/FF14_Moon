# Third-Party Notices

Status: initial inventory. Update this file whenever third-party source, data,
translations, fonts, icons, or generated artifacts are added.

## BestCraft Traditional Chinese fork

- Project: BestCraft zh-TW
- Source: <https://github.com/Isla-Liu/ffxiv-best-craft-zhtw>
- Inspected commit: `29b6c51442f4756e8c9ff0e9b849a846fd2f8d72`
- License: GNU Affero General Public License v3.0 or later
- Adapted source:
  - `src-libs/src/lib.rs` Status construction and deterministic simulation
    behavior are adapted in `src-wasm/src/core.rs`;
  - `src-libs/src/solver/raphael.rs` is adapted in
    `src-wasm/src/raphael.rs`;
  - `src/libs/Craft.ts` action identifiers and wait times plus
    `src/assets/locales/zh-TW.ftl` action names are adapted in
    `src/macro/actions.ts`;
  - `src/components/designer/tabs/MacroExporter.vue` sectioning behavior is
    adapted in `src/macro/format.ts`.
- The adapted files retain source headers and are distributed under this
  repository's AGPL-3.0-or-later license.

## BestCraft upstream

- Project: BestCraft
- Source: <https://github.com/Tnze/ffxiv-best-craft>
- Pinned reference commit: `e2f363efb19a8a349e30f915bf4074daba5f91ed`
- License: GNU Affero General Public License v3.0 or later
- Current adapted source: the sheet-reading patterns in
  `src-data/src/metadata.rs` are adapted in
  `tools/data-extractor/src/lib.rs`. Current BestCraft WKS raw indexes were
  rejected after validation against the Patch 7.2 zh-TW client.
- Additional imported files must be recorded before distribution.

## Raphael

- Project: raphael-rs
- Source: <https://github.com/KonaeAkira/raphael-rs>
- License: Apache License 2.0
- Runtime version selected for Patch 7.2 compatibility: v0.25.3
- Pinned dependency commit: `9ec209b40f9962df51d60f17a11301c771dc17d9`
- Separately inspected current commit: `411168605989d573d89f2d71c01acac9f099e55a`
- Current reference use: `raphael-data-updater/src/stellar_mission.rs` establishes
  that only Stellar Steady Hand is a synthesis-state charge; Patch 7.2 Action
  `41269` (`奇蹟之材`) is retained as a non-solver mission action.
- Use: `raphael-solver` and `raphael-sim` are source dependencies of the
  browser WASM core, pinned by immutable Git revision in
  `src-wasm/Cargo.toml` and `src-wasm/Cargo.lock`.

## ffxiv-crafting

- Crate: `ffxiv-crafting`
- Source: <https://github.com/Tnze/ffxiv-crafting>
- Version selected for the Traditional Chinese Patch 7.2 baseline: 7.2.0
- License: MIT
- Use: exact-version Rust dependency providing Craft actions, Recipe,
  RecipeLevel, Status construction, and deterministic simulation semantics in
  the browser WASM core.

## Ironworks

- Project: Ironworks
- Source: <https://github.com/ackwell/ironworks>
- Pinned commit: `a9b40991b80f7466c2acdfbbe288e4f524a0301a`
- License: MIT
- Use: build-time extraction from a version-pinned local game client. The
  dependency is not loaded by the deployed site.

## EXDSchema

- Project: xivdev EXDSchema
- Source: <https://github.com/xivdev/EXDSchema>
- Audited Patch 7.2 schema commit: `468f06ee4899b492745e99e77173ea3e4cf1ea53`
- License: no standalone license file was present at the inspected revision;
  redistribution review remains required before copying any schema file.
- Use: field-name and byte-offset audit for `WKSMissionRecipe`,
  `WKSMissionToDo`, and `WKSMissionUnit`. Schema files are not shipped at
  runtime.

## FINAL FANTASY XIV material

FINAL FANTASY XIV names, game data, icons, fonts, screenshots, and trademarks
are not automatically covered by BestCraft's AGPL license. Before public
deployment, record every shipped category, its source, applicable Square Enix
material-usage terms, required attribution, and any excluded assets.

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.
This project is not affiliated with or endorsed by Square Enix.
