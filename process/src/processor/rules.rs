use crate::db::db_rules;
use core::mem;
use html_parser::Node;
use html_parser::for_each::{ForEach, NoBrk, NoErr, WalkResult, element_mut};
use ownable::traits;
use sqlx::Postgres;
use sqlx::pool::PoolConnection;
use std::collections::VecDeque;
use util::panicking;

const NUM_SPLIT: &str = "💯";
const FIXED: &str = "💬";
const CARD: &str = "🃏";
const ICON: &str = "ℹ️";
const TAG: &str = "🏷";
const STAR: &str = "⭐";

pub(crate) async fn process_rules(
    connection: &mut PoolConnection<Postgres>,
    story_num: i64,
    children: &mut Vec<Node<'_>>,
) {
    for node in mem::replace(children, Vec::with_capacity(children.len())) {
        let mut n = node.to_borrowed();
        let mut replaced_nodes = VecDeque::new();
        if let Node::Element(element) = &mut n {
            element
                .for_each_mut(element_mut(|e| {
                    if e.has_class("notranslate")
                        || e.attributes
                            .get("translate")
                            .and_then(|x| x.as_ref())
                            .is_some_and(|a| a == "no")
                    {
                        'outer: {
                            for (class, text) in [
                                ("card", CARD),
                                ("icon", ICON),
                                ("tag", TAG),
                                ("value", STAR),
                            ] {
                                if e.has_class(class) {
                                    replaced_nodes.push_back(traits::IntoOwned::into_owned(
                                        mem::replace(
                                            &mut e.children,
                                            vec![Node::Text(text.into())],
                                        ),
                                    ));
                                    break 'outer;
                                }
                            }
                            replaced_nodes.push_back(traits::IntoOwned::into_owned(mem::replace(
                                &mut e.children,
                                vec![Node::Text(FIXED.into())],
                            )));
                        }
                    }
                    WalkResult::Continue
                }))
                .no_err()
                .no_brk();
        }

        let input = n.to_html();
        let input = input.as_bytes();
        let mut intermediate = Vec::with_capacity(input.len());
        let mut nums = Vec::with_capacity(4);
        let mut pos = 0;
        while pos < input.len() {
            if input[pos].is_ascii_digit() {
                let mut end = pos + 1;
                while end < input.len() && input[end].is_ascii_digit() {
                    end += 1;
                }
                nums.push(&input[pos..end]);
                intermediate.extend_from_slice(NUM_SPLIT.as_bytes());
                pos = end;
            } else {
                intermediate.push(input[pos]);
                pos += 1;
            }
        }

        // Safety: input is valis u8 and ascii digits have been replace with a utf-8 char, which is still valid utf-8
        #[allow(unsafe_code)]
        let intermediate = unsafe { String::from_utf8_unchecked(intermediate) };

        let translated = db_rules(connection, &intermediate, story_num).await;

        if let Some(translated) = translated {
            let mut output = Vec::with_capacity(translated.len() + nums.len() * 3);
            let mut nums = nums.into_iter();
            for elm in translated.split(NUM_SPLIT) {
                output.extend_from_slice(elm.as_bytes());
                if let Some(nx) = nums.next() {
                    output.extend_from_slice(nx);
                }
            }

            #[allow(unsafe_code)]
            let mut output =
                panicking::parse_dom(&unsafe { String::from_utf8_unchecked(output) }, "rule")
                    .into_owned();
            let mut output = output
                .children
                .drain(..)
                .next()
                .expect("there are no children");
            if let Node::Element(element) = &mut output {
                element.classes.insert("notranslate".into());
                element
                    .for_each_mut(element_mut(|e| {
                        if e.children.len() == 1 {
                            let ci = e.strip_tags();
                            if ci == CARD || ci == ICON || ci == TAG || ci == STAR || ci == FIXED {
                                let _ = mem::replace(
                                    &mut e.children,
                                    replaced_nodes.pop_front().expect("Queue too short"),
                                );
                            }
                        }

                        WalkResult::Continue
                    }))
                    .no_err()
                    .no_brk();
            }
            children.push(output);
        } else {
            children.push(node);
        }
    }
}
