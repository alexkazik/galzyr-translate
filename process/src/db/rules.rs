use crate::db::lock_from_original;
use sqlx::Postgres;
use sqlx::pool::PoolConnection;

pub(crate) async fn db_rules(
    connection: &mut PoolConnection<Postgres>,
    original: &str,
    story_num: i64,
) -> Option<String> {
    let lock = lock_from_original(original);
    let mut guard = lock
        .acquire(&mut *connection)
        .await
        .unwrap_or_else(|err| panic!("Failed to acquire lock: {err}"));

    if let Some(x) = sqlx::query!(
        "UPDATE rule SET uses=uses+1, stories = array(select distinct e from unnest( array_append(stories, $2)) as a(e) order by e) WHERE original = $1 RETURNING translated",
        original,
        story_num,
    )
    .fetch_optional(&mut *guard)
    .await
    .unwrap_or_else(|err| panic!("Failed to update rule: {err}"))
    {
        x.translated
    } else {
        let story_num_array = [story_num];
        sqlx::query!("INSERT INTO rule (stories, original, uses) VALUES ($1, $2, 1)", story_num_array.as_slice(), original)
            .execute(&mut *guard)
            .await
            .unwrap_or_else(|err| panic!("Failed to insert into rule: {err}"));

        None
    }
}
