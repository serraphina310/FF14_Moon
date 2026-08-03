# Browser Technical Validation

Status: passed on 2026-08-03.

## Version boundary

- Traditional Chinese data: Patch 7.2, client build
  `2026.07.22.0000.0000`.
- Dynamic manifest: `zh-tw-7.2-cosmic-v1`.
- `ffxiv-crafting`: 7.2.0.
- Raphael solver and simulator: v0.25.3, commit
  `9ec209b40f9962df51d60f17a11301c771dc17d9`.
- Runtime boundary: local static JSON -> browser Worker -> local WASM. No
  BestCraft page, API, or runtime data request is used.

## Required fixture

- Search job: Carpenter (`木工師`).
- Search text: `宇宙探索用的紡車`.
- Selected identity: Recipe 36173, not same-name fixed expert Recipe 36206.
- Classification: dynamic normal recipe.
- Player level: 79.
- Selected complete RecipeLevel: 418.
- Effective attributes: craftsmanship 1555, control 1534, CP 421.
- Recipe factors: difficulty 70%, quality 62%, durability 100%.
- Effective recipe: difficulty 1197, quality 2790, durability 80,
  conditions flag 15.
- Solver options: adversarial on; Manipulation allowed; specialist actions,
  Trained Eye, and progress backloading off.

## Verified result

Raphael returned the following nine actions:

1. Manipulation (`掌握`)
2. Innovation (`改革`)
3. Preparatory Touch (`坯料加工`)
4. Preparatory Touch (`坯料加工`)
5. Preparatory Touch (`坯料加工`)
6. Byregot's Blessing (`比爾格的祝福`)
7. Veneration (`崇敬`)
8. Groundwork (`坯料製作`)
9. Groundwork (`坯料製作`)

The same-version simulator independently accepted every action and produced:

- progress 1197 / 1197;
- quality 2790 / 2790;
- durability 0;
- CP 109;
- no simulation errors;
- completed, target quality reached, and verified all true.

The Traditional Chinese macro is one ten-line section including its completion
notice, has an estimated wait time of 24 seconds, and does not include `/mlock`
by default:

```text
/ac 掌握 <wait.2>
/ac 改革 <wait.2>
/ac 坯料加工 <wait.3>
/ac 坯料加工 <wait.3>
/ac 坯料加工 <wait.3>
/ac 比爾格的祝福 <wait.3>
/ac 崇敬 <wait.2>
/ac 坯料製作 <wait.3>
/ac 坯料製作 <wait.3>
/echo 巨集 #1 已完成！ <se.1>
```

The release WASM Chrome Playwright run completed the end-to-end case in 5.7
seconds on the validation machine. This duration is diagnostic, not a product
performance guarantee.

## Secondary in-game fixture

Recipe 36178 (`宇宙探索用的樹液`) is also classified as dynamic. At player
Lv.79 it selects the same complete RecipeLevel 418, then applies its own
62% / 50% / 50% factors to reproduce the in-game values 1060 / 2250 / 40.

## Automated evidence

- Rust tests cover exact Status construction, real-profile solve, and
  same-version simulation.
- Vitest covers local search, same-name identity separation, dynamic mapping,
  the secondary fixture, typed errors, localization, timing, and 15-line macro
  sectioning.
- Playwright covers the real browser local-data -> Worker -> WASM -> Raphael ->
  simulation -> Traditional Chinese macro path.
