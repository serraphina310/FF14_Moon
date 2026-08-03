# MVP Acceptance Matrix

Status: product behavior implemented through Phase 8 on 2026-08-03. Licensing,
CI, deployment configuration, and final public-release review remain Phase 9.

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
| Reliable and non-guaranteed labels | Reliable/adversarial is default; Chrome re-solves with it disabled and verifies the non-guaranteed warning. |
| Mapping, attribute, Worker, WASM, simulation, memory, and storage failures | Typed boundaries and UI messages are covered by Rust, Vitest, or interaction tests; simulation failure cannot be adopted. |
| Cosmic mission action limits | Recipe 36183 displays `奇蹟之材` with three charges and states its audited non-solver/non-macro behavior. |
| Scoped destructive controls | Unit test preserves unrelated localStorage keys; Chrome verifies remove cancellation, confirmed single-record removal, full clear confirmation, and persistence after reload. |

## Current automated totals

- Rust: 6 tests.
- Vitest: 19 tests across 6 files.
- Playwright: 4 tests across the technical gate, workbench, persistence, and
  destructive controls.
- TypeScript strict typecheck and production Vite/WASM build are required at
  the final gate.

These totals are descriptive and must be updated if the suite changes. A test
listed here is not a substitute for rerunning the final current-tree checks.
