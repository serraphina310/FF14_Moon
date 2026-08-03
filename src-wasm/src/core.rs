// This file is part of FF14_Moon.
// Copyright (C) 2026 FF14_Moon contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

use ffxiv_crafting::{Actions, Attributes, Recipe, RecipeLevel, Status};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SolveRequest {
    pub attributes: AttributeInput,
    pub recipe_level: RecipeLevelInput,
    pub recipe_factors: RecipeFactors,
    #[serde(default)]
    pub options: SolverOptions,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttributeInput {
    pub level: u8,
    pub craftsmanship: i32,
    pub control: i32,
    pub craft_points: i32,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeLevelInput {
    pub id: u32,
    pub class_job_level: u8,
    pub suggested_craftsmanship: u16,
    pub difficulty: u16,
    pub quality: u32,
    pub progress_divider: u8,
    pub quality_divider: u8,
    pub progress_modifier: u8,
    pub quality_modifier: u8,
    pub durability: u16,
    pub conditions_flag: u16,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeFactors {
    pub difficulty: u16,
    pub quality: u16,
    pub durability: u16,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SolverOptions {
    pub target_quality: Option<u32>,
    pub use_manipulation: bool,
    pub use_heart_and_soul: bool,
    pub use_quick_innovation: bool,
    pub use_trained_eye: bool,
    pub backload_progress: bool,
    pub adversarial: bool,
}

impl Default for SolverOptions {
    fn default() -> Self {
        Self {
            target_quality: None,
            use_manipulation: true,
            use_heart_and_soul: false,
            use_quick_innovation: false,
            use_trained_eye: false,
            backload_progress: false,
            adversarial: true,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SolveResponse {
    pub actions: Vec<Actions>,
    pub simulation: SimulationResponse,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationResponse {
    pub final_status: FinalStatus,
    pub errors: Vec<SimulationError>,
    pub completed: bool,
    pub target_quality_reached: bool,
    pub verified: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinalStatus {
    pub progress: u16,
    pub quality: u32,
    pub durability: u16,
    pub craft_points: i32,
    pub steps: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationError {
    pub action_index: usize,
    pub action: Actions,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreError {
    pub code: &'static str,
    pub message: String,
}

impl CoreError {
    pub fn invalid_input(message: String) -> Self {
        Self {
            code: "invalid_input",
            message: format!("求解輸入格式不正確：{message}"),
        }
    }

    pub fn serialization(message: String) -> Self {
        Self {
            code: "serialization_failed",
            message: format!("無法序列化 WASM 回應：{message}"),
        }
    }

    fn validation(message: impl Into<String>) -> Self {
        Self {
            code: "invalid_craft_parameters",
            message: message.into(),
        }
    }
}

pub fn solve_and_simulate(request: SolveRequest) -> Result<SolveResponse, CoreError> {
    let status = build_status(&request)?;
    let actions = crate::raphael::solve(&status, request.options)?;
    let simulation = simulate(status, actions.clone(), request.options.target_quality);

    if !simulation.verified {
        return Err(CoreError {
            code: "simulation_failed",
            message: "求解器產生的技能序列未通過同版本模擬器驗證。".to_owned(),
        });
    }

    Ok(SolveResponse {
        actions,
        simulation,
    })
}

pub fn simulate_request(
    request: &SolveRequest,
    actions: Vec<Actions>,
) -> Result<SimulationResponse, CoreError> {
    let status = build_status(request)?;
    Ok(simulate(status, actions, request.options.target_quality))
}

fn build_status(request: &SolveRequest) -> Result<Status, CoreError> {
    validate_request(request)?;

    let recipe_level = RecipeLevel {
        id: i32::try_from(request.recipe_level.id)
            .map_err(|_| CoreError::validation("RecipeLevel ID 超出求解器可接受範圍。"))?,
        class_job_level: request.recipe_level.class_job_level,
        // The Patch 7.2 local data source does not expose a stars field, and
        // ffxiv-crafting 7.2.0 does not use it in progress or quality math.
        stars: 0,
        suggested_craftsmanship: request.recipe_level.suggested_craftsmanship,
        difficulty: request.recipe_level.difficulty,
        quality: request.recipe_level.quality,
        progress_divider: request.recipe_level.progress_divider,
        quality_divider: request.recipe_level.quality_divider,
        progress_modifier: request.recipe_level.progress_modifier,
        quality_modifier: request.recipe_level.quality_modifier,
        durability: request.recipe_level.durability,
        conditions_flag: request.recipe_level.conditions_flag,
    };
    let recipe = Recipe::new(
        recipe_level,
        request.recipe_factors.difficulty,
        request.recipe_factors.quality,
        request.recipe_factors.durability,
    );
    let attributes = Attributes {
        level: request.attributes.level,
        craftsmanship: request.attributes.craftsmanship,
        control: request.attributes.control,
        craft_points: request.attributes.craft_points,
    };

    if recipe.job_level > attributes.level.saturating_add(5) {
        return Err(CoreError {
            code: "player_level_too_low",
            message: format!(
                "生產職業等級 {} 無法製作等級 {} 的配方。",
                attributes.level, recipe.job_level
            ),
        });
    }

    let status = Status::new(attributes, recipe);
    validate_raphael_ranges(&status, request.options.target_quality)?;
    Ok(status)
}

fn validate_request(request: &SolveRequest) -> Result<(), CoreError> {
    if !(1..=100).contains(&request.attributes.level) {
        return Err(CoreError::validation("生產職業等級必須介於 1 到 100。"));
    }
    if !(1..=100).contains(&request.recipe_level.class_job_level) {
        return Err(CoreError::validation(
            "RecipeLevel 的玩家可見等級必須介於 1 到 100。",
        ));
    }
    if request.attributes.craftsmanship <= 0 {
        return Err(CoreError::validation("作業精度必須大於 0。"));
    }
    if request.attributes.control <= 0 {
        return Err(CoreError::validation("加工精度必須大於 0。"));
    }
    if request.attributes.craft_points < 0 {
        return Err(CoreError::validation("CP 不得小於 0。"));
    }
    if request.recipe_level.progress_divider == 0 || request.recipe_level.quality_divider == 0 {
        return Err(CoreError::validation(
            "RecipeLevel 的進展／品質除數不得為 0。",
        ));
    }
    if request.recipe_factors.difficulty == 0
        || request.recipe_factors.quality == 0
        || request.recipe_factors.durability == 0
    {
        return Err(CoreError::validation(
            "配方難度、品質與耐久係數必須大於 0。",
        ));
    }
    let scaled_difficulty = u32::from(request.recipe_level.difficulty)
        .checked_mul(u32::from(request.recipe_factors.difficulty))
        .ok_or_else(|| CoreError::validation("配方難度係數計算溢位。"))?
        / 100;
    if scaled_difficulty > u32::from(u16::MAX) {
        return Err(CoreError::validation(
            "套用係數後的配方難度超出可接受範圍。",
        ));
    }
    request
        .recipe_level
        .quality
        .checked_mul(u32::from(request.recipe_factors.quality))
        .ok_or_else(|| CoreError::validation("配方品質係數計算溢位。"))?;
    request
        .recipe_level
        .durability
        .checked_mul(request.recipe_factors.durability)
        .ok_or_else(|| CoreError::validation("配方耐久係數計算溢位。"))?;
    Ok(())
}

fn validate_raphael_ranges(
    status: &Status,
    requested_target_quality: Option<u32>,
) -> Result<(), CoreError> {
    u16::try_from(status.attributes.craft_points)
        .map_err(|_| CoreError::validation("CP 超出 Raphael 求解器可接受範圍。"))?;
    u16::try_from(status.caches.base_synth as u32)
        .map_err(|_| CoreError::validation("基礎作業效率超出 Raphael 求解器可接受範圍。"))?;
    u16::try_from(status.caches.base_touch as u32)
        .map_err(|_| CoreError::validation("基礎加工效率超出 Raphael 求解器可接受範圍。"))?;

    let target_quality = requested_target_quality.unwrap_or(status.recipe.quality);
    if target_quality > status.recipe.quality {
        return Err(CoreError::validation(format!(
            "目標品質 {target_quality} 不得高於配方品質上限 {}。",
            status.recipe.quality
        )));
    }
    u16::try_from(target_quality)
        .map_err(|_| CoreError::validation("目標品質超出 Raphael 求解器可接受範圍。"))?;
    Ok(())
}

fn simulate(
    mut status: Status,
    actions: Vec<Actions>,
    requested_target_quality: Option<u32>,
) -> SimulationResponse {
    let mut errors = Vec::new();
    for (action_index, action) in actions.into_iter().enumerate() {
        match status.is_action_allowed(action) {
            Ok(()) => status.cast_action(action),
            Err(error) => errors.push(SimulationError {
                action_index,
                action,
                message: error.to_string(),
            }),
        }
    }

    let completed = status.progress >= status.recipe.difficulty;
    let target_quality = requested_target_quality.unwrap_or(status.recipe.quality);
    let target_quality_reached = status.quality >= target_quality;
    let verified = errors.is_empty() && completed;

    SimulationResponse {
        final_status: FinalStatus {
            progress: status.progress,
            quality: status.quality,
            durability: status.durability,
            craft_points: status.craft_points,
            steps: status.step,
        },
        errors,
        completed,
        target_quality_reached,
        verified,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wheel_request() -> SolveRequest {
        SolveRequest {
            attributes: AttributeInput {
                level: 79,
                craftsmanship: 1555,
                control: 1534,
                craft_points: 421,
            },
            recipe_level: RecipeLevelInput {
                id: 418,
                class_job_level: 79,
                suggested_craftsmanship: 1702,
                difficulty: 1710,
                quality: 4500,
                progress_divider: 109,
                quality_divider: 89,
                progress_modifier: 100,
                quality_modifier: 100,
                durability: 80,
                conditions_flag: 15,
            },
            recipe_factors: RecipeFactors {
                difficulty: 70,
                quality: 62,
                durability: 100,
            },
            options: SolverOptions::default(),
        }
    }

    #[test]
    fn builds_the_audited_level_79_cosmic_wheel_status() {
        let status = match build_status(&wheel_request()) {
            Ok(status) => status,
            Err(error) => panic!("unexpected build error: {error:?}"),
        };

        assert_eq!(status.recipe.rlv.id, 418);
        assert_eq!(status.recipe.job_level, 79);
        assert_eq!(status.recipe.difficulty, 1197);
        assert_eq!(status.recipe.quality, 2790);
        assert_eq!(status.recipe.durability, 80);
        assert_eq!(status.recipe.rlv.conditions_flag, 15);
    }

    #[test]
    fn rejects_a_player_more_than_five_levels_below_the_recipe() {
        let mut request = wheel_request();
        request.attributes.level = 73;

        let error = match build_status(&request) {
            Ok(_) => panic!("expected level validation to fail"),
            Err(error) => error,
        };
        assert_eq!(error.code, "player_level_too_low");
    }

    #[test]
    fn same_version_simulator_reports_invalid_actions() {
        let request = wheel_request();
        let result = match simulate_request(&request, vec![Actions::TrainedEye]) {
            Ok(result) => result,
            Err(error) => panic!("unexpected simulation setup error: {error:?}"),
        };

        assert!(!result.verified);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].action_index, 0);
    }

    #[test]
    fn raphael_solves_and_simulates_a_small_recipe() {
        let mut request = wheel_request();
        request.recipe_level.difficulty = 100;
        request.recipe_level.quality = 100;
        request.recipe_factors = RecipeFactors {
            difficulty: 100,
            quality: 100,
            durability: 100,
        };
        request.options.target_quality = Some(0);

        let result = match solve_and_simulate(request) {
            Ok(result) => result,
            Err(error) => panic!("unexpected solver error: {error:?}"),
        };

        assert!(!result.actions.is_empty());
        assert!(result.simulation.verified);
        assert!(result.simulation.completed);
    }
}
