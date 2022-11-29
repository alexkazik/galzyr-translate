use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct Config {
    pub(crate) database: String,
    pub(crate) database_translation: Option<String>,
    pub(crate) language: String,
    pub(crate) language_name: String,
    pub(crate) deepl_target_lang: String,
    pub(crate) source_dir: PathBuf,
    pub(crate) target_dir: PathBuf,
    pub(crate) link_to: Option<PathBuf>,
    pub(crate) public_url: String,
    pub(crate) translate_demo: bool,
    pub(crate) max_story: i64,
    pub(crate) debug_story: Option<i64>,
    pub(crate) exclude_stories: Vec<i64>,
}

impl Config {
    pub const TEXT_ID_DEMO_START: i64 = 1_000_000;
    pub(crate) const TEXT_ID_MAIN_STORY_END: i64 = Self::TEXT_ID_DEMO_START - 1;

    #[inline]
    #[must_use]
    pub fn database_meta(&self) -> &str {
        &self.database
    }

    #[inline]
    #[must_use]
    pub fn database_translation(&self) -> &str {
        self.database_translation.as_ref().unwrap_or(&self.database)
    }

    #[inline]
    #[must_use]
    pub fn language(&self) -> &str {
        &self.language
    }

    #[inline]
    #[must_use]
    pub fn language_name(&self) -> &str {
        &self.language_name
    }

    #[inline]
    #[must_use]
    pub fn deepl_target_lang(&self) -> &str {
        &self.deepl_target_lang
    }

    #[inline]
    #[must_use]
    pub fn source_dir(&self) -> &Path {
        &self.source_dir
    }

    #[inline]
    #[must_use]
    pub fn target_dir(&self) -> &Path {
        &self.target_dir
    }

    #[inline]
    #[must_use]
    pub fn link_to(&self) -> Option<&Path> {
        self.link_to.as_ref().map(AsRef::as_ref)
    }

    #[inline]
    #[must_use]
    pub fn public_url(&self) -> &str {
        &self.public_url
    }

    #[inline]
    #[must_use]
    pub fn translate_demo(&self) -> bool {
        self.translate_demo
    }

    #[inline]
    #[must_use]
    pub fn max_story(&self) -> i64 {
        self.max_story
    }

    #[inline]
    #[must_use]
    pub fn debug_story(&self) -> Option<i64> {
        self.debug_story
    }

    #[inline]
    #[must_use]
    pub fn exclude_stories(&self) -> &[i64] {
        &self.exclude_stories
    }
}
