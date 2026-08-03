// This file is part of FF14_Moon.
// Copyright (C) 2026 FF14_Moon contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn toolchain_probe() -> String {
    "Rust／WASM 工具鏈已載入".to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_is_not_empty() {
        assert!(!toolchain_probe().is_empty());
    }
}
