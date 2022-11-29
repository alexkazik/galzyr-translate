use sqlx::PgConnection;
use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use util::{Config, panicking};

pub(crate) const PATH_INDEX_HTML: &str = "index.html";
pub(crate) const PATH_MAIN_JS: &str = "js/main.js";
pub(crate) const PATH_MANIFEST_JSON: &str = "json/manifest-en-gb.json";
pub(crate) const PATH_STORIES_JSON: &str = "json/stories-en-gb.json";
pub(crate) const PATH_STYLE_CSS: &str = "css/style.css";
pub(crate) const PATH_SERVICE_WORKER: &str = "service-worker.js";

pub(crate) const PATH_ASSETS_JSON: &str = "assets.json";
pub(crate) const PATH_ASSETS_MP3_JSON: &str = "assets-mp3.json";
pub(crate) const PATH_ASSETS_OGG_JSON: &str = "assets-ogg.json";

const MODE_APP: Mode = if cfg!(feature = "app") {
    Mode::Later
} else {
    Mode::Remove
};

const SPECIAL_PATHS: &[(&str, Mode)] = &[
    // these are replaced by adated versions
    (PATH_INDEX_HTML, Mode::Later),
    (PATH_MAIN_JS, Mode::Later),
    (PATH_MANIFEST_JSON, Mode::Later),
    (PATH_STORIES_JSON, Mode::Later),
    (PATH_STYLE_CSS, Mode::Later),
    // this is added later (like above) or simply skipped because it's currently not supported
    (PATH_SERVICE_WORKER, MODE_APP),
    (PATH_ASSETS_JSON, MODE_APP),
    (PATH_ASSETS_MP3_JSON, MODE_APP),
    (PATH_ASSETS_OGG_JSON, MODE_APP),
];

const ADDITIONAL_FILES: &[&str] = &[PATH_ASSETS_JSON, PATH_ASSETS_MP3_JSON, PATH_ASSETS_OGG_JSON];

#[derive(Copy, Clone)]
enum Mode {
    Copy,
    Symlink,
    Later,
    Remove,
}

/// Create symlinks to the source in the target folder
///
/// Including creating subdirectories.
/// Skipping any special files (those who will be generated later).
pub(crate) async fn sync(config: &Config, connection_meta: &mut PgConnection) {
    assert!(
        {
            #[allow(clippy::nonminimal_bool)]
            !(!cfg!(unix) && config.link_to().is_some())
        },
        "symlink (link_to) is only supported on Unix(like)"
    );

    let files = sqlx::query_scalar!("SELECT filename FROM file")
        .fetch_all(&mut *connection_meta)
        .await
        .unwrap_or_else(|err| panic!("Failed to fetch from file: {err}"));

    if !panicking::exists(config.target_dir()) {
        panicking::create_dir(config.target_dir());
    }

    let mut tree = Tree::Directory(BTreeMap::new());

    for file in files
        .iter()
        .map(String::as_str)
        .chain(ADDITIONAL_FILES.iter().copied())
    {
        tree.insert(config, file);
    }

    let Tree::Directory(dir) = tree else {
        panic!("invalid tree structure")
    };

    sync_dir(
        &dir,
        config.source_dir(),
        config.target_dir(),
        config.link_to().unwrap_or(Path::new("/no /where")),
    );
}

enum Tree<'a> {
    Directory(BTreeMap<&'a str, Tree<'a>>),
    File { mode: Mode },
}

impl<'a> Tree<'a> {
    fn insert(&mut self, config: &Config, filename: &'a str) {
        let mode = if config.link_to().is_some() {
            Mode::Symlink
        } else {
            Mode::Copy
        };
        let mut path = filename.split('/').peekable();
        let mut tree = self;
        loop {
            let Tree::Directory(dir) = tree else {
                panic!("invalid tree structure")
            };
            let next = path
                .next()
                .unwrap_or_else(|| panic!("expected path piece, should always be there"));
            if path.peek().is_none() {
                dir.insert(
                    next,
                    Tree::File {
                        mode: SPECIAL_PATHS
                            .iter()
                            .find(|(name, _)| name == &filename)
                            .map_or(mode, |(_, special)| *special),
                    },
                );
                return;
            } else {
                tree = dir.entry(next).or_insert(Tree::Directory(BTreeMap::new()));
            }
        }
    }
}

