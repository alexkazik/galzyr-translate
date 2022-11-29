mod flavor;
mod option;
mod rules;
mod update_and_stats;

use crate::processor::flavor::process_flavor;
use crate::processor::option::process_option;
use crate::processor::rules::process_rules;
pub(crate) use crate::processor::update_and_stats::update_and_stats;
use core::str::FromStr;
use html_escape::NAMED_ENTITIES;
use html_parser::Node;
use html_parser::for_each::{
    ForEach, NoBrk, NoErr, WalkResult, element, element_mut_async, text, text_mut,
};
use serde::{Deserialize, Serialize};
use sqlx::Postgres;
use sqlx::pool::PoolConnection;
use std::borrow::Cow;
use std::collections::HashMap;
use util::{Config, panicking};

#[derive(Serialize, Deserialize)]
pub(crate) struct Story {
    #[serde(rename = "ID")]
    id: i64,
    #[serde(rename = "HTML")]
    html: String,
}

pub(crate) async fn process_story(
    config: &Config,
    connection: &mut PoolConnection<Postgres>,
    buttons: &HashMap<String, String>,
    story: &mut Story,
) {
    let mut h0 = panicking::parse_dom(&story.html, "story");

    let incomplete = h0
        .children
        .iter()
        .any(|e| e.element().is_some_and(|e| e.has_class("incomplete")));

    let broken = h0
        .for_each(text(|t| {
            if t.contains('<') {
                WalkResult::Break(())
            } else {
                WalkResult::Continue
            }
        }))
        .no_err()
        .is_break();

    let scene_number = h0
        .for_each(element(|e| {
            if e.has_class("scene-number") {
                WalkResult::Break(
                    e.children
                        .first()
                        .and_then(|n| n.text())
                        .and_then(|t| i64::from_str(t).ok()),
                )
            } else {
                WalkResult::Continue
            }
        }))
        .no_err()
        .break_value()
        .flatten()
        .unwrap_or(1_000_000 + story.id);

    if broken {
        eprintln!("broken html in scene {scene_number}, incomplete={incomplete}");
    }
    if incomplete
        || broken
        || config.exclude_stories().contains(&scene_number)
        || (scene_number > config.max_story() && scene_number < Config::TEXT_ID_DEMO_START)
        || (scene_number >= Config::TEXT_ID_DEMO_START && !config.translate_demo())
    {
        return;
    }

    h0.for_each_mut(text_mut(|t| {
        // check if there is an `&` not followed by valid entity
        if t.split('&').skip(1).any(is_broken_html_entity) {
            // fix all "broken" `&`'s
            let mut new = String::with_capacity(t.len() + 20);
            let mut splits = t.split('&');
            new.push_str(
                splits
                    .next()
                    .expect("expected path piece, should always be there"),
            );
            for segment in splits {
                new.push('&');
                if is_broken_html_entity(segment) {
                    new.push_str("amp;");
                }
                new.push_str(segment);
            }
            t.0 = Cow::Owned(new);
        }

        WalkResult::Continue
    }))
    .no_err()
    .no_brk();

    if let Some(debug_story) = config.debug_story()
        && debug_story == scene_number
    {
        panicking::write("debug/old.html", &story.html);
    }

    let mut context = String::new();

    h0.for_each_mut_async(element_mut_async(async |e| {
        if e.has_class("flavour") {
            let ctx = process_flavor(connection, scene_number, e).await;
            if e.has_class("initial") {
                context = ctx;
            }
        } else if e.has_class("option") {
            process_option(connection, scene_number, e, &context).await;
        } else if e.name == "button" {
            if let Some(&translated) = buttons.get(e.strip_tags().as_str()).as_ref() {
                e.children = vec![Node::Text(translated.clone().into())];
            }
            return WalkResult::Skip;
        }
        if e.has_class("subscene-rules") {
            if e.children.len() == 1
                && let Node::Element(e2) = &mut e.children[0]
                && e2.name == "p"
            {
                process_rules(connection, scene_number, &mut e2.children).await;
                return WalkResult::Skip;
            }
            e.for_each_mut_async(element_mut_async(async |e| {
                if e.has_class("col") && e.has_class("rules") {
                    process_rules(connection, scene_number, &mut e.children).await;
                }
                WalkResult::Skip
            }))
            .await
            .no_err()
            .no_brk();
            return WalkResult::Skip;
        }
        WalkResult::Continue
    }))
    .await
    .no_err()
    .no_brk();

    let mut h0n = String::new();
    h0.write_html(&mut h0n);
    if let Some(debug_story) = config.debug_story()
        && debug_story == scene_number
    {
        panicking::write("debug/new.html", &h0n);
    }
    story.html = h0n;
}

fn is_broken_html_entity(text: &str) -> bool {
    !text.split_once(';').is_some_and(|(left, _)| {
        NAMED_ENTITIES
            .iter()
            .any(|(entity, _)| left.as_bytes() == *entity)
    })
}
