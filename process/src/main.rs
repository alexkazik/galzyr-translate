mod db;
mod generator;
mod paragraph;
mod processor;
mod sync;

use crate::generator::assets::generate_assets;
use crate::generator::index_html::generate_index_html;
use crate::generator::main_js::generate_main_js;
use crate::generator::manifest_json::generate_manifest_json;
use crate::generator::service_worker_js::create_service_worker_js;
use crate::generator::style_css::generate_style_css;
use crate::processor::{Story, process_story, update_and_stats};
use crate::sync::{PATH_STORIES_JSON, sync};
use clap::Parser;
use crossbeam_channel::bounded;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::{Connection, PgConnection};
use std::collections::HashMap;
use std::panic::panic_any;
use std::thread;
use std::time::Instant;
use tokio::runtime::Builder;
use util::{AUDIO_FORMATS, Config, ConfigArgs, IndexHtml, panicking};

#[derive(Serialize, Deserialize)]
struct Stories(Vec<Story>);

struct SendPtr<T>(*mut T);

// SAFETY: !Send for raw pointers is not for safety, just as a lint
#[allow(unsafe_code)]
unsafe impl<T: Send> Send for SendPtr<T> {}

// SAFETY: !Sync for raw pointers is not for safety, just as a lint
#[allow(unsafe_code)]
unsafe impl<T: Send> Sync for SendPtr<T> {}

#[tokio::main]
async fn main() {
    let start = Instant::now();

    let args = ConfigArgs::parse();
    let config = Config::read(&args);

    // read stories
    let stories_json = panicking::read_to_string(config.source_dir().join(PATH_STORIES_JSON));
    let mut stories = panicking::from_json::<Stories>(&stories_json).0;

    // number of threads to start (for parallel execution)
    let threads = thread::available_parallelism().map_or(1, core::num::NonZero::get);

    // connect to postgres
    let pool = PgPoolOptions::new()
        .max_connections(u32::try_from(threads + 1).expect("threads do not fit in u32"))
        .connect(config.database_translation())
        .await
        .unwrap_or_else(|err| panic!("Failed to connect to database: {err}"));

    let buttons = {
        // acquire connection
        let mut connection = pool
            .acquire()
            .await
            .unwrap_or_else(|err| panic!("Failed to get connection from pool: {err}"));

        // reset stats
        sqlx::query!("UPDATE text SET uses=0, stories=ARRAY[]::bigint[]")
            .execute(&mut *connection)
            .await
            .unwrap_or_else(|err| panic!("Failed to reset stats on text: {err}"));

        sqlx::query!("UPDATE rule SET uses=0, stories=ARRAY[]::bigint[]")
            .execute(&mut *connection)
            .await
            .unwrap_or_else(|err| panic!("Failed to reset stats on rule: {err}"));

        // insert into buttons
        for original in [
            "Continue",
            "End of game",
            "End of scene",
            "No",
            "Reveal outcomes",
            "Saving complete",
            "Start",
            "Yes",
        ] {
            sqlx::query!(
                "INSERT INTO button (original, translated) VALUES ($1, NULL) ON CONFLICT DO NOTHING",
                original,
            )
            .execute(&mut *connection)
            .await
            .unwrap_or_else(|err| panic!("Failed to insert button: {err}"));
        }

        // get all buttons
        let mut buttons = HashMap::new();
        for row in sqlx::query!("SELECT original, translated FROM button")
            .fetch_all(&mut *connection)
            .await
            .unwrap_or_else(|err| panic!("Failed to read button: {err}"))
        {
            let translated = row.translated.unwrap_or_else(|| row.original.clone());
            buttons.insert(row.original, translated);
        }

        drop(connection);

        buttons
    };

    // spawn threads and run process_story
    eprintln!("spawning {threads} threads");
    let mut join_handles = Vec::with_capacity(1 + threads);

    let (channel_tx, channel_rx) = bounded(threads);

    for _ in 0..threads {
        let config = config.clone();
        let buttons = buttons.clone();
        let inp_rx = channel_rx.clone();
        let runtime = Builder::new_current_thread()
            .enable_io()
            .enable_time()
            .build()
            .unwrap_or_else(|err| panic!("failed to create tokio runtime: {err}"));
        let pool = pool.clone();
        join_handles.push(thread::spawn(move || {
            runtime.block_on(async move {
                let mut connection = pool
                    .acquire()
                    .await
                    .unwrap_or_else(|err| panic!("Failed to get connection from pool: {err}"));

                while let Ok(SendPtr(story)) = inp_rx.recv() {
                    #[allow(unsafe_code)]
                    let story = unsafe { &mut *story };
                    process_story(&config, &mut connection, &buttons, story).await;
                }
            });
        }));
    }
    drop(channel_rx);

    // feed stories to the threads
    for story in &mut stories {
        channel_tx
            .send(SendPtr(story))
            .unwrap_or_else(|err| panic!("Failed to send story: {err}"));
    }
    drop(channel_tx);

    // join all threads (and panic if a thread did panic)
    for join_handle in join_handles {
        if let Err(err) = join_handle.join() {
            #[allow(clippy::panic)]
            panic_any(err);
        }
    }

    let mut connection_meta = PgConnection::connect(config.database_meta())
        .await
        .unwrap_or_else(|err| panic!("Failed to connect to the database: {err}"));

    // synchronize (all non generated) files from source to target
    sync(&config, &mut connection_meta).await;

    // acquire connection
    let mut connection = pool
        .acquire()
        .await
        .unwrap_or_else(|err| panic!("Failed to get connection from pool: {err}"));

    // serialize stories
    let stories_json = panicking::to_pretty_json(&Stories(stories));

    // write stories.json
    panicking::write(config.target_dir().join(PATH_STORIES_JSON), &stories_json);

    // generate index.html
    let index_html = IndexHtml::read(config.source_dir().join("index-patched.html"));
    generate_index_html(&config, &index_html, stories_json.len());

    // generate main.js
    generate_main_js(&config);

    // generate manifest.json
    generate_manifest_json(&config);

    // generate style.css
    generate_style_css(&config);

    // generate everything required for "app installation"
    if cfg!(feature = "app") {
        create_service_worker_js(&config);
        let version = index_html.version();
        generate_assets(&config, &mut connection_meta, version, None).await;
        for audio_format in AUDIO_FORMATS {
            generate_assets(&config, &mut connection_meta, version, Some(audio_format)).await;
        }
    }

    // update db and print stats
    update_and_stats(&config, &mut connection).await;

    println!("Time elapsed: {:?}", start.elapsed());
}
