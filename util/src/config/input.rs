use crate::config::args::ConfigArgs;
use crate::config::output::Config;
use crate::panicking;
use serde::Deserialize;
use std::borrow::Cow;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
struct ConfigToml<'a> {
    database: String,
    database_translation: Option<String>,
    language: String,
    language_name: String,
    deepl_target_lang: String,
    #[serde(borrow)]
    source_dir: Cow<'a, str>,
    #[serde(borrow)]
    target_dir: Cow<'a, str>,
    #[serde(default)]
    link_to: Option<Cow<'a, str>>,
    #[serde(default)]
    #[serde(borrow)]
    public_url: Cow<'a, str>,
    translate_demo: bool,
    max_story: Option<i64>,
    debug_story: Option<i64>,
    exclude_stories: Option<Vec<i64>>,
}

impl Config {
    #[must_use]
    pub fn read(args: &ConfigArgs) -> Self {
        let (base_path, file_path) = match &args.config {
            None => {
                let mut base_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
                if let Some(last) = base_path.file_name()
                    && last != "."
                    && last != ".."
                    && base_path.pop()
                {
                    // already done
                } else {
                    // workaround: add `..`
                    base_path.push("..");
                }
                let file_path = base_path.join("config.toml");
                (base_path, file_path)
            }
            Some(file_path) => {
                let file_path = PathBuf::from(file_path);
                let base_path = file_path.parent().unwrap_or(Path::new(".")).to_path_buf();
                (base_path, file_path)
            }
        };

        // read config
        let file = panicking::read(&file_path);
        let config: ConfigToml = toml::from_slice(&file).unwrap_or_else(|err| {
            panic!(
                "Failed to parse config file \"{}\": {err}",
                file_path.display()
            )
        });

        let public_url = args
            .public_url
            .as_ref()
            .map_or(config.public_url.as_ref(), |s| s.as_str())
            .trim_end_matches('/');

        let target_dir = args
            .target_dir
            .as_ref()
            .map_or(config.target_dir.as_ref(), |s| s.as_str());

        assert!(!config.database.is_empty());
        assert!(
            config
                .database_translation
                .as_ref()
                .is_none_or(|s| !s.is_empty()),
            "database_translation can't be empty (but can be missing)"
        );
        assert!(!config.language.is_empty());
        assert!(!config.language_name.is_empty());
        assert!(!config.deepl_target_lang.is_empty());
        assert!(!config.source_dir.is_empty());
        assert!(!target_dir.is_empty());
        assert!(
            public_url.is_empty() || public_url.starts_with('/'),
            "public_url must be empty/not set (for root) or start with '/'"
        );

        Config {
            database: config.database,
            database_translation: config.database_translation,
            language: config.language,
            language_name: config.language_name,
            deepl_target_lang: config.deepl_target_lang,
            source_dir: base_path.join(&*config.source_dir),
            target_dir: base_path.join(target_dir),
            link_to: match (args.copy_files, &args.link_to, &config.link_to) {
                (_, None, Some(cfg_link_to)) if cfg_link_to.is_empty() => {
                    panic!("link_to can't be empty")
                }
                (_, Some(arg_link_to), _) if arg_link_to.is_empty() => {
                    panic!("--link-to can't be empty")
                }
                (true, Some(_), _) => {
                    panic!("--copy-files and --link-to can't be used at the same time")
                }
                (false, Some(arg_link_to), _) => Some(PathBuf::from(arg_link_to)),
                (false, None, Some(cfg_link_to)) => Some(PathBuf::from(cfg_link_to.as_ref())),
                (false, None, None) | (true, None, _) => None,
            },
            public_url: public_url.to_string(),
            translate_demo: config.translate_demo,
            max_story: config.max_story.unwrap_or(Self::TEXT_ID_MAIN_STORY_END),
            debug_story: config.debug_story,
            exclude_stories: config.exclude_stories.unwrap_or_default(),
        }
    }
}
