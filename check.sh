#!/bin/sh

set -e # exit on error
set -x # show commands executed

cargo build --release

cargo clippy -- -D warnings

test -f .env && cargo sqlx prepare --workspace

if rustup toolchain list -q | grep "^nightly-" > /dev/null 2>&1
then
  TOOLCHAIN=+nightly
else
  echo "Formatting is usually done with nightly, which is not installed (default is used, will lead to some warnings)"
fi
for width in 500 400 300 200 150 130 110
do
  cargo $TOOLCHAIN fmt --all -- --config max_width=$width
done
cargo $TOOLCHAIN fmt --all

if command -v typos >/dev/null 2>&1
then
  typos
else
  echo "typos check not run, see https://github.com/crate-ci/typos if interested"
fi
