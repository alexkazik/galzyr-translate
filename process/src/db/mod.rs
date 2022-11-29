pub(crate) use crate::db::rules::db_rules;
pub(crate) use crate::db::text::db_text;
use core::num::Wrapping;
use sqlx::postgres::{PgAdvisoryLock, PgAdvisoryLockKey};

mod rules;
mod text;

#[inline]
fn lock_from_original(s: &str) -> PgAdvisoryLock {
    // it does not matter that this is not crypographically safe
    // because it is only designed to make sure that not two
    // identical values can be inserted at the same time
    PgAdvisoryLock::with_key(PgAdvisoryLockKey::BigInt(
        s.as_bytes()
            .as_chunks()
            .0
            .iter()
            .map(|b| Wrapping(i64::from_ne_bytes(*b)))
            .sum::<Wrapping<i64>>()
            .0,
    ))
}
