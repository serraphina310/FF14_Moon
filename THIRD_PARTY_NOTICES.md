# Third-Party Notices

Status: initial inventory. Update this file whenever third-party source, data,
translations, fonts, icons, or generated artifacts are added.

## BestCraft Traditional Chinese fork

- Project: BestCraft zh-TW
- Source: <https://github.com/Isla-Liu/ffxiv-best-craft-zhtw>
- Inspected commit: `29b6c51442f4756e8c9ff0e9b849a846fd2f8d72`
- License: GNU Affero General Public License v3.0 or later
- Planned use: reference Traditional Chinese translations and selected
  browser/WASM integration code. Exact imported files must be added here when
  selected.

## BestCraft upstream

- Project: BestCraft
- Source: <https://github.com/Tnze/ffxiv-best-craft>
- Inspected commit: `e2f363e`
- License: GNU Affero General Public License v3.0 or later
- Planned use: reference current data extraction, Worker, Craft, simulation,
  macro formatting, and solver adapter implementations. Exact imported files
  and final pinned commit must be recorded before distribution.

## Raphael

- Project: raphael-rs
- Source: <https://github.com/KonaeAkira/raphael-rs>
- License: Apache License 2.0
- Version observed in inspected BestCraft upstream: v0.28.6
- Planned use: solver and simulator dependency through the selected
  BestCraft-compatible Rust integration.

## ffxiv-crafting

- Crate: `ffxiv-crafting`
- Version observed in inspected BestCraft upstream: 7.4.5
- Final source, version, license text, and use must be verified before the
  dependency is added.

## Ironworks

- Project: Ironworks
- Source: <https://github.com/ackwell/ironworks>
- Planned use: build-time extraction from a version-pinned local game client.
- Final commit and license text must be verified before the data generator is
  added.

## FINAL FANTASY XIV material

FINAL FANTASY XIV names, game data, icons, fonts, screenshots, and trademarks
are not automatically covered by BestCraft's AGPL license. Before public
deployment, record every shipped category, its source, applicable Square Enix
material-usage terms, required attribution, and any excluded assets.

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.
This project is not affiliated with or endorsed by Square Enix.
