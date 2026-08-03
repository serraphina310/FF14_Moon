# AGENTS.md

Repository-specific operating rules for FF14_Moon. These rules apply to every
file below this directory. Repository evidence is authoritative: never describe
planned behavior as implemented or verified.

## Project Authority

- `docs/PRODUCT_REQUIREMENTS.md` defines the product scope and acceptance
  requirements.
- `docs/GRILL_DECISIONS.md` records decisions already approved by the user.
- `docs/ARCHITECTURE.md` defines component and runtime boundaries.
- `docs/DATA_PROVENANCE.md` defines the only acceptable recipe-data workflow.
- `docs/IMPLEMENTATION_PLAN.md` defines the approved phase order and hard gates.
- `docs/TOOLCHAIN.md` records the verified local toolchain and validation
  commands.
- A new request may supersede these documents, but the conflict must be stated
  and the affected document updated with the implementation.
- Do not re-open an approved product decision unless new evidence shows a
  correctness, licensing, safety, or feasibility problem.

## Product Boundary

FF14_Moon is a focused, local-first FF14 crafting workbench. It is not a full
BestCraft fork and must not grow into a gear simulator, account system, cloud
sync service, market tool, or social platform without explicit approval.

The public MVP targets FINAL FANTASY XIV Patch 7.51 and eight crafting jobs. It
uses versioned local Traditional Chinese recipe data and runs solving and
simulation in the browser through a Web Worker and Rust/WebAssembly.

The application MUST NOT:

- depend at runtime on BestCraft pages, state, or data APIs;
- use iframe integration, DOM automation, browser automation, or page scraping;
- guess a RecipeLevel row from a player-visible level when the mapping is not
  explicitly present in the versioned data manifest;
- treat a non-empty solver result as success without same-version simulation;
- silently discard, reset, migrate, or overwrite persisted user data;
- install or upgrade Rust, wasm-pack, wasm-bindgen-cli, Node.js, or browser
  runtimes without first reporting the need and receiving approval.

## Mandatory Technical Gate

Before building the full workbench UI, complete the browser technical
validation documented in `docs/GRILL_DECISIONS.md`:

1. Find Recipe `36173` (`宇宙探索用的紡車`) in local zh-TW data.
2. Map player Carpenter level 79 to the audited RecipeLevel row `418`.
3. Build the effective recipe and `Status` with craftsmanship 1555, control
   1534, and CP 421.
4. Run Raphael through the browser Worker/WASM boundary.
5. Re-simulate the returned action sequence with the same simulator version.
6. Format executable Traditional Chinese FF14 macro sections of at most 15
   lines each.
7. Verify Recipe `36178` (`宇宙探索用的樹液`) produces the in-game fixture
   difficulty 1060, quality 2250, and durability 40 at level 79.

If the gate cannot produce a solution because the real attributes are
insufficient, report that result accurately. A clearly labelled synthetic
attribute fixture may prove the integration, but it must never replace the real
fixture or be presented as a player solution. Do not proceed to broad UI work
while Worker/WASM loading, mapping, simulation, or macro output remains
unverified.

## Recipe and Solver Correctness

- Player level and internal RecipeLevel ID are different concepts.
- Dynamic recipes must replace the entire RecipeLevel payload, including
  divider, modifier, durability, and conditions flag fields, before applying
  the recipe difficulty, quality, and durability factors.
- The UI exposes the player's current crafting-job level, not internal IDs.
- Only Patch 7.51 dynamic recipes listed in the audited manifest may expose a
  changeable level. Unknown or ambiguous mappings are blocking errors.
- Recipe identity and deduplication use `dataVersion + job + recipeId`, never
  the localized name.
- Recipe `36173` is a dynamic normal recipe. Same-name Recipe `36206` is a
  fixed expert recipe and must remain distinct.
- Recipe `is_expert` and the player's specialist-job selection are separate
  fields and must use distinct UI labels.
- A successful solution has no simulation errors and reaches the required
  progress. Reaching the requested quality is reported separately.
- Reliable/adversarial solving is the default. Non-guaranteed results must be
  visibly labelled and persist that option in their snapshot.
- Cosmic duty-action availability and maximum charges come from recipe data;
  user input may not exceed the recorded limit.

## Persistence Rules

