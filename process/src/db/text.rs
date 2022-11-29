use crate::db::lock_from_original;
use sqlx::Postgres;
use sqlx::pool::PoolConnection;

pub(crate) async fn db_text(
    connection: &mut PoolConnection<Postgres>,
    original: &str,
    story_num: i64,
    context: Option<&str>,
) -> Option<String> {
    let original = original.trim();

    let lock = lock_from_original(original);
    let mut guard = lock
        .acquire(&mut *connection)
        .await
        .unwrap_or_else(|err| panic!("Failed to acquire lock: {err}"));

    sqlx::query_scalar!(
        r#"
INSERT INTO text (stories, original, context, uses)
VALUES (ARRAY[$1]::bigint[], $2, $3, 1)
ON CONFLICT (context, original) DO UPDATE SET
    uses=text.uses+1,
    stories=ARRAY(SELECT DISTINCT e FROM unnest(array_append(text.stories, $1)) AS a(e) ORDER BY e)
RETURNING translated
        "#,
        story_num,
        original,
        context,
    )
    .fetch_one(&mut *guard)
    .await
    .unwrap_or_else(|err| panic!("Failed to insert/update text: {err}"))
}
