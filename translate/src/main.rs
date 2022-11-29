use clap::Parser;
use core::convert::Infallible;
use core::time::Duration;
use deepl_simple_api::DeepL;
use deepl_simple_api::translate_parameter::{
    Formality, ModelType, OutlineDetection, ShowBilledCharacters, SourceLanguage, SplitSentences,
    TagHandling, TagHandlingVersion, TargetLanguageDyn,
};
use deepl_simple_api::{Error, Options};
use sqlx::{Connection, PgConnection};
use tokio::time::sleep;
use util::{Config, ConfigArgs};

#[tokio::main]
async fn main() {
    let args = ConfigArgs::parse();
    let config = Config::read(&args);

    let (deepl, comment) = {
        let mut connection_meta = PgConnection::connect(config.database_meta())
            .await
            .unwrap_or_else(|err| panic!("failed to connect to postgres: {err}"));

        let row = sqlx::query!("SELECT key, comment FROM deepl WHERE active")
            .fetch_one(&mut connection_meta)
            .await
            .unwrap_or_else(|err| panic!("failed to get active deepl key: {err}"));

        (DeepL::new(row.key), row.comment)
    };

    println!("Using: {comment}");

    let mut connection = PgConnection::connect(config.database_translation())
        .await
        .unwrap_or_else(|err| panic!("failed to connect to postgres: {err}"));

    #[allow(clippy::items_after_statements)]
    const LIMIT: u16 = 100;

    let options = Options::builder()
        .param(TargetLanguageDyn(config.deepl_target_lang().to_string()))
        .params(&[
            &SourceLanguage("EN"),
            &SplitSentences::All,
            &Formality::PreferLess,
            &TagHandling::Xml,
            &TagHandlingVersion::V2,
            &OutlineDetection(false),
            &ModelType::QualityOptimized,
            &ShowBilledCharacters(true),
        ])
        .build();

    let mut usage = deepl
        .usage()
        .await
        .unwrap_or_else(|err| panic!("failed to get usage: {err}"));

    let mut ids = Vec::with_capacity(LIMIT.into());
    let mut o_txt = Vec::with_capacity(LIMIT.into());

    for i in 0.. {
        if i > 0 && (i % 10) == 0 {
            usage = deepl
                .usage()
                .await
                .unwrap_or_else(|err| panic!("failed to get usage: {err}"));
            eprintln!("RE {usage:?}");
        } else {
            eprintln!("LP {usage:?}");
        }

        // pick context to translate
        let Some(row) = sqlx::query!(
            r#"
SELECT context FROM text
WHERE translated IS NULL AND uses>0
  AND (first_story <= $1 OR ($2 AND first_story >= $3)) AND NOT (stories <@ $4)
  AND LENGTH(original) < 40000
ORDER BY first_story ASC, id ASC
LIMIT 1
            "#,
            config.max_story(),
            config.translate_demo(),
            Config::TEXT_ID_DEMO_START,
            config.exclude_stories(),
        )
        .fetch_optional(&mut connection)
        .await
        .unwrap_or_else(|err| panic!("failed to execute query: {err}")) else {
            // nothing found -> everything is translated: exit the loop
            break;
        };
        let context = row.context.as_deref();

        let mut guess_usage = usage.clone();

        ids.clear();
        o_txt.clear();
        let mut o_txt_size = context.map_or(0, str::len);
        for row in sqlx::query!(
            r#"
SELECT id, original
FROM text
WHERE context IS NOT DISTINCT FROM $5
  AND translated IS NULL AND uses>0
  AND (first_story <= $1 OR ($2 AND first_story >= $3)) AND NOT (stories <@ $4)
  AND length(original) < 40000
ORDER BY first_story ASC, id ASC
LIMIT $6
            "#,
            config.max_story(),
            config.translate_demo(),
            Config::TEXT_ID_DEMO_START,
            config.exclude_stories(),
            context,
            i64::from(LIMIT),
        )
        .fetch_all(&mut connection)
        .await
        .unwrap_or_else(|err| panic!("failed to execute query: {err}"))
        {
            o_txt_size += row.original.len();
            if !ids.is_empty() && o_txt_size > 100_000 {
                // potentially breaking the query limit, stop it
                break;
            }
            if ids.is_empty()
                || guess_usage
                    .add(row.original.len())
                    .expect("failed to convert length to u64")
            {
                ids.push(row.id);
                o_txt.push(row.original);
            } else {
                break;
            }
        }

        let t_txt = loop {
            let resp = deepl
                .translate_opt_context(&options, &context, o_txt.as_slice())
                .await;

            if matches!(resp, Err(Error::TooManyRequests)) {
                eprintln!("Too many requests");
                sleep(Duration::from_secs(10)).await;
                continue;
            }

            break resp.unwrap_or_else(|err| {
                eprintln!("context: {context:?}");
                eprintln!("text: {o_txt:?}");
                panic!("{err:#?}")
            });
        };

        let mut missing_billed_characters = false;
        for (id, t) in ids.drain(..).zip(t_txt.into_iter()) {
            sqlx::query!(
                "UPDATE text SET translated=$2 WHERE id=$1",
                id,
                t.text.trim(),
            )
            .execute(&mut connection)
            .await
            .unwrap_or_else(|err| panic!("failed to execute query: {err}"));
            match t.billed_characters {
                Some(billed_characters) => {
                    let result: Result<bool, Infallible> = usage.add(billed_characters);
                    match result {
                        Ok(_) => (),
                        Err(_) => unreachable!(),
                    }
                }
                None => {
                    missing_billed_characters = true;
                }
            }
        }

        // some/all translations do not show billed characters -> just use the initial guess
        if missing_billed_characters {
            usage = guess_usage;
        }
    }
    eprintln!("GU {usage:?}");
}
