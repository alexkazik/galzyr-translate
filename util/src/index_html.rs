use crate::panicking;
use core::fmt::{Debug, Display, Formatter};
use std::path::Path;

pub struct IndexHtml {
    contents: String,
    version: String,
}

impl IndexHtml {
    pub fn read<P: AsRef<Path>>(path_to_index_html: P) -> IndexHtml {
        fn inner(path_to_index_html: &Path) -> IndexHtml {
            let contents = panicking::read_to_string(path_to_index_html);

            let version = contents
                .strip_prefix("<!DOCTYPE html><html lang=\"en-GB\" version=\"")
                .unwrap_or_else(|| panic!("Failed to parse index.html"))
                .split('"')
                .next()
                .unwrap_or_else(|| panic!("Failed to parse index.html"))
                .to_string();

            IndexHtml { contents, version }
        }

        inner(path_to_index_html.as_ref())
    }

    #[inline]
    #[must_use]
    pub fn contents(&self) -> &str {
        &self.contents
    }

    #[inline]
    #[must_use]
    pub fn version(&self) -> Version<'_> {
        Version(self.version.as_str())
    }
}

#[derive(Copy, Clone)]
pub struct Version<'a>(&'a str);

impl Debug for Version<'_> {
    fn fmt(&self, f: &mut Formatter<'_>) -> core::fmt::Result {
        Debug::fmt(&self.0, f)
    }
}

impl Display for Version<'_> {
    fn fmt(&self, f: &mut Formatter<'_>) -> core::fmt::Result {
        Display::fmt(&self.0, f)
    }
}
