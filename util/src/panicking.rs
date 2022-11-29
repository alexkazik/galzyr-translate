use core::any::type_name;
use html_parser::Dom;
use std::ffi::OsString;
use std::io::Write;
use std::path::Path;
use std::{fmt, fs};

// simple fs functions

pub fn copy<P: AsRef<Path>, Q: AsRef<Path>>(from: P, to: Q) -> u64 {
    let from = from.as_ref();
    let to = to.as_ref();
    fs::copy(from, to).unwrap_or_else(|err| {
        panic!(
            "Failed to copy file from \"{}\" to \"{}\": {err}",
            from.display(),
            to.display()
        )
    })
}

pub fn create_dir<P: AsRef<Path>>(path: P) {
    let path = path.as_ref();
    fs::create_dir(path)
        .unwrap_or_else(|err| panic!("Failed create directory \"{}\": {err}", path.display()));
}

pub fn exists<P: AsRef<Path>>(path: P) -> bool {
    let path = path.as_ref();
    fs::exists(path)
        .unwrap_or_else(|err| panic!("Failed to check if \"{}\" exists: {err}", path.display()))
}

pub fn metadata<P: AsRef<Path>>(path: P) -> fs::Metadata {
    let path = path.as_ref();
    fs::metadata(path)
        .unwrap_or_else(|err| panic!("Failed to get metadate for \"{}\": {err}", path.display()))
}

pub fn read<P: AsRef<Path>>(path: P) -> Vec<u8> {
    let path = path.as_ref();
    fs::read(path).unwrap_or_else(|err| panic!("Failed to read \"{}\": {err}", path.display()))
}

pub fn read_to_string<P: AsRef<Path>>(path: P) -> String {
    let path = path.as_ref();
    fs::read_to_string(path)
        .unwrap_or_else(|err| panic!("Failed to read \"{}\": {err}", path.display()))
}

pub fn remove_file<P: AsRef<Path>>(path: P) {
    let path = path.as_ref();
    fs::remove_file(path)
        .unwrap_or_else(|err| panic!("Failed to delete \"{}\": {err}", path.display()));
}

pub fn write<P: AsRef<Path>, C: AsRef<[u8]>>(path: P, contents: C) {
    let path = path.as_ref();
    fs::write(path, contents)
        .unwrap_or_else(|err| panic!("Failed to write \"{}\": {err}", path.display()));
}

// writing into a file

pub struct File<'a> {
    path: &'a Path,
    inner: fs::File,
}

impl File<'_> {
    #[must_use]
    pub fn create(path: &Path) -> File<'_> {
        File {
            path,
            inner: fs::File::create(path)
                .unwrap_or_else(|err| panic!("Failed to create \"{}\": {err}", path.display())),
        }
    }

    pub fn write<C: AsRef<[u8]>>(&mut self, contents: C) {
        self.inner
            .write_all(contents.as_ref())
            .unwrap_or_else(|err| panic!("Failed to write to \"{}\": {err}", self.path.display()));
    }

    pub fn write_fmt(&mut self, args: fmt::Arguments<'_>) {
        self.inner
            .write_fmt(args)
            .unwrap_or_else(|err| panic!("Failed to write to \"{}\": {err}", self.path.display()));
    }
}

// reading a directory

pub struct ReadDir<'a> {
    path: &'a Path,
    inner: fs::ReadDir,
}

#[must_use]
pub fn read_dir(path: &Path) -> ReadDir<'_> {
    ReadDir {
        path,
        inner: fs::read_dir(path)
            .unwrap_or_else(|err| panic!("Failed to read directory \"{}\": {err}", path.display())),
    }
}

impl Iterator for ReadDir<'_> {
    type Item = DirEntry;

    fn next(&mut self) -> Option<Self::Item> {
        self.inner.next().map(|inner| DirEntry {
            inner: inner.unwrap_or_else(|err| {
                panic!(
                    "failed to read directory entry {}: {err}",
                    self.path.display()
                )
            }),
        })
    }
}

pub struct DirEntry {
    inner: fs::DirEntry,
}

impl DirEntry {
    #[must_use]
    pub fn file_name(&self) -> OsString {
        self.inner.file_name()
    }

    #[must_use]
    pub fn file_type(&self) -> fs::FileType {
        self.inner.file_type().unwrap_or_else(|err| {
            panic!(
                "Failed to the type of file {}: {err}",
                self.inner.file_name().display()
            )
        })
    }
}

// json de-/serialization

#[must_use]
pub fn from_json<'de, T: serde::Deserialize<'de>>(s: &'de str) -> T {
    serde_json::from_str(s)
        .unwrap_or_else(|err| panic!("Failed to deserialize type {}: {err}", type_name::<T>()))
}

#[must_use]
pub fn to_pretty_json<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string_pretty(value)
        .unwrap_or_else(|err| panic!("Failed to serialize of type {}: {err}", type_name::<T>()))
}

// dom

#[must_use]
pub fn parse_dom<'a>(s: &'a str, t: &str) -> Dom<'a> {
    Dom::parse(s).unwrap_or_else(|err| panic!("Failed to parse Dom for {t}: {err}"))
}
