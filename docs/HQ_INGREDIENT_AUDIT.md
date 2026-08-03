# HQ Ingredient Provenance Audit

Status: structural baseline and both in-game initial-quality fixtures are
verified. The data-and-formula provenance audit is complete.

The audit remains build-time enforced. Data version
`zh-tw-7.2-2026.07.22.0000.0000.2` now ships the approved normalized ingredient
asset for local runtime calculation while retaining manual initial-quality
entry as a fallback.

## Audited source mapping

- Client build: `2026.07.22.0000.0000`.
- BestCraft reference commit: `e2f363efb19a8a349e30f915bf4074daba5f91ed`.
- EXDSchema reference commit: `468f06ee4899b492745e99e77173ea3e4cf1ea53`.
- Recipe material slots: eight Item/amount pairs at Ironworks field indexes
  `6/7` through `20/21`.
- Item quality weight: Ironworks Item field index `11`, exposed by BestCraft as
  `Item.level`.
- Item HQ eligibility: Ironworks Item field index `27`, exposed by BestCraft as
  `Item.can_be_hq`.
- The complete Recipe and Item EXH column signatures are pinned in
  `tools/data-extractor/audit/patch-7.2-zh-tw.json`. A mismatch is a hard error.

The relationship fingerprint serializes every non-empty material slot in
Recipe ID and slot order with its Recipe ID, slot, Item ID, Traditional Chinese
name, amount, Item level, and HQ eligibility.

## Structural baseline

- material relationships: 63,397;
- recipes with at least one material: 12,802;
- unique material Items: 3,241;
- HQ-capable material relationships: 26,568;
- recipes with at least one HQ-capable material: 8,991;
- recipes eligible for an ordinary mixed-HQ fixture: 6,995;
- relationship SHA-256:
  `dcb6e88802e244a38a657e366c5398d4ad2a613e4debd5e3b2e0637f841c3696`.

Regeneration also reproduced the existing `recipes.json`,
`recipe-levels.json`, and `dynamic-recipes.json` checksums exactly. The audit
does not change current runtime recipe data.

## Audited calculation

Only materials whose Item row has `can_be_hq = true` enter either side of the
ratio:

```text
weighted HQ ratio =
  sum(HQ amount * Item level) / sum(required amount * Item level)

initial quality = floor(
  effective recipe quality
  * material quality factor / 100
  * weighted HQ ratio
)
```

The extractor implements this with integer arithmetic and rejects an HQ amount
that exceeds the required amount or assigns HQ to an ineligible Item.

## In-game fixtures

### Fixture A - Recipe 36177, 改良設備用的隔熱材料

- status: passed from user-supplied in-game screenshots on 2026-08-04;
- job and player level: 木工師 Lv.87;
- selected RecipeLevel: 545;
- effective recipe: difficulty 2240, quality 6141, durability 80;
- material-quality factor: 30%;
- HQ-capable material: 改良設備用的隔熱木材 x1 at Item level 1.

Expected and observed initial quality:

| 素材狀態 | Expected | Observed |
| --- | ---: | ---: |
| 隔熱木材 NQ 1 / HQ 0 | 0 | 0（遊戲顯示空的初期品質條） |
| 隔熱木材 NQ 0 / HQ 1 | 1842 | 1842 |

The HQ value reproduces `floor(6141 * 30 / 100) = 1842`. This fixture verifies
the dynamic player-level mapping, effective recipe-quality factor, exact
Recipe-to-Item relationship, Item HQ eligibility, and integer flooring. The
screenshots are not checked into the repository because they contain player
character information.

### Fixture B - Recipe 111, 白鋼彎刃刀

- status: passed from user-supplied in-game screenshots on 2026-08-04;
- job: 鍛鐵匠;
- recipe level: 31;
- effective quality: 900;
- material-quality factor: 50%;
- HQ-capable materials: 白鋼錠 x2 at Item level 26; 胡桃木材 x1 at Item level
  25; 粉砂岩磨刀石 x1 at Item level 30;
- non-HQ materials: 火之碎晶 and 土之碎晶.

The total quality weight is `2 * 26 + 1 * 25 + 1 * 30 = 107`, and the maximum
ingredient contribution is `floor(900 * 50 / 100) = 450`.

Expected and observed initial quality:

| HQ selection | Expected | Observed |
| --- | ---: | ---: |
| all NQ | 0 | 0（遊戲顯示空的初期品質條） |
| 白鋼錠 HQ 1/2 only | 109 | 109 |
| 粉砂岩磨刀石 HQ 1/1 only | 126 | 126 |
| all three HQ-capable material types fully HQ | 450 | 450 |

The two single-HQ values reproduce `floor(450 * 26 / 107) = 109` and
`floor(450 * 30 / 107) = 126`. Their difference verifies Item-level weighting
rather than an unweighted material count. The screenshots are not checked into
the repository because they contain player character information.

## Approval gate

Both required fixtures show the exact recipe, material HQ/NQ counts, recipe
quality, and displayed initial quality, and both match the audited calculation.
The provenance audit gate is complete.

The completed implementation generates a versioned local ingredient asset and
exposes automatic calculation in the UI. It retains manual initial-quality
entry as a fallback and does not call a remote data service.
