// This file is part of FF14_Moon.
// Copyright (C) 2026 FF14_Moon contributors
//
// FF14_Moon is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.

use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, bail, ensure};
use ironworks::{
    Ironworks,
    excel::{Excel, Language, SheetMetadata},
    file::exh::ColumnDefinition,
    sqpack::{Install, SqPack},
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const TARGET_PATCH: &str = "7.2";
const TARGET_LOCALE: &str = "zh-TW";
const DATA_VERSION: &str = "zh-tw-7.2-2026.07.22.0000.0000.1";
const BESTCRAFT_REPOSITORY: &str = "https://github.com/Tnze/ffxiv-best-craft";
const BESTCRAFT_COMMIT: &str = "e2f363efb19a8a349e30f915bf4074daba5f91ed";
const IRONWORKS_REPOSITORY: &str = "https://github.com/ackwell/ironworks";
const IRONWORKS_COMMIT: &str = "a9b40991b80f7466c2acdfbbe288e4f524a0301a";
const EXDSCHEMA_REPOSITORY: &str = "https://github.com/xivdev/EXDSchema";
const EXDSCHEMA_COMMIT: &str = "468f06ee4899b492745e99e77173ea3e4cf1ea53";
const AUDIT_JSON: &str = include_str!("../audit/patch-7.2-zh-tw.json");

const JOBS: [JobDefinition; 8] = [
    JobDefinition::new("carpenter", "木工師", "木工"),
    JobDefinition::new("blacksmith", "鍛鐵匠", "鍛造"),
    JobDefinition::new("armorer", "甲冑師", "甲冑"),
    JobDefinition::new("goldsmith", "雕金匠", "金工"),
    JobDefinition::new("leatherworker", "製革匠", "皮革"),
    JobDefinition::new("weaver", "裁衣匠", "裁縫"),
    JobDefinition::new("alchemist", "鍊金術士", "鍊金"),
    JobDefinition::new("culinarian", "烹調師", "烹調"),
];

#[derive(Debug, Clone, Copy)]
struct JobDefinition {
    key: &'static str,
    display_name: &'static str,
    source_name: &'static str,
}

impl JobDefinition {
    const fn new(key: &'static str, display_name: &'static str, source_name: &'static str) -> Self {
        Self {
            key,
            display_name,
            source_name,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuditPolicy {
    schema_version: u32,
    client_build: String,
    expected_recipe_count: usize,
    expected_recipe_level_count: usize,
    dynamic_recipe_level_id: u32,
    dynamic_recipe_count: usize,
    dynamic_recipe_ids_sha256: String,
    dynamic_notebook_by_craft_type: [u32; 8],
    selected_recipe_level_by_player_level: BTreeMap<u8, u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeLevel {
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recipe {
    pub id: u32,
    pub job: &'static str,
    pub job_name: &'static str,
    pub name: String,
    pub item_id: u32,
    pub recipe_level_id: u32,
    pub material_quality_factor: u8,
    pub difficulty_factor: u16,
    pub quality_factor: u16,
    pub durability_factor: u16,
    pub required_quality: u32,
    pub required_craftsmanship: u16,
    pub required_control: u16,
    pub can_hq: bool,
    pub is_expert: bool,
    pub recipe_notebook_list: u32,
    pub collectability: Option<Collectability>,
    pub cosmic_duty_action: Option<CosmicDutyAction>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Collectability {
    pub low: u16,
    pub mid: u16,
    pub high: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CosmicDutyAction {
    pub kind: &'static str,
    pub action_id: u32,
    pub name: String,
    pub max_charges: u8,
    pub solver_input: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DynamicManifest {
    schema_version: u32,
    manifest_version: String,
    data_version: String,
    recipe_ids: Vec<u32>,
    player_level_to_recipe_level_id: BTreeMap<u8, u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DataManifest {
    schema_version: u32,
    data_version: String,
    game_patch: &'static str,
    client_build: String,
    locale: &'static str,
    generated_at: String,
    extraction_tool: ExtractionTool,
    sources: Vec<SourceRevision>,
    dependency_lock_sha256: String,
    audit_policy_sha256: String,
    record_counts: RecordCounts,
    assets: Vec<AssetChecksum>,
    fixtures: Vec<FixtureResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtractionTool {
    repository: &'static str,
    commit: String,
}

#[derive(Debug, Serialize)]
struct SourceRevision {
    name: &'static str,
    repository: &'static str,
    commit: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordCounts {
    recipes: usize,
    recipe_levels: usize,
    dynamic_recipes: usize,
    wks_recipe_groups: usize,
    wks_todos: usize,
    wks_units: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AssetChecksum {
    file: &'static str,
    sha256: String,
    bytes: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FixtureResult {
    name: &'static str,
    passed: bool,
    detail: String,
}

#[derive(Debug)]
pub struct GenerateOptions {
    pub game_path: PathBuf,
    pub output_dir: PathBuf,
    pub generator_revision: String,
    pub generated_at: String,
}

pub fn generate(options: &GenerateOptions) -> Result<()> {
    validate_revision(&options.generator_revision)?;
    validate_timestamp(&options.generated_at)?;

    let audit: AuditPolicy = serde_json::from_str(AUDIT_JSON).context("解析資料稽核政策失敗")?;
    ensure!(audit.schema_version == 1, "不支援的稽核政策 schema version");
    validate_client_build(&options.game_path, &audit.client_build)?;

    let install = Install::at(&options.game_path);
    let ironworks = Ironworks::new().with_resource(SqPack::new(install));
    let excel = Excel::new(ironworks).with_default_language(Language::ChineseTraditional);
    let extracted = extract(&excel)?;
    let normalized = normalize(extracted, &audit)?;

    fs::create_dir_all(&options.output_dir)
        .with_context(|| format!("無法建立資料輸出目錄 {}", options.output_dir.display()))?;

    let recipes_bytes = serde_json::to_vec(&normalized.recipes).context("序列化配方資料失敗")?;
    let recipe_levels_bytes =
        serde_json::to_vec(&normalized.recipe_levels).context("序列化 RecipeLevel 資料失敗")?;
    let dynamic_bytes =
        serde_json::to_vec(&normalized.dynamic_manifest).context("序列化動態配方 manifest 失敗")?;

    write_asset(&options.output_dir.join("recipes.json"), &recipes_bytes)?;
    write_asset(
        &options.output_dir.join("recipe-levels.json"),
        &recipe_levels_bytes,
    )?;
    write_asset(
        &options.output_dir.join("dynamic-recipes.json"),
        &dynamic_bytes,
    )?;

    let lockfile = Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.lock");
    let lock_bytes = fs::read(&lockfile)
        .with_context(|| format!("無法讀取 dependency lockfile {}", lockfile.display()))?;
    let assets = vec![
        checksum("recipes.json", &recipes_bytes),
        checksum("recipe-levels.json", &recipe_levels_bytes),
        checksum("dynamic-recipes.json", &dynamic_bytes),
    ];
    let manifest = DataManifest {
        schema_version: 1,
        data_version: DATA_VERSION.to_owned(),
        game_patch: TARGET_PATCH,
        client_build: audit.client_build,
        locale: TARGET_LOCALE,
        generated_at: options.generated_at.clone(),
        extraction_tool: ExtractionTool {
            repository: "FF14_Moon",
            commit: options.generator_revision.clone(),
        },
        sources: vec![
            SourceRevision {
                name: "BestCraft data extractor reference",
                repository: BESTCRAFT_REPOSITORY,
                commit: BESTCRAFT_COMMIT,
            },
            SourceRevision {
                name: "Ironworks",
                repository: IRONWORKS_REPOSITORY,
                commit: IRONWORKS_COMMIT,
            },
            SourceRevision {
                name: "EXDSchema WKS layout audit",
                repository: EXDSCHEMA_REPOSITORY,
                commit: EXDSCHEMA_COMMIT,
            },
        ],
        dependency_lock_sha256: sha256_hex(&lock_bytes),
        audit_policy_sha256: sha256_hex(AUDIT_JSON.as_bytes()),
        record_counts: normalized.counts,
        assets,
        fixtures: normalized.fixtures,
    };
    let manifest_bytes =
        serde_json::to_vec_pretty(&manifest).context("序列化資料 manifest 失敗")?;
    write_asset(&options.output_dir.join("manifest.json"), &manifest_bytes)?;
    Ok(())
}

fn validate_revision(revision: &str) -> Result<()> {
    ensure!(
        revision.len() == 40 && revision.bytes().all(|byte| byte.is_ascii_hexdigit()),
        "generator revision 必須是 40 字元 Git commit"
    );
    Ok(())
}

fn validate_timestamp(timestamp: &str) -> Result<()> {
    ensure!(
        timestamp.contains('T')
            && (timestamp.ends_with('Z')
                || timestamp
                    .rsplit_once(['+', '-'])
                    .is_some_and(|(_, offset)| offset.contains(':'))),
        "generated-at 必須是包含時區的 ISO 8601 時間"
    );
    Ok(())
}

fn validate_client_build(game_path: &Path, expected: &str) -> Result<()> {
    let version_path = game_path.join("game/ffxivgame.ver");
    let actual = fs::read_to_string(&version_path)
        .with_context(|| format!("無法讀取遊戲版本檔 {}", version_path.display()))?;
    ensure!(
        actual.trim() == expected,
        "遊戲客戶端版本不符：需要 {expected}，實際為 {}",
        actual.trim()
    );
    Ok(())
}

fn write_asset(path: &Path, bytes: &[u8]) -> Result<()> {
    fs::write(path, bytes).with_context(|| format!("無法寫入資料資產 {}", path.display()))
}

fn checksum(file: &'static str, bytes: &[u8]) -> AssetChecksum {
    AssetChecksum {
        file,
        sha256: sha256_hex(bytes),
        bytes: bytes.len(),
    }
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn apply_factor(base: u32, factor: u16) -> u32 {
    base.saturating_mul(u32::from(factor)) / 100
}

struct Extracted {
    craft_types: Vec<CraftTypeRow>,
    items: Vec<ItemRow>,
    actions: Vec<ActionRow>,
    recipe_levels: Vec<RecipeLevel>,
    recipes: Vec<RecipeSourceRow>,
    collectability: Vec<CollectabilityRow>,
    wks_recipe_groups: Vec<WksRecipeGroupRow>,
    wks_todos: Vec<WksTodoRow>,
    wks_units: Vec<WksUnitRow>,
}

struct Normalized {
    recipes: Vec<Recipe>,
    recipe_levels: Vec<RecipeLevel>,
    dynamic_manifest: DynamicManifest,
    counts: RecordCounts,
    fixtures: Vec<FixtureResult>,
}

fn extract(excel: &Excel) -> Result<Extracted> {
    let craft_types = collect_sheet(excel, CraftTypeMetadata)?;
    let items = collect_sheet(excel, ItemMetadata)?;
    let actions = collect_sheet(excel, ActionMetadata)?;
    let recipe_levels = collect_sheet(excel, RecipeLevelMetadata)?;
    let recipes = collect_sheet(excel, RecipeMetadata)?;
    let collectability = collect_sheet(excel, CollectabilityMetadata)?;

    let wks_recipe_sheet = excel
        .sheet(WksRecipeGroupMetadata)
        .context("讀取 WKSMissionRecipe header 失敗")?;
    validate_column_layout(
        "WKSMissionRecipe",
        &wks_recipe_sheet.columns()?,
        &[(0, 7), (4, 7), (8, 7), (12, 7), (16, 7)],
    )?;
    let wks_recipe_groups = collect_rows(wks_recipe_sheet, "WKSMissionRecipe")?;

    let wks_todo_sheet = excel
        .sheet(WksTodoMetadata)
        .context("讀取 WKSMissionToDo header 失敗")?;
    validate_column_layout(
        "WKSMissionToDo",
        &wks_todo_sheet.columns()?,
        &[
            (0, 7),
            (32, 3),
            (33, 3),
            (8, 5),
            (10, 5),
            (16, 5),
            (12, 5),
            (18, 5),
            (14, 5),
            (20, 5),
            (34, 3),
            (22, 5),
            (35, 3),
            (4, 7),
            (36, 3),
            (24, 5),
            (26, 5),
            (28, 5),
            (30, 5),
            (37, 3),
        ],
    )?;
    let wks_todos = collect_rows(wks_todo_sheet, "WKSMissionToDo")?;

    let wks_unit_sheet = excel
        .sheet(WksUnitMetadata)
        .context("讀取 WKSMissionUnit header 失敗")?;
    validate_column_layout(
        "WKSMissionUnit",
        &wks_unit_sheet.columns()?,
        &[
            (0, 0),
            (32, 3),
            (4, 5),
            (6, 5),
            (33, 3),
            (38, 25),
            (34, 3),
            (8, 5),
            (10, 5),
            (12, 5),
            (14, 5),
            (16, 5),
            (18, 5),
            (20, 5),
            (35, 3),
            (36, 3),
            (22, 5),
            (24, 5),
            (37, 3),
            (26, 5),
            (28, 5),
            (30, 5),
        ],
    )?;
    let wks_units = collect_rows(wks_unit_sheet, "WKSMissionUnit")?;

    Ok(Extracted {
        craft_types,
        items,
        actions,
        recipe_levels,
        recipes,
        collectability,
        wks_recipe_groups,
        wks_todos,
        wks_units,
    })
}

fn collect_sheet<M>(excel: &Excel, metadata: M) -> Result<Vec<M::Row>>
where
    M: SheetMetadata,
    M::Error: std::error::Error + Send + Sync + 'static,
{
    let name = metadata.name();
    let sheet = excel
        .sheet(metadata)
        .with_context(|| format!("讀取 {name} header 失敗"))?;
    collect_rows(sheet, &name)
}

fn collect_rows<M>(sheet: ironworks::excel::Sheet<M>, name: &str) -> Result<Vec<M::Row>>
where
    M: SheetMetadata,
    M::Error: std::error::Error + Send + Sync + 'static,
{
    sheet
        .into_iter()
        .map(|row| row.map_err(anyhow::Error::from))
        .collect::<Result<Vec<_>>>()
        .with_context(|| format!("{name} 含有無法解析的資料列；已中止，不會略過"))
}

fn validate_column_layout(
    sheet: &str,
    columns: &[ColumnDefinition],
    expected: &[(u16, u16)],
) -> Result<()> {
    let actual = columns
        .iter()
        .map(|column| (column.offset, column.kind as u16))
        .collect::<Vec<_>>();
    ensure!(
        actual == expected,
        "{sheet} 欄位 layout 與繁中 7.2 稽核版本不符；已中止以避免套用錯誤欄位"
    );
    Ok(())
}

fn normalize(extracted: Extracted, audit: &AuditPolicy) -> Result<Normalized> {
    ensure!(
        extracted.recipes.len() == audit.expected_recipe_count,
        "Recipe 數量改變：預期 {}，實際 {}",
        audit.expected_recipe_count,
        extracted.recipes.len()
    );
    ensure!(
        extracted.recipe_levels.len() == audit.expected_recipe_level_count,
        "RecipeLevelTable 數量改變：預期 {}，實際 {}",
        audit.expected_recipe_level_count,
        extracted.recipe_levels.len()
    );
    validate_jobs(&extracted.craft_types)?;

    let items = extracted
        .items
        .into_iter()
        .map(|item| (item.id, item.name))
        .collect::<HashMap<_, _>>();
    let actions = extracted
        .actions
        .into_iter()
        .map(|action| (action.id, action.name))
        .collect::<HashMap<_, _>>();
    let collectability = extracted
        .collectability
        .into_iter()
        .map(|row| (row.id, row.value))
        .collect::<HashMap<_, _>>();
    let duty_actions = join_duty_actions(
        &extracted.wks_recipe_groups,
        &extracted.wks_todos,
        &extracted.wks_units,
        &extracted.recipes,
        &actions,
    )?;

    let mut recipes = extracted
        .recipes
        .into_iter()
        .map(|source| {
            let job = JOBS.get(source.craft_type_id as usize).with_context(|| {
                format!(
                    "Recipe {} 使用未知 CraftType {}",
                    source.id, source.craft_type_id
                )
            })?;
            let name = items
                .get(&source.item_id)
                .with_context(|| {
                    format!("Recipe {} 找不到結果 Item {}", source.id, source.item_id)
                })?
                .clone();
            let collectability_value = match source.collectability_id {
                Some(id) => Some(*collectability.get(&id).with_context(|| {
                    format!("Recipe {} 找不到 CollectablesShopRefine {id}", source.id)
                })?),
                None => None,
            };
            Ok(Recipe {
                id: source.id,
                job: job.key,
                job_name: job.display_name,
                name,
                item_id: source.item_id,
                recipe_level_id: source.recipe_level_id,
                material_quality_factor: source.material_quality_factor,
                difficulty_factor: source.difficulty_factor,
                quality_factor: source.quality_factor,
                durability_factor: source.durability_factor,
                required_quality: source.required_quality,
                required_craftsmanship: source.required_craftsmanship,
                required_control: source.required_control,
                can_hq: source.can_hq,
                is_expert: source.is_expert,
                recipe_notebook_list: source.recipe_notebook_list,
                collectability: collectability_value,
                cosmic_duty_action: duty_actions.get(&source.id).cloned().flatten(),
            })
        })
        .collect::<Result<Vec<_>>>()?;
    recipes.sort_by_key(|recipe| recipe.id);

    let mut recipe_levels = extracted.recipe_levels;
    recipe_levels.sort_by_key(|level| level.id);
    validate_level_mapping(&recipe_levels, audit)?;

    let dynamic_ids = recipes
        .iter()
        .filter(|recipe| {
            let craft_type = JOBS.iter().position(|job| job.key == recipe.job);
            craft_type.is_some_and(|index| {
                recipe.recipe_level_id == audit.dynamic_recipe_level_id
                    && recipe.recipe_notebook_list == audit.dynamic_notebook_by_craft_type[index]
            })
        })
        .map(|recipe| recipe.id)
        .collect::<Vec<_>>();
    validate_dynamic_membership(&dynamic_ids, audit)?;

    let fixtures = validate_fixtures(&recipes, &recipe_levels, &dynamic_ids)?;
    let counts = RecordCounts {
        recipes: recipes.len(),
        recipe_levels: recipe_levels.len(),
        dynamic_recipes: dynamic_ids.len(),
        wks_recipe_groups: extracted.wks_recipe_groups.len(),
        wks_todos: extracted.wks_todos.len(),
        wks_units: extracted.wks_units.len(),
    };
    let dynamic_manifest = DynamicManifest {
        schema_version: 1,
        manifest_version: "zh-tw-7.2-cosmic-v1".to_owned(),
        data_version: DATA_VERSION.to_owned(),
        recipe_ids: dynamic_ids,
        player_level_to_recipe_level_id: audit.selected_recipe_level_by_player_level.clone(),
    };

    Ok(Normalized {
        recipes,
        recipe_levels,
        dynamic_manifest,
        counts,
        fixtures,
    })
}

fn validate_jobs(craft_types: &[CraftTypeRow]) -> Result<()> {
    let by_id = craft_types
        .iter()
        .map(|row| (row.id, row.name.as_str()))
        .collect::<HashMap<_, _>>();
    for (id, job) in JOBS.iter().enumerate() {
        ensure!(
            by_id.get(&(id as u32)).copied() == Some(job.source_name),
            "CraftType {id} 名稱不符：預期 {}，實際 {:?}",
            job.source_name,
            by_id.get(&(id as u32))
        );
    }
    Ok(())
}

fn validate_level_mapping(levels: &[RecipeLevel], audit: &AuditPolicy) -> Result<()> {
    ensure!(
        audit.selected_recipe_level_by_player_level.len() == 91,
        "動態等級映射必須完整覆蓋 Lv.10-Lv.100"
    );
    let by_id = levels
        .iter()
        .map(|row| (row.id, row))
        .collect::<HashMap<_, _>>();
    for player_level in 10..=100 {
        let selected_id = audit
            .selected_recipe_level_by_player_level
            .get(&player_level)
            .with_context(|| format!("Lv.{player_level} 缺少稽核後 RecipeLevel 映射"))?;
        let selected = by_id.get(selected_id).with_context(|| {
            format!("Lv.{player_level} 指定的 RecipeLevel {selected_id} 不存在")
        })?;
        ensure!(
            selected.class_job_level == player_level,
            "RecipeLevel {selected_id} 的 class_job_level 並非 {player_level}"
        );
        let minimum = levels
            .iter()
            .filter(|row| row.class_job_level == player_level)
            .map(|row| row.id)
            .min()
            .with_context(|| format!("Lv.{player_level} 沒有 RecipeLevel 候選"))?;
        ensure!(
            minimum == *selected_id,
            "Lv.{player_level} 的最低 ID 慣例改變：稽核為 {selected_id}，目前為 {minimum}"
        );
    }
    Ok(())
}

fn validate_dynamic_membership(ids: &[u32], audit: &AuditPolicy) -> Result<()> {
    ensure!(
        ids.len() == audit.dynamic_recipe_count,
        "動態配方數量改變：預期 {}，實際 {}",
        audit.dynamic_recipe_count,
        ids.len()
    );
    let bytes = serde_json::to_vec(ids).context("序列化動態配方 ID 供稽核失敗")?;
    let actual_hash = sha256_hex(&bytes);
    ensure!(
        actual_hash == audit.dynamic_recipe_ids_sha256,
        "動態配方成員改變：預期 hash {}，實際 {}",
        audit.dynamic_recipe_ids_sha256,
        actual_hash
    );
    Ok(())
}

fn validate_fixtures(
    recipes: &[Recipe],
    levels: &[RecipeLevel],
    dynamic_ids: &[u32],
) -> Result<Vec<FixtureResult>> {
    let recipe = |id| {
        recipes
            .iter()
            .find(|recipe| recipe.id == id)
            .with_context(|| format!("驗收 Recipe {id} 不存在"))
    };
    let level_418 = levels
        .iter()
        .find(|level| level.id == 418)
        .context("驗收 RecipeLevel 418 不存在")?;
    ensure!(
        level_418.class_job_level == 79
            && level_418.difficulty == 1710
            && level_418.quality == 4500
            && level_418.durability == 80
            && level_418.progress_divider == 109
            && level_418.quality_divider == 89
            && level_418.progress_modifier == 100
            && level_418.quality_modifier == 100
            && level_418.conditions_flag == 15,
        "RecipeLevel 418 完整 payload 與稽核 fixture 不符"
    );

    let wheel = recipe(36173)?;
    ensure!(
        wheel.name == "宇宙探索用的紡車"
            && wheel.job == "carpenter"
            && wheel.recipe_level_id == 690
            && wheel.recipe_notebook_list == 1496
            && !wheel.is_expert
            && wheel.difficulty_factor == 70
            && wheel.quality_factor == 62
            && wheel.durability_factor == 100
            && wheel.cosmic_duty_action.is_none()
            && dynamic_ids.binary_search(&wheel.id).is_ok(),
        "Recipe 36173 分類或係數與稽核 fixture 不符"
    );
    ensure!(
        apply_factor(u32::from(level_418.difficulty), wheel.difficulty_factor) == 1197
            && apply_factor(level_418.quality, wheel.quality_factor) == 2790
            && apply_factor(u32::from(level_418.durability), wheel.durability_factor) == 80,
        "Recipe 36173 的 Lv.79 有效配方不符 1197/2790/80"
    );

    let expert = recipe(36206)?;
    ensure!(
        expert.name == "宇宙探索用的紡車"
            && expert.recipe_level_id == 743
            && expert.recipe_notebook_list == 1496
            && expert.is_expert
            && dynamic_ids.binary_search(&expert.id).is_err(),
        "Recipe 36206 必須是同名但固定的專家配方"
    );

    let sap = recipe(36178)?;
    ensure!(
        sap.name == "宇宙探索用的樹液"
            && sap.recipe_level_id == 690
            && sap.difficulty_factor == 62
            && sap.quality_factor == 50
            && sap.durability_factor == 50
            && sap.cosmic_duty_action.is_none()
            && dynamic_ids.binary_search(&sap.id).is_ok(),
        "Recipe 36178 分類或係數與稽核 fixture 不符"
    );
    ensure!(
        apply_factor(u32::from(level_418.difficulty), sap.difficulty_factor) == 1060
            && apply_factor(level_418.quality, sap.quality_factor) == 2250
            && apply_factor(u32::from(level_418.durability), sap.durability_factor) == 40,
        "Recipe 36178 未重現遊戲畫面的 1060/2250/40"
    );

    Ok(vec![
        FixtureResult {
            name: "recipe-36173-lv79",
            passed: true,
            detail: "宇宙探索用的紡車；RecipeLevel 418；1197/2790/80；動態普通配方".to_owned(),
        },
        FixtureResult {
            name: "recipe-36206-fixed-expert",
            passed: true,
            detail: "宇宙探索用的紡車；RecipeLevel 743；固定專家配方；不在動態 manifest".to_owned(),
        },
        FixtureResult {
            name: "recipe-36178-lv79-in-game",
            passed: true,
            detail: "宇宙探索用的樹液；RecipeLevel 418；1060/2250/40".to_owned(),
        },
    ])
}

fn join_duty_actions(
    groups: &[WksRecipeGroupRow],
    todos: &[WksTodoRow],
    units: &[WksUnitRow],
    recipes: &[RecipeSourceRow],
    action_names: &HashMap<u32, String>,
) -> Result<HashMap<u32, Option<CosmicDutyAction>>> {
    let groups = groups
        .iter()
        .map(|group| (group.id, group.recipe_ids.as_slice()))
        .collect::<HashMap<_, _>>();
    let todos = todos
        .iter()
        .map(|todo| (todo.id, todo))
        .collect::<HashMap<_, _>>();
    let recipe_jobs = recipes
        .iter()
        .map(|recipe| (recipe.id, recipe.craft_type_id))
        .collect::<HashMap<_, _>>();
    let mut result = HashMap::new();

    for unit in units {
        let Some(job_category) = [unit.class_job_category0, unit.class_job_category1]
            .into_iter()
            .find(|id| (9..=16).contains(id))
        else {
            continue;
        };
        let expected_craft_type = u32::from(job_category - 9);
        if unit.recipe_group_id == 0 {
            continue;
        }
        let recipe_ids = groups.get(&unit.recipe_group_id).with_context(|| {
            format!(
                "WKSMissionUnit {} 找不到 WKSMissionRecipe {}",
                unit.id, unit.recipe_group_id
            )
        })?;
        let action = if unit.todo0_id == 0 {
            None
        } else {
            let todo = todos.get(&unit.todo0_id).with_context(|| {
                format!(
                    "WKSMissionUnit {} 找不到 WKSMissionToDo {}",
                    unit.id, unit.todo0_id
                )
            })?;
            match todo.action_id {
                0 => None,
                46843 => Some(CosmicDutyAction {
                    kind: "stellarSteadyHand",
                    action_id: todo.action_id,
                    name: action_names
                        .get(&todo.action_id)
                        .with_context(|| format!("Action {} 不存在", todo.action_id))?
                        .clone(),
                    max_charges: todo.max_charges,
                    solver_input: true,
                }),
                41269 => {
                    let name = action_names
                        .get(&todo.action_id)
                        .context("Action 41269 不存在")?
                        .clone();
                    ensure!(name == "奇蹟之材", "Action 41269 名稱不符：{name}");
                    ensure!(todo.max_charges > 0, "奇蹟之材的可用次數必須大於 0");
                    Some(CosmicDutyAction {
                        kind: "materialMiracle",
                        action_id: todo.action_id,
                        name,
                        max_charges: todo.max_charges,
                        solver_input: false,
                    })
                }
                unsupported => bail!(
                    "製作任務 {} 使用尚未稽核的宇宙專用技能 ID {unsupported}",
                    unit.id
                ),
            }
        };

        for recipe_id in recipe_ids.iter().copied().filter(|id| *id != 0) {
            let actual_craft_type = recipe_jobs
                .get(&recipe_id)
                .with_context(|| format!("WKS 指向不存在的 Recipe {recipe_id}"))?;
            ensure!(
                *actual_craft_type == expected_craft_type,
                "WKS Recipe {recipe_id} 的職業關聯不一致"
            );
            match result.insert(recipe_id, action.clone()) {
                Some(previous) if previous != action => {
                    bail!("Recipe {recipe_id} 對應到互相衝突的宇宙專用技能")
                }
                _ => {}
            }
        }
    }
    Ok(result)
}

#[derive(thiserror::Error, Debug)]
enum SourceError {
    #[error("Ironworks error: {0}")]
    Ironworks(#[from] ironworks::Error),
    #[error("SeString conversion error: {0}")]
    SeString(#[from] ironworks::sestring::Error),
    #[error("unexpected field type: {field:?}")]
    Field { field: ironworks::excel::Field },
}

impl From<ironworks::excel::Field> for SourceError {
    fn from(field: ironworks::excel::Field) -> Self {
        Self::Field { field }
    }
}

struct CraftTypeMetadata;
struct ItemMetadata;
struct ActionMetadata;
struct RecipeLevelMetadata;
struct RecipeMetadata;
struct CollectabilityMetadata;
struct WksRecipeGroupMetadata;
struct WksTodoMetadata;
struct WksUnitMetadata;

#[derive(Debug)]
struct CraftTypeRow {
    id: u32,
    name: String,
}

#[derive(Debug)]
struct ItemRow {
    id: u32,
    name: String,
}

#[derive(Debug)]
struct ActionRow {
    id: u32,
    name: String,
}

#[derive(Debug)]
struct RecipeSourceRow {
    id: u32,
    craft_type_id: u32,
    recipe_level_id: u32,
    item_id: u32,
    material_quality_factor: u8,
    difficulty_factor: u16,
    quality_factor: u16,
    durability_factor: u16,
    required_quality: u32,
    required_craftsmanship: u16,
    required_control: u16,
    can_hq: bool,
    is_expert: bool,
    recipe_notebook_list: u32,
    collectability_id: Option<u32>,
}

#[derive(Debug)]
struct CollectabilityRow {
    id: u32,
    value: Collectability,
}

#[derive(Debug)]
struct WksRecipeGroupRow {
    id: u32,
    recipe_ids: [u32; 5],
}

#[derive(Debug)]
struct WksTodoRow {
    id: u32,
    action_id: u32,
    max_charges: u8,
}

#[derive(Debug)]
struct WksUnitRow {
    id: u32,
    class_job_category0: u16,
    class_job_category1: u16,
    todo0_id: u32,
    recipe_group_id: u32,
}

impl SheetMetadata for CraftTypeMetadata {
    fn name(&self) -> String {
        "CraftType".to_owned()
    }
    type Row = CraftTypeRow;
    type Error = SourceError;
    fn populate_row(
        &self,
        row: ironworks::excel::Row,
    ) -> std::result::Result<Self::Row, Self::Error> {
        Ok(CraftTypeRow {
            id: row.row_id(),
            name: row.field(2)?.into_string()?.format()?,
        })
    }
}

impl SheetMetadata for ItemMetadata {
    fn name(&self) -> String {
        "Item".to_owned()
    }
    type Row = ItemRow;
    type Error = SourceError;
    fn populate_row(
        &self,
        row: ironworks::excel::Row,
    ) -> std::result::Result<Self::Row, Self::Error> {
        Ok(ItemRow {
            id: row.row_id(),
            name: row.field(9)?.into_string()?.format()?,
        })
    }
}

impl SheetMetadata for ActionMetadata {
    fn name(&self) -> String {
        "Action".to_owned()
    }
    type Row = ActionRow;
    type Error = SourceError;
    fn populate_row(
        &self,
        row: ironworks::excel::Row,
    ) -> std::result::Result<Self::Row, Self::Error> {
        Ok(ActionRow {
            id: row.row_id(),
            name: row.field(0)?.into_string()?.format()?,
        })
    }
}

impl SheetMetadata for RecipeLevelMetadata {
    fn name(&self) -> String {
        "RecipeLevelTable".to_owned()
    }
    type Row = RecipeLevel;
    type Error = SourceError;
    fn populate_row(
        &self,
        row: ironworks::excel::Row,
    ) -> std::result::Result<Self::Row, Self::Error> {
        Ok(RecipeLevel {
            id: row.row_id(),
            class_job_level: row.field(0)?.into_u8()?,
            suggested_craftsmanship: row.field(2)?.into_u16()?,
            difficulty: row.field(3)?.into_u16()?,
            quality: row.field(4)?.into_u32()?,
            progress_divider: row.field(5)?.into_u8()?,
            quality_divider: row.field(6)?.into_u8()?,
            progress_modifier: row.field(7)?.into_u8()?,
            quality_modifier: row.field(8)?.into_u8()?,
            durability: row.field(9)?.into_u16()?,
            conditions_flag: row.field(10)?.into_u16()?,
        })
    }
}

impl SheetMetadata for RecipeMetadata {
    fn name(&self) -> String {
        "Recipe".to_owned()
    }
    type Row = RecipeSourceRow;
    type Error = SourceError;
    fn populate_row(
        &self,
        row: ironworks::excel::Row,
    ) -> std::result::Result<Self::Row, Self::Error> {
        let item_id_raw = row.field(4)?.into_i32()?;
        let item_id = u32::try_from(item_id_raw).unwrap_or(0);
        let collectability_key = row.field(44)?.into_u8()?;
        let collectability_id = match collectability_key {
            1 => Some(u32::from(row.field(45)?.into_u16()?)),
            _ => None,
        };
        Ok(RecipeSourceRow {
            id: row.row_id(),
            craft_type_id: row.field(1)?.into_i32()? as u32,
            recipe_level_id: u32::from(row.field(2)?.into_u16()?),
            item_id,
            material_quality_factor: row.field(25)?.into_u8()?,
            difficulty_factor: row.field(26)?.into_u16()?,
            quality_factor: row.field(27)?.into_u16()?,
            durability_factor: row.field(28)?.into_u16()?,
            required_quality: row.field(29)?.into_u32()?,
            required_craftsmanship: row.field(30)?.into_u16()?,
            required_control: row.field(31)?.into_u16()?,
            can_hq: row.field(37)?.into_bool()?,
            is_expert: row.field(43)?.into_bool()?,
            recipe_notebook_list: u32::from(row.field(22)?.into_u16()?),
            collectability_id,
        })
    }
}

impl SheetMetadata for CollectabilityMetadata {
    fn name(&self) -> String {
        "CollectablesShopRefine".to_owned()
    }
    type Row = CollectabilityRow;
    type Error = SourceError;
    fn populate_row(
        &self,
        row: ironworks::excel::Row,
    ) -> std::result::Result<Self::Row, Self::Error> {
        Ok(CollectabilityRow {
            id: row.row_id(),
            value: Collectability {
                low: row.field(0)?.into_u16()?,
                mid: row.field(1)?.into_u16()?,
                high: row.field(2)?.into_u16()?,
            },
        })
    }
}

impl SheetMetadata for WksRecipeGroupMetadata {
    fn name(&self) -> String {
        "WKSMissionRecipe".to_owned()
    }
    type Row = WksRecipeGroupRow;
    type Error = SourceError;
    fn populate_row(
        &self,
        row: ironworks::excel::Row,
    ) -> std::result::Result<Self::Row, Self::Error> {
        Ok(WksRecipeGroupRow {
            id: row.row_id(),
            recipe_ids: [
                row.field(0)?.into_u32()?,
                row.field(1)?.into_u32()?,
                row.field(2)?.into_u32()?,
                row.field(3)?.into_u32()?,
                row.field(4)?.into_u32()?,
            ],
        })
    }
}

impl SheetMetadata for WksTodoMetadata {
    fn name(&self) -> String {
        "WKSMissionToDo".to_owned()
    }
    type Row = WksTodoRow;
    type Error = SourceError;
    fn populate_row(
        &self,
        row: ironworks::excel::Row,
    ) -> std::result::Result<Self::Row, Self::Error> {
        Ok(WksTodoRow {
            id: row.row_id(),
            action_id: row.field(0)?.into_u32()?,
            max_charges: row.field(1)?.into_u8()?,
        })
    }
}

impl SheetMetadata for WksUnitMetadata {
    fn name(&self) -> String {
        "WKSMissionUnit".to_owned()
    }
    type Row = WksUnitRow;
    type Error = SourceError;
    fn populate_row(
        &self,
        row: ironworks::excel::Row,
    ) -> std::result::Result<Self::Row, Self::Error> {
        Ok(WksUnitRow {
            id: row.row_id(),
            class_job_category0: row.field(2)?.into_u16()?,
            class_job_category1: row.field(3)?.into_u16()?,
            todo0_id: u32::from(row.field(11)?.into_u16()?),
            recipe_group_id: u32::from(row.field(19)?.into_u16()?),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn factors_use_integer_flooring() {
        assert_eq!(apply_factor(1710, 62), 1060);
        assert_eq!(apply_factor(4500, 50), 2250);
        assert_eq!(apply_factor(80, 50), 40);
        assert_eq!(apply_factor(1710, 70), 1197);
        assert_eq!(apply_factor(4500, 62), 2790);
    }

    #[test]
    fn audit_mapping_covers_every_supported_player_level() {
        let audit: AuditPolicy = serde_json::from_str(AUDIT_JSON).expect("audit JSON");
        let levels = audit
            .selected_recipe_level_by_player_level
            .keys()
            .copied()
            .collect::<Vec<_>>();
        assert_eq!(levels, (10..=100).collect::<Vec<_>>());
        assert_eq!(audit.selected_recipe_level_by_player_level[&79], 418);
        assert_eq!(audit.selected_recipe_level_by_player_level[&100], 690);
    }

    #[test]
    fn json_membership_hash_is_stable() {
        assert_eq!(
            sha256_hex(serde_json::to_string(&vec![36173_u32]).unwrap().as_bytes()),
            "e785ec350d8c1f1b243968e7710f79c983b720cde188c48a63b8ec6a09f6d6fa"
        );
    }

    #[test]
    fn revision_validation_rejects_non_commit_values() {
        assert!(validate_revision("main").is_err());
        assert!(validate_revision(&"f".repeat(40)).is_ok());
    }
}
