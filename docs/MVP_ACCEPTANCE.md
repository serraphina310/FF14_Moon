# MVP Acceptance Matrix

Status: public MVP and Phase 9 release configuration locally verified on
2026-08-03. No Git remote is configured, so no public deployment is claimed.

| Acceptance behavior | Evidence |
| --- | --- |
| Eight independent crafting-job collections | Domain test creates all eight workspaces; Chrome test switches Carpenter and Weaver without leaking records. |
| Recipe-ID deduplication and same-name disambiguation | Domain test deduplicates within one job; local-data and Chrome tests keep Recipe 36173 and same-name Recipe 36206 distinct. |
| Audited dynamic-level changes | Local-data tests map Lv.79 to complete RecipeLevel 418 and reject unsupported Lv.9; UI never accepts an internal ID as user input. |
| Exact in-game secondary fixture | Recipe 36178 reproduces 1060 progress, 2250 quality, and 40 durability. |
| Profile switching and stale results | Domain and Chrome tests cover profile edits, active-profile switches, solver option changes, and version changes. Saved snapshots remain immutable. |
| Persistence after refresh | Chrome solves Recipe 36173, reloads, and recovers the recipe, profile, preferences, solution, macro option, and history. |
| One successful solution per recipe level | Domain tests replace the same-level solution and preserve a separate Lv.80 entry; a failed solve never replaces success. |
| Real browser Worker/WASM solve | Chrome runs local data -> Worker -> pinned Raphael WASM -> same-version simulator for Recipe 36173. |
| Simulation acceptance | Rust rejects adoption unless there are no cast errors and progress is complete. The required real profile reaches 1197/1197 and 2790/2790. |
| Traditional Chinese sequence and macro | UI and Chrome show localized skill names; Vitest covers the full action mapping used by macro output. |
| Macro line limit | Unit and Chrome tests verify each section is at most 15 lines including `/mlock` and completion notice. |
| `/mlock` and copy behavior | `/mlock` defaults off, is opt-in and persisted; every section has its own copy button; no combined copy-all control exists. |
| Result completeness | UI shows completion, target-quality state, reliability, progress, quality, durability, CP, steps, estimated macro time, profile snapshot, and solve time. |
| Reliable and non-guaranteed labels | Reliable/adversarial is opt-in; Chrome verifies the default non-guaranteed warning and re-solves with reliability enabled. |
| Mapping, attribute, Worker, WASM, simulation, memory, and storage failures | Typed boundaries and UI messages are covered by Rust, Vitest, or interaction tests; simulation failure cannot be adopted. |
| Cosmic mission action limits | Recipe 36183 displays `奇蹟之材` with three charges and states its audited non-solver/non-macro behavior. |
| Scoped destructive controls | Unit test preserves unrelated localStorage keys; Chrome verifies remove cancellation, confirmed single-record removal, full clear confirmation, and persistence after reload. |
| Exact source and license links | Unit tests construct the exact repository-tree URL; the production build embeds the injected repository and Git revision; Chrome verifies the deployed notices link and required Square Enix notice. |
| Reproducible Pages gate | Workflow actions use immutable commit SHAs and the build job runs both Rust crates, typecheck, Vitest, Playwright, WASM, and the production Vite build before an eligible `main` deployment. |

## Current automated totals

- Rust: 10 tests across the WASM core and data extractor.
- Vitest: 21 tests across 7 files.
- Playwright: 4 tests across the technical gate, workbench, persistence, and
  destructive controls, including the legal footer.
- TypeScript strict typecheck and the optimized production Vite/WASM build pass.

These totals are descriptive and must be updated if the suite changes. A test
listed here is not a substitute for rerunning the final current-tree checks.
