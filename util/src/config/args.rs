use clap::Parser;

#[derive(Parser)]
#[command(about, long_about = None)]
pub struct ConfigArgs {
    /// Path to the config file, default: `$MANIFEST_DIR/../config.toml`
    #[arg(short, long)]
    pub(crate) config: Option<String>,

    /// Overrides the `public url` setting (set to "" to remove the option)
    #[arg(long)]
    pub(crate) public_url: Option<String>,

    /// Overrides the `target directory` setting
    #[arg(long)]
    pub(crate) target_dir: Option<String>,

    /// Uses the `copy files` method (and not `link to`)
    #[arg(long)]
    pub(crate) copy_files: bool,

    /// Uses the `link to` method (and not `copy files`)
    #[arg(long)]
    pub(crate) link_to: Option<String>,
}
