// This file is adapted from BestCraft.
// Copyright (C) 2025 Tnze
// Copyright (C) 2026 FF14_Moon contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

use ffxiv_crafting::{Actions, Status};
use raphael_simulator::{Action, ActionMask, Settings};
use raphael_solvers::{AtomicFlag, MacroSolver, SolverException, SolverSettings};

use crate::core::{CoreError, SolverOptions};

pub fn solve(status: &Status, options: SolverOptions) -> Result<Vec<Actions>, CoreError> {
    let mut allowed_actions = ActionMask::all();
    if !options.use_heart_and_soul {
        allowed_actions = allowed_actions.remove(Action::HeartAndSoul);
    }
    if !options.use_quick_innovation {
        allowed_actions = allowed_actions.remove(Action::QuickInnovation);
    }
    if !options.use_manipulation {
        allowed_actions = allowed_actions.remove(Action::Manipulation);
    }
    if !options.use_trained_eye || status.is_action_allowed(Actions::TrainedEye).is_err() {
        allowed_actions = allowed_actions.remove(Action::TrainedEye);
    }

    let target_quality = options.target_quality.unwrap_or(status.recipe.quality);
    let simulator_settings = Settings {
        max_cp: status.attributes.craft_points as u16,
        max_durability: status.recipe.durability,
        max_progress: status.recipe.difficulty,
        max_quality: target_quality as u16,
        base_progress: status.caches.base_synth as u16,
        base_quality: status.caches.base_touch as u16,
        job_level: status.attributes.level,
        allowed_actions,
        adversarial: options.adversarial,
        backload_progress: options.backload_progress,
    };
    let solver_settings = SolverSettings {
        simulator_settings,
        allow_non_max_quality_solutions: true,
    };
    let mut solver = MacroSolver::new(
        solver_settings,
        Box::new(|_| {}),
        Box::new(|_| {}),
        AtomicFlag::new(),
    );

    solver
        .solve()
        .map(|actions| actions.into_iter().map(map_action).collect())
        .map_err(map_solver_error)
}

fn map_solver_error(error: SolverException) -> CoreError {
    match error {
        SolverException::NoSolution => CoreError {
            code: "no_solution",
            message: "目前能力值與求解選項找不到可完成配方的解答。".to_owned(),
        },
        SolverException::Interrupted => CoreError {
            code: "solver_interrupted",
            message: "求解已中止。".to_owned(),
        },
        SolverException::InternalError(detail) => CoreError {
            code: "solver_internal_error",
            message: format!("Raphael 求解器發生內部錯誤：{detail}"),
        },
    }
}

fn map_action(action: Action) -> Actions {
    match action {
        Action::BasicSynthesis => Actions::BasicSynthesis,
        Action::BasicTouch => Actions::BasicTouch,
        Action::MasterMend => Actions::MastersMend,
        Action::Observe => Actions::Observe,
        Action::TricksOfTheTrade => Actions::TricksOfTheTrade,
        Action::WasteNot => Actions::WasteNot,
        Action::Veneration => Actions::Veneration,
        Action::StandardTouch => Actions::StandardTouch,
        Action::GreatStrides => Actions::GreatStrides,
        Action::Innovation => Actions::Innovation,
        Action::WasteNot2 => Actions::WasteNotII,
        Action::ByregotsBlessing => Actions::ByregotsBlessing,
        Action::PreciseTouch => Actions::PreciseTouch,
        Action::MuscleMemory => Actions::MuscleMemory,
        Action::CarefulSynthesis => Actions::CarefulSynthesis,
        Action::Manipulation => Actions::Manipulation,
        Action::PrudentTouch => Actions::PrudentTouch,
        Action::AdvancedTouch => Actions::AdvancedTouch,
        Action::Reflect => Actions::Reflect,
        Action::PreparatoryTouch => Actions::PreparatoryTouch,
        Action::Groundwork => Actions::Groundwork,
        Action::DelicateSynthesis => Actions::DelicateSynthesis,
        Action::IntensiveSynthesis => Actions::IntensiveSynthesis,
        Action::TrainedEye => Actions::TrainedEye,
        Action::HeartAndSoul => Actions::HeartAndSoul,
        Action::PrudentSynthesis => Actions::PrudentSynthesis,
        Action::TrainedFinesse => Actions::TrainedFinesse,
        Action::RefinedTouch => Actions::RefinedTouch,
        Action::QuickInnovation => Actions::QuickInnovation,
        Action::ImmaculateMend => Actions::ImmaculateMend,
        Action::TrainedPerfection => Actions::TrainedPerfection,
    }
}
