# Verified Toolchain

Status: Phase 1 baseline verified on 2026-08-03. This records the development
environment, not a claim that recipe data or solving is implemented.

## Host tools

- Windows x64 host
- Node.js 22.13.0
- npm 10.9.2
- Git for Windows 2.55.0.windows.2
- Visual Studio Build Tools 2026 18.8.2
- MSVC tools 14.51.36231; verified x64 linker file version 14.51.36252.0
- Windows SDK 10.0.26100.0
- Local Chrome 150.0.7871.187 for the Phase 1 browser probe

## Rust and WASM tools

- pinned toolchain: `nightly-2026-08-02-x86_64-pc-windows-msvc`
- rustc 1.99.0-nightly (`73dc9167f`, 2026-08-01; LLVM 22.1.8)
- Cargo 1.99.0-nightly (`7c83d4cc0`, 2026-07-29)
- components: rust-src, rustfmt, and clippy
- target: wasm32-unknown-unknown
- wasm-pack 0.15.0
- wasm-bindgen CLI 0.2.126

JavaScript package versions are pinned in `package.json` and
`package-lock.json`. Rust crate versions are pinned in `src-wasm/Cargo.lock`.

## Windows invocation

Rustup updates the user PATH, but a terminal or Codex process opened before the
installation does not inherit that change. Open a new terminal before building.
Rust host build scripts also require an x64 Visual Studio developer environment;
use a Developer PowerShell/Command Prompt or initialize `VsDevCmd.bat` first.
Do not commit a machine-specific Build Tools path.

## Validation commands

Run from the repository root after the Windows environment above is active:

```text
npm run typecheck
npm test
npm run build
npm run test:e2e
cargo fmt --manifest-path src-wasm/Cargo.toml --all
cargo clippy --manifest-path src-wasm/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-wasm/Cargo.toml --all
```

The local Playwright configuration uses installed Chrome to avoid downloading a
browser artifact. CI installs pinned-toolchain Chromium and executes the same
browser suite before an eligible GitHub Pages deployment.
