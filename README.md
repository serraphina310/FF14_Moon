# FF14_Moon

FF14_Moon 是一個繁體中文、local-first 的 FINAL FANTASY XIV 動態配方工作台。
配方資料、求解器、模擬器與使用者資料都在瀏覽器本機運作；執行時不依賴
BestCraft 網站、後端服務或帳號。

目前公開 MVP 鎖定繁中服 Patch 7.2 client build
`2026.07.22.0000.0000`。它支援八種生產職業、動態 RecipeLevel 映射、
多套有效能力值方案、瀏覽器 Worker／WASM 求解、同版本模擬驗證、繁中巨集、
輕量歷史與版本化 localStorage。

## 本機執行

需要 Node.js 22.13.0 以上、npm 10.9.2、`rust-toolchain.toml` 指定的 Rust
nightly，以及 wasm-pack 0.15.0。詳細版本與 Windows 注意事項見
[`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md)。

```text
npm ci
cargo install wasm-pack --version 0.15.0 --locked
npm run dev
```

常用驗證：

```text
npm run typecheck
npm test
npm run test:e2e
npm run build
```

瀏覽器技術驗證頁位於 `/?technical-validation=1`。它會執行配方 36173
「宇宙探索用的紡車」Lv.79 的完整 Worker／WASM 求解及模擬流程；完整紀錄見
[`docs/TECHNICAL_VALIDATION.md`](docs/TECHNICAL_VALIDATION.md)。

## 配方資料

部署版只讀取 `public/data/zh-tw-7.2` 的版本化靜態資料，不在 runtime
連線取得 BestCraft 資料。重新產生資料需要使用者依法安裝、且版本完全相符的
繁中 FFXIV client：

```text
npm run data:generate -- "<FFXIV 安裝目錄>"
```

產生器會拒絕錯誤的 client build、資料表版型或不明確的動態等級映射。資料來源、
欄位與 checksum 規則見 [`docs/DATA_PROVENANCE.md`](docs/DATA_PROVENANCE.md)。

## 本機資料與清除

工作台資料使用 schema-versioned localStorage 根鍵 `ff14-moon:workbench`。
介面提供單筆配方移除與「清除全部工作台資料」按鈕，兩者都需要明確確認；不會
刪除同網域其他應用程式的 localStorage 鍵。

## 部署與對應原始碼

`.github/workflows/pages.yml` 會在 pull request 驗證完整測試，並只在 `main`
分支成功後建立和部署 GitHub Pages artifact。建置時會把 repository URL 與精確
Git SHA 注入頁尾，使每個部署版連回同一版本的完整對應原始碼。Vite 會自動使用
GitHub repository 名稱作為 Pages base path。

本 repository 目前未設定 Git remote；workflow 只是可部署設定，尚未代表任何
遠端網站已發布。

## 授權與聲明

本專案以 [AGPL-3.0-or-later](LICENSE) 發布，並改作 BestCraft 繁中版的部分
AGPL 原始碼。Raphael、ffxiv-crafting、Ironworks 及其他來源與精確 revision
列於 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)，部署版也包含可直接
閱讀的 `public/legal` 授權檔。

非官方、非商業的玩家工具。© SQUARE ENIX。FINAL FANTASY 是 Square Enix
Holdings Co., Ltd. 的註冊商標。本專案與 Square Enix 無關，亦未獲其背書。
使用的遊戲名稱與數值資料應遵守
[FINAL FANTASY XIV Materials Usage License](https://support.na.square-enix.com/rule.php?id=5382&la=1&tag=authc)。
