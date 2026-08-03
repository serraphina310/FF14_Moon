# Approved Implementation Plan

Status: approved on 2026-08-03. Phase status must reflect repository evidence,
not intention.

## Phase 0 - Governance and locked specification

Status: complete

- Replace unrelated repository instructions with FF14_Moon-specific
  `AGENTS.md`.
- Record product requirements, grill decisions, architecture boundaries, data
  provenance, implementation phases, license, and initial third-party inventory.
- Verify fixture values, terminology, internal links, and absence of unrelated
  prior-project or tool-specific rules.

Exit gate: documentation is internally consistent and contains no claim that
the unimplemented application already works.

## Phase 1 - Toolchain and minimal project skeleton

Status: complete

Current evidence:

- Exact local versions and invocation notes are recorded in
  `docs/TOOLCHAIN.md`.
- The minimal Vue/Vite/Pinia/Vitest/Playwright and Rust/WASM skeleton exists;
  npm installed 92 packages with zero reported vulnerabilities.
- The production build generated and optimized a browser-loadable WASM asset.
- Type checking, Vitest, Rust formatting, Clippy with warnings denied, Rust
  tests, the Vite production build, and a real local-Chrome Playwright probe
  passed.
- TypeScript is pinned to 6.0.3 because the current `vue-tsc` 3.3.9 fails
  against TypeScript 7's package exports.
- The Chrome E2E must run with normal desktop profile permissions. The Codex
  filesystem sandbox lets the assertion pass but blocks Chrome Crashpad/profile
  lock writes and prevents clean browser teardown.

- Reconfirm Node/npm availability.
- Report and obtain approval before installing Rust, Cargo, wasm target,
  wasm-pack, wasm-bindgen-cli, or Playwright browser artifacts.
- Initialize the standalone Git repository and a minimal Vue 3, TypeScript,
  Vite, and Pinia application.
- Add Vitest, Playwright, typecheck, build, and Rust/WASM scripts with pinned
  tool and dependency versions.
- Configure GitHub Pages repository-base asset handling.

Exit gate: the empty production frontend builds, a minimal WASM module loads in
a browser, and the exact tool versions are recorded.

## Phase 2 - Patch 7.2 Traditional Chinese data pipeline

Status: complete

Current evidence:

- The checked-in extractor pins Ironworks commit
  `a9b40991b80f7466c2acdfbbe288e4f524a0301a`, validates client build
  `2026.07.22.0000.0000`, and rejects any WKS EXH layout mismatch or invalid
  source row.
- The generated package contains 14,409 recipes, 800 complete RecipeLevel
  rows, 240 explicit dynamic recipe IDs, 91 audited Lv.10-Lv.100 mappings,
  source revisions, fixture results, and SHA-256 checksums.
- Recipe 36173 and 36178 pass the Lv.79 factor fixtures; Recipe 36206 remains a
  distinct fixed expert recipe.
- The installed Patch 7.2 Action `41269` (`奇蹟之材`) is retained with its
  recipe-specific charge limit and marked as a non-solver mission action.

- Locate the legally installed, version-pinned Patch 7.2 zh-TW client build
  `2026.07.22.0000.0000` without committing its private path.
- Adapt the audited BestCraft/Ironworks extraction path.
- Emit only the normalized fields required by the workbench.
- Generate data and mapping manifests with source commits and checksums.
- Make generation fail on missing or ambiguous dynamic mappings.

Exit gate: all initial fixtures in `docs/DATA_PROVENANCE.md` pass from generated
local data. Unavailable client data blocks dependent phases.

## Phase 3 - Minimal Craft, Worker, WASM, solver, and simulator core

Status: complete

- Select immutable BestCraft and Raphael revisions after compatibility and
  license review.
- Adapt only the required Craft/Recipe/RecipeLevel/Status construction,
  Worker/WASM bridge, solver, simulator, action localization, timing, and macro
  primitives.
- Preserve source headers and update third-party notices with exact imported
  paths.
- Define typed loading, cancellation, insufficiency, mapping, simulation,
  memory, WASM-load, and unexpected failures.