- MVP persistence uses a namespaced, versioned localStorage root document.
- The persisted root contains an explicit schema version and tested migrations.
- Unknown future schema versions, corrupt JSON, quota failures, and write
  failures must surface understandable errors and must not trigger a silent
  reset.
- Each recipe and sync level keeps one adopted successful solution. A failed
  solve records the latest error without replacing that solution.
- Solution validity is based on recipe data, RecipeLevel, effective attributes,
  solver options, data version, and solver version. Changed inputs make an old
  solution stale; they do not delete it.
- Destructive UI actions require a confirmation that names the exact scope.

## Licensing and Provenance

- The combined application is released under `AGPL-3.0-or-later`.
- Preserve BestCraft copyright and license headers in copied or modified files.
- Record immutable source repository URLs and commits for every imported
  BestCraft module, translation, generated WASM component, or data tool.
- Record Raphael and other third-party licenses in `THIRD_PARTY_NOTICES.md`.
- A deployed network version must prominently link to the complete
  corresponding source for that exact build.
- FFXIV game data, names, icons, fonts, and trademarks require separate source
  and notice review; do not assume BestCraft's AGPL covers them.
- Production recipe data must follow `docs/DATA_PROVENANCE.md`. Remote BestCraft
  APIs may be used for read-only investigation and cross-checking only.

## Working Principles

Before any task, confirm the workspace and Git state:

```powershell
Get-Location
git branch --show-current
git status -sb
```

If Git has not been initialized yet, report that fact instead of treating the
command failure as a repository error.

- Read the applicable authority documents before changing files.
- Preserve unrelated user work. Never reformat, refactor, stage, revert, or
  delete unrelated changes.
- Use the smallest implementation that satisfies the approved behavior.
- Do not add speculative abstractions or features from the deferred list.
- State assumptions that affect data interpretation, solver output, licensing,
  persistence, or deployment.
- Stop and ask when a choice would materially alter architecture or correctness.
- Use `apply_patch` for hand-authored file changes.
- Keep Traditional Chinese user-facing copy and skill names.

## Test and Verification Policy

Use test-first development for RecipeLevel mapping, factor rounding, recipe
identity, persistence migrations, stale-result detection, macro splitting,
solver adapters, and regressions.

Planned verification layers are:

- Vitest for TypeScript domain and persistence behavior;
- Rust tests for Status construction, solver integration, and simulation;
- Playwright for the real browser Worker/WASM flow and persistence smoke tests.

After the relevant scripts exist, every changed area must pass its focused test
and the applicable broader checks. Expected gates are:

```powershell
npm run typecheck
npm test
npm run test:e2e
npm run build
cargo fmt --manifest-path src-wasm/Cargo.toml --all -- --check
cargo clippy --manifest-path src-wasm/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-wasm/Cargo.toml --all-features
```

Do not invent a passing result when a script or tool does not exist. Missing
tools, unavailable client data, sandbox restrictions, and external failures are
unverified blockers, not passes. Documentation-only changes do not require
artificial executable tests; inspect links, terminology, fixtures, and internal
consistency instead.

Before claiming completion:

1. Run the applicable current-tree checks.
2. Read the complete output and exit status.
3. Inspect `git status` and the task diff.
4. Confirm no required check is missing or stale.
5. Report what passed and what remains unverified.

## Git and Delivery

- Never use destructive Git operations, force-push, or discard user work.
- Work sequentially through `docs/IMPLEMENTATION_PLAN.md`; a failed hard gate
  blocks dependent phases.
- Make local commits only at reviewable phase milestones and only after their
  required verification passes.
- Use Conventional Commit format. Keep the type and technical scope in English;
  write the human-readable subject and body in Traditional Chinese.
- Do not push, deploy, create a pull request, mark one ready, or merge without
  explicit user direction.
- Never commit generated secrets, private client paths, character names, or
  unrelated screenshots.

## Communication and Blockers

- Keep progress updates concise and evidence-led.
- Do not restate the full specification during routine work.
- Stop for an ambiguous RecipeLevel mapping, unavailable version-pinned zh-TW
  data, required tool approval, licensing uncertainty, persistent test failure,
  or scope expansion.
- After three evidence-based failed attempts at the same blocker, stop changing
  code and report the exact evidence and next choices.
