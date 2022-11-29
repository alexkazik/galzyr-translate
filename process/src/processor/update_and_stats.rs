use html_parser::Node;
use html_parser::for_each::{ForEach, NoBrk, NoErr, WalkResult, element_mut};
use sqlx::Postgres;
use sqlx::pool::PoolConnection;
use std::collections::{BTreeMap, HashSet};
use util::{Config, panicking};

pub(crate) async fn update_and_stats(config: &Config, connection: &mut PoolConnection<Postgres>) {
    // return the text version of html, if the original is not null and the text is distinct from the previous text
    fn update_text(html: Option<&str>, text: Option<&str>) -> Option<String> {
        match html {
            None => None,
            Some(html) => {
                let mut new = panicking::parse_dom(html, "rule").children.remove(0);
                new.for_each_mut(element_mut(|e| {
                    if e.name == "strong" {
                        e.children.push(Node::Text("💪".into()));
                    }
                    WalkResult::Continue
                }))
                .no_err()
                .no_brk();

                let new = new.to_text();
                if text == Some(&new) {
                    None
                } else {
                    Some(new.into_owned())
                }
            }
        }
    }

    let mut rules_total = 0;
    let mut rules_translated = 0;
    let mut uses_total = 0;
    let mut uses_translated = 0;
    let mut stories_translated = HashSet::new();
    let mut stories_not_translated = HashSet::new();

    for rule in
        sqlx::query!("SELECT id, stories, uses, original, original_text, translated, translated_text FROM rule WHERE uses > 0")
            .fetch_all(&mut **connection)
            .await
            .unwrap_or_else(|err| panic!("Failed to update rule: {err}"))
    {
        let translated = rule.translated;
        let update_o = update_text(Some(&rule.original), rule.original_text.as_deref());
        let update_t = update_text(translated.as_deref(), rule.translated_text.as_deref());
        if update_o.is_some() || update_t.is_some() {
            sqlx::query!(
                "UPDATE rule SET original_text=COALESCE($2,original_text), translated_text=COALESCE($3,translated_text) WHERE id=$1",
                rule.id,
                update_o,
                update_t,
            )
            .fetch_all(&mut **connection)
            .await
            .unwrap_or_else(|err| panic!("Failed to update rule: {err}"));
        }
        rules_total += 1;
        uses_total += rule.uses;
        if translated.is_some() {
            rules_translated += 1;
            uses_translated += rule.uses;
            stories_translated.extend(rule.stories);
        } else {
            stories_not_translated.extend(rule.stories);
        }
    }

    eprintln!(
        "RULES: {}/{} rules are translated {}%",
        rules_translated,
        rules_total,
        100 * rules_translated / rules_total
    );
    eprintln!(
        "RULES: {}/{} uses are translated {}%",
        uses_translated,
        uses_total,
        100 * uses_translated / uses_total
    );
    let mut stories_total = stories_translated.clone();
    stories_total.extend(stories_not_translated.iter().copied());
    let stories_fully_translated = stories_translated
        .difference(&stories_not_translated)
        .count();
    eprintln!(
        "RULES: rules of {}/{} stories are completely translated {}%",
        stories_fully_translated,
        stories_total.len(),
        100 * stories_fully_translated / stories_total.len()
    );

    let stats = sqlx::query!(
        r#"
SELECT translated IS NOT NULL as "is_translated!", SUM(LENGTH(original)) AS "length!", COUNT(*) AS "count!"
FROM text
WHERE (first_story <= $1 OR ($2 AND first_story >= $3)) AND NOT (stories <@ $4)
GROUP BY translated IS NOT NULL
        "#,
        config.max_story(),
        config.translate_demo(),
        Config::TEXT_ID_DEMO_START,
        config.exclude_stories(),
    )
    .fetch_all(&mut **connection)
    .await
    .unwrap_or_else(|err| panic!("Failed to update text: {err}"))
    .into_iter()
    .map(|row| (row.is_translated, [row.length, row.count]))
    .collect::<BTreeMap<_, _>>();

    for (method, index) in [("length", 0), ("count", 1)] {
        let not_translated = stats.get(&false).map_or(0, |s| s[index]);
        let is_translated = stats.get(&true).map_or(0, |s| s[index]);

        if is_translated == 0 {
            eprintln!("STORIES: translated -% by {method}");
        } else {
            eprintln!(
                "STORIES: translated {}% by {method}",
                is_translated * 100 / (not_translated + is_translated)
            );
        }
    }
}
