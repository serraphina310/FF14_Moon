# Patch 7.2 zh-TW data extractor

This build-time tool reads a legally installed Traditional Chinese FF14 client
whose `game/ffxivgame.ver` is exactly `2026.07.22.0000.0000`. It writes only the
normalized static assets used by FF14_Moon and never records the installation
path.

The WKS field layout is pinned to this client build. The extractor validates the
complete audited EXH column signatures before reading the fields; a layout
change is a hard error rather than a skipped row.

Run from the repository root after replacing the sample values:

```powershell
npm run data:generate -- --game-path "D:\path\to\FINAL FANTASY XIV TC" --generator-revision <40-character-commit> --generated-at <ISO-8601-time>
```

The default output is `public/data/zh-tw-7.2`. Generation requires a clean,
reviewed audit policy at `audit/patch-7.2-zh-tw.json`.
