use reqwest::header::IF_MODIFIED_SINCE;
use reqwest::{StatusCode, Url};
use sqlx::PgConnection;
use util::{Config, panicking};

pub(crate) async fn download(
    config: &Config,
    connection: &mut PgConnection,
    important: bool,
) -> bool {
    let mut changed = false;
    let client = reqwest::Client::new();

    let base_url = Url::parse("https://stories.daimyria.fi/")
        .unwrap_or_else(|err| panic!("Failed to parse URL: {err}"));

    for row in sqlx::query!(
        "SELECT filename, last_modified, size FROM file WHERE important=$1 ORDER BY filename ASC",
        important,
    )
    .fetch_all(&mut *connection)
    .await
    .unwrap_or_else(|err| panic!("Failed to fetch file rows: {err}"))
    {
        print!("{}... ", row.filename);
        let filename = config.source_dir().join(&row.filename);

        let force = !panicking::exists(&filename)
            || panicking::metadata(&filename).len() != row.size.cast_unsigned();

        let mut rq = client.get(
            base_url
                .join(&row.filename)
                .unwrap_or_else(|err| panic!("Failed to create url: {err}")),
        );
        if !force {
            rq = rq.header(IF_MODIFIED_SINCE, &row.last_modified);
        }
        let rp = rq
            .send()
            .await
            .unwrap_or_else(|err| panic!("Failed to send http request: {err}"));
        if rp.status() == StatusCode::OK {
            println!("Updated");
            let last_modified = rp
                .headers()
                .get("Last-Modified")
                .unwrap_or_else(|| panic!("Last modified header not found"))
                .to_str()
                .unwrap_or_else(|err| panic!("Last modified header not valid UTF-8: {err}"))
                .to_string();
            let bytes = rp
                .bytes()
                .await
                .unwrap_or_else(|err| panic!("Failed to read via http: {err}"));
            panicking::write(filename, &bytes);

            sqlx::query!(
                "UPDATE file SET last_modified=$1, size=$2 WHERE filename=$3",
                last_modified,
                i64::try_from(bytes.len())
                    .unwrap_or_else(|err| panic!("Failed to convert length to i64: {err}")),
                &row.filename,
            )
            .execute(&mut *connection)
            .await
            .unwrap_or_else(|err| panic!("Failed to update file: {err}"));
            changed = true;
        } else if rp.status() == StatusCode::NOT_MODIFIED {
            println!("Not Modified");
        } else {
            println!();
            panic!(" ERROR: {}", rp.status());
        }
    }

    changed
}