Exit gate: focused TypeScript and Rust tests pass and no remote runtime data
dependency is present.

## Phase 4 - Browser technical validation hard gate

Status: complete

- Run the Recipe 36173 Lv.79 flow with effective attributes 1555/1534/421.
- Re-simulate every candidate sequence before adoption.
- Format and validate executable Traditional Chinese macro sections.
- Reproduce Recipe 36178's 1060/2250/40 in-game fixture.
- Cover mapping/rounding with Vitest, core behavior with Rust tests, and the
  browser Worker/WASM flow with Playwright.

If the real profile cannot meet the target, keep the insufficiency result and
use a clearly labelled synthetic profile only to prove integration.

Exit gate: local search -> audited mapping -> Status -> Worker/WASM solver ->
same-version simulation -> zh-TW macro is verified in a real browser. Broad UI
work is forbidden until this gate passes.

## Phase 5 - Versioned local domain and persistence model

Status: complete

- Implement eight independent job workspaces, profile identity, recipe identity,
  solution snapshots, stale fingerprints, latest errors, and per-level adopted
  solutions.
- Implement the versioned localStorage adapter, migrations, corruption and quota
  reporting, and scoped reset behavior.
- Test same-name recipe separation and same-ID deduplication.

Exit gate: migration, persistence, stale-state, replacement, and destructive
scope tests pass.

## Phase 6 - Focused Vue workbench

Status: complete

- Build job switching, local search, saved recipes, recipe details, audited level
  input, active profile, solver controls, result, macro, and lightweight history.
- Keep fixed and dynamic recipes visibly distinct.
- Avoid copying the full BestCraft UI or adding deferred features.

Exit gate: one complete user journey works for each job data partition and the
same-name fixture is unambiguous.

## Phase 7 - Profiles, history, staleness, and clear-data controls

Status: complete

- Add multiple effective-attribute profiles per job and active-profile choice.
- Add enhancer notes and the separate specialist-job flag.
- Mark old solutions stale after relevant changes.
- Add per-recipe removal and full application-data reset with explicit
  confirmation.

Exit gate: profile switching, stale detection, refresh persistence, one-solution
per-level history, and destructive confirmation tests pass.

## Phase 8 - Results, reliability, macro UX, and error states

Status: complete

- Show completion, target-quality, reliability, final values, steps, and time.
- Add opt-in `/mlock`, automatic completion notification, at-most-15-line
  sectioning, and per-section copy.
- Show understandable mapping, attribute, Worker, WASM, simulation, and storage
  failures without discarding existing data.

Exit gate: macro and failure acceptance tests pass, including Cosmic duty-action
limits and non-guaranteed-result labelling.

## Phase 9 - Licensing, CI, GitHub Pages, and final acceptance

Status: complete

Current evidence:

- The UI ships required Square Enix notices, third-party sources and licenses,
  and a build-injected link to the exact corresponding source revision.
- The GitHub Pages workflow pins every third-party action by immutable commit,
  installs the locked Node/Rust/WASM toolchain, runs both Rust crates plus all
  TypeScript and browser gates, and deploys only a verified `main` artifact.
- A production build with test repository/revision metadata contains both
  values and all deployed legal/data assets at base-aware URLs.
- The final local gate passed 10 Rust tests, 21 Vitest tests, 4 Playwright tests,
  strict TypeScript checking, and the optimized Vite/WASM production build.
- No Git remote is configured, so push, GitHub Pages activation, and public URL
  verification remain separate user-directed deployment work rather than a
  claim of current deployment.

- Finalize AGPL corresponding-source links and third-party/game-material notices.
- Run typecheck, Vitest, Rust fmt/clippy/test, WASM build, Playwright, and Vite
  production build in CI.
- Configure GitHub Pages without runtime BestCraft data calls.
- Execute every acceptance item in `docs/PRODUCT_REQUIREMENTS.md`.

Exit gate result: all current-tree and locally reproducible deployed-build
checks pass. Remote Pages activation and public-URL verification are explicitly
unverified because no Git remote or deployment was authorized.

Deployment, push, pull-request readiness, and merge remain separate user-directed
actions.
