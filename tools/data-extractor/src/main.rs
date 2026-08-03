use std::path::PathBuf;

use anyhow::Result;
use clap::Parser;
use ff14_moon_data_extractor::{GenerateOptions, generate};

#[derive(Debug, Parser)]
#[command(about = "從版本鎖定的繁中 FF14 客戶端產生 FF14_Moon 靜態資料")]
struct Args {
    #[arg(long)]
    game_path: PathBuf,
    #[arg(long, default_value = "public/data/zh-tw-7.2")]
    output_dir: PathBuf,
    #[arg(long)]
    generator_revision: String,
    #[arg(long)]
    generated_at: String,
}

fn main() -> Result<()> {
    let args = Args::parse();
    generate(&GenerateOptions {
        game_path: args.game_path,
        output_dir: args.output_dir,
        generator_revision: args.generator_revision,
        generated_at: args.generated_at,
    })
}
