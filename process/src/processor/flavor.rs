use crate::db::db_text;
use crate::paragraph::ParagraphWriter;
use core::fmt::Write;
use html_escape::encode_text;
use html_parser::for_each::{ForEach, NoBrk, NoErr, WalkResult, element_mut};
use html_parser::{Element, ElementVariant, Node, VecMap, VecSet};
use sqlx::Postgres;
use sqlx::pool::PoolConnection;
use util::panicking;

pub(crate) async fn process_flavor(
    connection: &mut PoolConnection<Postgres>,
    story_num: i64,
    element: &mut Element<'_>,
) -> String {
    let mut paragraphs = ParagraphWriter::new();
    let mut vec_is_cap = Vec::new();

    for child_node in &mut element.children {
        let Node::Element(cild_element) = child_node else {
            panic!("not elm {}", child_node.to_html())
        };
        assert_eq!(cild_element.name, "p", "not p {}", cild_element.to_html());

        let mut is_cap = false;

        for node in &cild_element.children {
            match node {
                Node::Text(t) => {
                    paragraphs.push_str(t);
                }
                Node::Element(e) if e.name == "span" => {
                    if e.has_class("drop-cap") {
                        for t in node.into_iter().filter_map(|n| n.text()) {
                            paragraphs.push_str(t);
                        }
                        is_cap = true;
                    } else if e.has_class("quote") {
                        paragraphs.push('"');
                    } else if e.has_class("encyclopedia") {
                        let _ = write!(
                            paragraphs,
                            "<e e=\"{}\">{}</e>",
                            e.attributes
                                .get("data-entry")
                                .unwrap_or_else(|| panic!(
                                    "Failed to get data-entry of encyclopedia"
                                ))
                                .as_ref()
                                .unwrap_or_else(|| panic!(
                                    "Attribute data-entry of encyclopedia is empty"
                                ))
                                .0,
                            &e.children[0]
                                .text()
                                .unwrap_or_else(|| panic!("span encyclopedia has no children"))
                                .0
                        );
                    } else {
                        only_text(&mut paragraphs, e);
                    }
                }
                Node::Element(e) if e.name == "br" || e.name == "img" => {
                    paragraphs.push_str(&e.to_html());
                }
                _ => panic!("not txt|span {}", node.to_html()),
            }
        }

        paragraphs.newline();

        vec_is_cap.push(is_cap);
    }

    let paragraphs = paragraphs.finish();

    let translated = db_text(connection, &paragraphs, story_num, None).await;

    if let Some(translated) = translated {
        let vec_translated = translated.split('\n').collect::<Vec<&str>>();
        assert_eq!(
            vec_translated.len(),
            vec_is_cap.len(),
            "translation paragraphs count mismatch for original {paragraphs:?} without context"
        );

        for (c, (mut translated, is_cap)) in element
            .children
            .iter_mut()
            .zip(vec_translated.into_iter().zip(vec_is_cap))
        {
            let Node::Element(ce) = c else {
                panic!("no elm")
            };

            let mut new = Vec::new();
            if is_cap {
                let first = remove_first_char(&mut translated)
                    .unwrap_or_else(|| panic!("Can't get first char of captioned translation"));

                let dc = if first == '"' {
                    new.push(Node::Element(Element {
                        id: None,
                        name: "span".into(),
                        variant: ElementVariant::Normal,
                        attributes: VecMap::default(),
                        classes: VecSet::from_iter(["quote".into()]),
                        children: vec![Node::Text("\"".into())],
                    }));
                    remove_first_char(&mut translated)
                        .unwrap_or_else(|| panic!("Can't get first char of captioned translation"))
                } else {
                    first
                };
                new.push(Node::Element(Element {
                    id: None,
                    name: "span".into(),
                    variant: ElementVariant::Normal,
                    attributes: VecMap::default(),
                    classes: VecSet::from_iter(["drop-cap".into()]),
                    children: vec![Node::Text(dc.to_string().into())],
                }));
            }
            let mut translated = panicking::parse_dom(translated, "flavor").into_owned();
            translated
                .for_each_mut(element_mut(|e| {
                    if e.name == "e" {
                        e.name = "span".into();
                        e.classes.insert("encyclopedia".into());
                        let de = e.attributes.remove("e").expect("attribute should be there");
                        e.attributes.insert("data-entry".into(), de);
                    }
                    WalkResult::Continue
                }))
                .no_err()
                .no_brk();
            new.append(&mut translated.children);

            ce.children = new;
            ce.classes.insert("notranslate".into());
        }
    }

    paragraphs
}

fn only_text(txt: &mut ParagraphWriter, parent: &Element) {
    let mut no_space = true;
    for child in &parent.children {
        match child {
            Node::Text(t) => {
                // decode+encode ensures that only <, > and & are encoded, which is requires for deepl.com xml compatibility
                txt.push_str(&encode_text(&t.decode()));
            }
            Node::Element(e) => only_text(txt, e),
            Node::Comment(_) => {}
        }
        if no_space {
            no_space = false;
        }
    }
}

fn remove_first_char(s: &mut &str) -> Option<char> {
    let first_char = s.chars().next()?;
    *s = &s[first_char.len_utf8()..];
    Some(first_char)
}
