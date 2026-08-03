# Patch 7.2 zh-TW data extractor

This build-time tool reads a legally installed Traditional Chinese FF14 client
whose `game/ffxivgame.ver` is exactly `2026.07.22.0000.0000`. It writes only the
normalized static assets used by FF14_Moon and never records the installation
path.

The Recipe, Item, and WKS field layouts are pinned to this client build. The
extractor validates the complete audited EXH column signatures before reading
the fields; a layout change is a hard error rather than a skipped row.

Run from the repository root after replacing the sample values:

```powershell
npm run data:generate -- --game-path "D:\path\to\FINAL FANTASY XIV TC" --generator-revision <40-character-commit> --generated-at <ISO-8601-time>
```

To produce the build-time HQ ingredient audit report without enabling the UI,
add:

```powershell
--ingredient-audit-output "path\to\hq-ingredients-7.2.json"
```

The report contains full source layouts, aggregate counts, the ordered
relationship fingerprint, and a bounded set of candidate recipes. It never
records the game installation path. Its status records that the structural
baseline and both in-game fixtures in `docs/HQ_INGREDIENT_AUDIT.md` are
verified.

The default output is `public/data/zh-tw-7.2`. Generation requires a clean,
reviewed audit policy at `audit/patch-7.2-zh-tw.json`. Alongside the existing
recipe assets, normal generation writes `ingredients.json`, containing only
the HQ-capable material fields required by the runtime calculator; its checksum
and normalized counts are recorded in `manifest.json`.