fn sync_dir(source_dir: &BTreeMap<&str, Tree>, source: &Path, target: &Path, link_to: &Path) {
    let mut target_dir = BTreeMap::new();

    for entry in panicking::read_dir(target) {
        target_dir.insert(entry.file_name(), entry.file_type());
    }

    for (source_name, source_type) in source_dir {
        let new_source = source.join(source_name);
        let new_target = target.join(source_name);

        let exists = target_dir.remove_entry(OsStr::new(source_name));

        if let Some((target_name, target_type)) = exists {
            // the entry already exists, check if it matches
            match source_type {
                Tree::Directory(_) => {
                    assert!(
                        target_type.is_dir(),
                        "entry {}/{} of type {target_type:?} which should be a directory (or not existent)",
                        target.display(),
                        target_name.display()
                    );
                    // directory is already there, everything is ok
                }
                Tree::File { mode: Mode::Copy } => {
                    assert!(
                        target_type.is_file(),
                        "entry {}/{} of type {target_type:?} which should be a file (or not existent)",
                        target.display(),
                        target_name.display()
                    );
                    // remove file just to recreate it later
                    panicking::remove_file(&new_target);
                }
                Tree::File {
                    mode: Mode::Symlink,
                } => {
                    assert!(
                        target_type.is_symlink(),
                        "entry {}/{} of type {target_type:?} which should be a symlink (or not existent)",
                        target.display(),
                        target_name.display()
                    );
                    // remove symlink just to recreate it later
                    panicking::remove_file(&new_target);
                }
                Tree::File { mode: Mode::Later } => {
                    assert!(
                        target_type.is_file(),
                        "entry {}/{} of type {target_type:?} which should be a file (or not existent)",
                        target.display(),
                        target_name.display()
                    );
                    // will be overwritten, nothing to do
                }
                Tree::File { mode: Mode::Remove } => {
                    assert!(
                        target_type.is_symlink() || target_type.is_file(),
                        "entry {}/{} of type {target_type:?} which should be a symlink or file (or not existent)",
                        target.display(),
                        target_name.display()
                    );
                    // remove symlink/file
                    panicking::remove_file(&new_target);
                }
            }
        } else {
            // does not already exists
            match source_type {
                Tree::Directory(_) => {
                    // create the sub-directory
                    panicking::create_dir(&new_target);
                }
                Tree::File { .. } => {
                    // symlink or file will be created, everything is ok
                }
            }
        }

        match source_type {
            Tree::Directory(sub_tree) => {
                let new_link_to = if link_to.is_absolute() {
                    link_to.join(source_name)
                } else {
                    let mut new_link_to = PathBuf::new();
                    new_link_to.push("..");
                    new_link_to.push(link_to);
                    new_link_to.push(source_name);
                    new_link_to
                };
                sync_dir(sub_tree, &new_source, &new_target, &new_link_to);
            }
            Tree::File { mode: Mode::Copy } => {
                panicking::copy(new_source, &new_target);
            }
            Tree::File {
                mode: Mode::Symlink,
            } => {
                #[cfg(unix)]
                {
                    std::os::unix::fs::symlink(link_to.join(source_name), &new_target)
                        .unwrap_or_else(|err| {
                            panic!("Failed to create symlink {}: {err}", new_target.display())
                        });
                }
                #[cfg(not(unix))]
                bail!("symlinks are not supported on this platform");
            }
            Tree::File {
                mode: Mode::Later | Mode::Remove,
            } => {
                // will be handled later or has already been removed
            }
        }
    }

    if let Some((target_name, target_type)) = target_dir.first_key_value() {
        panic!(
            "entry {}/{} of type {target_type:?} which should not exist",
            target.display(),
            target_name.display(),
        );
    }
}
