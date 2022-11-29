use crate::sync::{PATH_ASSETS_JSON, PATH_ASSETS_MP3_JSON, PATH_ASSETS_OGG_JSON};
use sqlx::PgConnection;
use util::{AUDIO_FORMAT_MP3, AUDIO_FORMAT_OGG, Config, Version, panicking};

pub(crate) async fn generate_assets(
    config: &Config,
    connection_meta: &mut PgConnection,
    version: Version<'_>,
    audio_format: Option<&str>,
) {
    let assets = sqlx::query!(
        "SELECT filename, with_version FROM file WHERE asset AND ($1 = ANY(audio_format) OR $1 IS NULL) ORDER BY with_version DESC, filename ASC",
        audio_format
    )
    .fetch_all(&mut *connection_meta)
    .await
    .unwrap_or_else(|err| panic!("Failed to fetch assets from file: {err}"))
    .into_iter()
    .map(|row| {
        if row.with_version {
            format!("{}/{}?v={}", config.public_url(), row.filename, version)
        } else {
            format!("{}/{}", config.public_url(), row.filename)
        }
    })
    .collect::<Vec<_>>();

    let filename = match audio_format {
        None => PATH_ASSETS_JSON,
        Some(AUDIO_FORMAT_MP3) => PATH_ASSETS_MP3_JSON,
        Some(AUDIO_FORMAT_OGG) => PATH_ASSETS_OGG_JSON,
        Some(audio_format) => panic!("Unsupported audio format \"{audio_format}\" specified"),
    };

    panicking::write(
        config.target_dir().join(filename),
        panicking::to_pretty_json(&assets),
    );
}
