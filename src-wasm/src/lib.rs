// This file is part of FF14_Moon.
// Copyright (C) 2026 FF14_Moon contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

mod core;
mod raphael;

use core::{CoreError, SolveRequest};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn toolchain_probe() -> String {
    "Rust／WASM 工具鏈已載入".to_owned()
}

#[wasm_bindgen]
pub fn solve_and_simulate(request: JsValue) -> Result<JsValue, JsValue> {
    let request = serde_wasm_bindgen::from_value::<SolveRequest>(request)
        .map_err(|error| js_error(CoreError::invalid_input(error.to_string())))?;
    let result = core::solve_and_simulate(request).map_err(js_error)?;
    serde_wasm_bindgen::to_value(&result)
        .map_err(|error| js_error(CoreError::serialization(error.to_string())))
}

#[wasm_bindgen]
pub fn simulate_actions(request: JsValue, actions: JsValue) -> Result<JsValue, JsValue> {
    let request = serde_wasm_bindgen::from_value::<SolveRequest>(request)
        .map_err(|error| js_error(CoreError::invalid_input(error.to_string())))?;
    let actions = serde_wasm_bindgen::from_value(actions)
        .map_err(|error| js_error(CoreError::invalid_input(error.to_string())))?;
    let result = core::simulate_request(&request, actions).map_err(js_error)?;
    serde_wasm_bindgen::to_value(&result)
        .map_err(|error| js_error(CoreError::serialization(error.to_string())))
}

fn js_error(error: CoreError) -> JsValue {
    serde_wasm_bindgen::to_value(&error).unwrap_or_else(|_| JsValue::from_str(&error.message))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_is_not_empty() {
        assert!(!toolchain_probe().is_empty());
    }
}
