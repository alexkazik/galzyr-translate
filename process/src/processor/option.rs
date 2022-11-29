use crate::db::db_text;
use core::mem;
use html_parser::{Element, Node};
use sqlx::Postgres;
use sqlx::pool::PoolConnection;
use util::panicking;

pub(crate) async fn process_option(
    connection: &mut PoolConnection<Postgres>,
    story_num: i64,
    element: &mut Element<'_>,
    context: &str,
) {
    if let Some(first) = element.children.first_mut()
        && let Node::Element(e) = first
    {
        assert_eq!(&e.name, "h2");

        let mut verb = None;
        let mut text = String::new();
        let mut other = Vec::new();

        for child_node in mem::take(&mut e.children) {
            match child_node {
                Node::Text(t) => {
                    text.push_str(&t);
                }
                Node::Element(mut e) if e.has_class("verb") => {
                    let Node::Text(v) = e.children.remove(0) else {
                        panic!("not text")
                    };
                    let v = v.0.into_owned();
                    text.push_str(&v);
                    verb = Some(v);
                }
                x => other.push(x),
            }
        }

        // trim ws from the end, truncate the string to this
        text.truncate(text.trim_end().len());

        let translated = db_text(connection, &text, story_num, Some(context)).await;
        let is_translated = translated.is_some();
        let translated = translated.unwrap_or_else(|| text.clone());

        let mut translated = panicking::parse_dom(&translated, "option").into_owned();

        e.children.append(&mut translated.children);
        if !other.is_empty() {
            e.children.push(Node::Text(" ".into()));
            e.children.append(&mut other);
        }
        if is_translated {
            if let Some(verb) = verb {
                e.children.push(Node::Text(
                    format!(" <span class=\"fan-verb-tag notranslate\">{verb}</span>").into(),
                ));
            }
            e.children.push(Node::Text(
                " <small class=\"notranslate\" style=\"color: grey\">(".into(),
            ));
            e.children.push(Node::Text(text.into()));
            e.children.push(Node::Text(")</small>".into()));
            e.classes.insert("notranslate".into());
        }
    }
}
