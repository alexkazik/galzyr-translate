mod assets;
mod download;

use crate::assets::update_assets;
use crate::download::download;
use clap::Parser;
use core::str::FromStr;
use sqlx::{Connection, PgConnection};
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};
use util::{Config, ConfigArgs, IndexHtml, panicking};

#[derive(Parser)]
#[command(about, long_about = None)]
struct Args {
    /// Force updating assets and try downloading all
    #[arg(short, long)]
    all: bool,

    /// Only run all patches (do not download at all)
    #[arg(short, long)]
    only_patch: bool,

    #[command(flatten)]
    #[allow(clippy::struct_field_names)]
    config_args: ConfigArgs,
}

#[tokio::main]
async fn main() {
    // read args and config
    let args = Args::parse();
    let config = Config::read(&args.config_args);

    // get connection
    let mut connection = PgConnection::connect(config.database_meta())
        .await
        .unwrap_or_else(|err| panic!("Failed to connect to the database: {err}"));

    let index_html = if args.only_patch {
        IndexHtml::read(config.source_dir().join("index.html"))
    } else {
        // actually download (all) files
        let changed = download(&config, &mut connection, true).await || args.all;
        let index_html = IndexHtml::read(config.source_dir().join("index.html"));
        if changed {
            update_assets(&config, &mut connection, index_html.version()).await;
            download(&config, &mut connection, false).await;
        }
        index_html
    };

    patch_index_html(&config, &index_html);

    extend_style_css(&config);

    run_patch(
        &config.source_dir().join("js/main.js"),
        &config.source_dir().join("js/main-patched.js"),
        include_str!("main.js.patch"),
    );

    run_patch(
        &config.source_dir().join("service-worker.js"),
        &config.source_dir().join("service-worker-patched.js"),
        include_str!("service-worker.js.patch"),
    );
}

fn patch_index_html(config: &Config, index_html: &IndexHtml) {
    let (pre, next) = index_html
        .contents()
        .split_once(" data-story-size=\"")
        .unwrap_or_else(|| panic!("Failed to parse index.html"));
    let (old_value, post) = next
        .split_once('"')
        .unwrap_or_else(|| panic!("Failed to parse index.html"));
    assert!(
        usize::from_str(old_value).is_ok(),
        "old_value is not a number"
    );

    let index_html_filename = config.source_dir().join("index-patched.html");
    let mut index_html_file = panicking::File::create(&index_html_filename);
    index_html_file.write(pre);
    index_html_file.write("\ndata-story-size=\"fan-stories-length\"\n");
    index_html_file.write(post);
}

fn extend_style_css(config: &Config) {
    let mut style_css = panicking::read_to_string(config.source_dir().join("css/style.css"));
    style_css.push_str(include_str!("style.extension.css"));
    panicking::write(
        config.source_dir().join("css/style-extended.css"),
        style_css,
    );
}

fn run_patch(input: &Path, output: &Path, patch: &str) {
    // patch main.js
    let mut child = Command::new("patch")
        .arg("-o")
        .arg(output)
        .arg(input)
        .stdin(Stdio::piped())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap_or_else(|err| panic!("Failed to spawn `patch {}`: {err}", input.display()));

    child
        .stdin
        .take()
        .unwrap_or_else(|| panic!("Failed to take `stdin`"))
        .write_all(patch.as_bytes())
        .unwrap_or_else(|err| {
            panic!(
                "Failed to write to `patch-file` to `patch {}`: {err}",
                input.display()
            )
        });

    let status = child
        .wait()
        .unwrap_or_else(|err| panic!("Failed to run `patch {}`: {err}", input.display()));

    assert!(
        status.success(),
        "`patch {}` did not exit successfully, but with {status}",
        input.display()
    );
}
