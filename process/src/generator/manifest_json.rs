use crate::sync::PATH_MANIFEST_JSON;
use serde::{Deserialize, Serialize};
use util::{Config, panicking};

#[derive(Serialize, Deserialize)]
struct ManifestIcon {
    src: String,
    r#type: String,
    sizes: String,
    purpose: String,
}
#[derive(Serialize, Deserialize)]
struct Manifest {
    short_name: String,
    name: String,
    icons: Vec<ManifestIcon>,
    start_url: String,
    scope: String,
    background_color: String,
    display: String,
    theme_color: String,
}

pub(crate) fn generate_manifest_json(config: &Config) {
    let file = panicking::read_to_string(config.source_dir().join(PATH_MANIFEST_JSON));

    let mut manifest = panicking::from_json::<Manifest>(&file);

    manifest
        .icons
        .iter_mut()
        .for_each(|icon| icon.src = format!("{}{}", config.public_url(), icon.src));

    manifest.start_url = format!("{}{}", config.public_url(), manifest.start_url);
    manifest.scope = format!("{}{}", config.public_url(), manifest.scope);

    let manifest = panicking::to_pretty_json(&manifest);

    panicking::write(config.target_dir().join(PATH_MANIFEST_JSON), &manifest);
}
