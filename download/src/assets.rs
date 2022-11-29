use sqlx::PgConnection;
use std::collections::HashSet;
use util::{AUDIO_FORMATS, Config, Version, panicking};

pub(crate) async fn update_assets(
    config: &Config,
    connection: &mut PgConnection,
    version: Version<'_>,
) {
    eprintln!("Version: {version}");

    let mut assets = HashSet::new();
    for audio_format in AUDIO_FORMATS {
        assets.extend(
            load_assets(version, audio_format)
                .await
                .into_iter()
                .map(|asset| (asset, *audio_format)),
        );
    }

    let version_suffix = format!("?v={version}");

    sqlx::query!("UPDATE file SET audio_format = '{}'")
        .execute(&mut *connection)
        .await
        .unwrap_or_else(|err| panic!("Failed to reset file audio_format: {err}"));

    for (asset, audio_format) in &assets {
        let asset = asset
            .strip_prefix("/")
            .unwrap_or_else(|| panic!("Invalid asset url: {asset:?}"));
        let (asset, with_version) = asset
            .strip_suffix(&version_suffix)
            .map_or((asset, false), |a| (a, true));

        sqlx::query!(
            r#"
INSERT INTO file (filename, last_modified, size, important, asset, with_version, audio_format)
VALUES ($1, 'Wed, 21 Oct 2015 07:28:00 GMT', -1, false, true, $2, array_append('{}', $3))
ON CONFLICT (filename) DO UPDATE SET
    important=false,
    asset=true,
    with_version=$2,
    audio_format=ARRAY(SELECT DISTINCT e FROM unnest(array_append(file.audio_format, $3)) AS a(e) ORDER BY e)
            "#,
            asset,
            with_version,
            audio_format,
        )
        .execute(&mut *connection)
        .await
        .unwrap_or_else(|err| panic!("Failed to insert file: {err}"));
    }

    for asset in
        sqlx::query_scalar!("SELECT filename FROM file WHERE asset AND audio_format = '{}'")
            .fetch_all(&mut *connection)
            .await
            .unwrap_or_else(|err| panic!("Failed to fetch file: {err}"))
    {
        if panicking::exists(config.source_dir().join(&asset)) {
            panicking::remove_file(config.source_dir().join(&asset));
        }
        sqlx::query!("DELETE FROM file WHERE filename=$1", &asset)
            .execute(&mut *connection)
            .await
            .unwrap_or_else(|err| panic!("Failed to delete file: {err}"));
    }
}

async fn load_assets(version: Version<'_>, audio_format: &'static str) -> Vec<String> {
    reqwest::get(format!(
        "https://stories.daimyria.fi/assets.php?language=en-GB&audio-format={audio_format}&encyclopedia=1&version={version}"
    ))
    .await
    .unwrap_or_else(|err| panic!("Failed to send http request: {err}"))
    .json::<Vec<String>>()
    .await
    .unwrap_or_else(|err| panic!("Failed to decode JSON: {err}"))
}
