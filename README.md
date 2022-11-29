# galzyr-translate

Fan project: automatic translation of the stories

Here are the translation(s):

* <a href="https://alexkazik.github.io/galzyr-translate/de-DE/" target="_blank">German</a>

The following is a guide to setup it yourself.

## requirements

* <a href="https://rustup.rs/" target="_blank">Rust</a>
* <a href="http://postgresql.org/" target="_blank">Postgres</a>
* <a href="https://www.deepl.com/" target="_blank">deepl API Key</a> (free or paid)

## database

There are (up to two) databases:

* meta: deepl api key, files downloaded
* translation: text, button, rules

Both dumps can be loaded into one database (which is the default) but if running
multiple translations at once, create one database per translation and one with meta
(or include it into one other database).

How to restore:

```shell
psql [conection/user/host] [meta-database-name] < database-meta.sql
psql [conection/user/host] [translation-database-name] < database-translation.sql
```

## deepl

Create an (or multiple) deepl API key(s) (free or paid) and add them to the deepl
table in the (meta) database.

Only one can be marked active, that is used for translations.

## config

Copy the example config file and fill it.

All tools can be called with `--config [file]` or `-c [file]` to specify a config file.
By default the config file in the root of this repo is used (the one you probably just configured).

The option is useful for running multiple translations.

Some options can be overwritten by arguments to the tools, see `cargo r -p [tool] -- --help`.

## local testing

For local testing I use the example config almost as is.
When on a unix(like) OS use link so that not all files have to be copied.

I run a [basic-http-server](https://github.com/brson/basic-http-server) and then go to [http://127.0.0.1:4000/web-de].
(After creating all files, see running.)

## running

All tools are designed to be run from the base of the repository.
The config has to be set up before.

```shell
cargo run --release -p [tool] [-- options...]
```

For downloading for example:

```shell
cargo run --release -p download
```

Or proceccing with a different config:

```shell
cargo run --release -p process -- --config my-config.toml
```

### 1. download

Run this tool to download all story book files.
This has to be done initially and whenever there is a new version.

### 2. process

This tool does walk over all stories and updates the database.
When the database contains a translation it will use it.
This also generates the localized version of all files.

In other words, it has to be run after download and after translation.

### 3. translate

This will push all texts from the database though deepl (and update the database).

### 4. process

(See 2., as it's the same tool.)

## other translations

The "buttons" and "rules" have to be manually translated.
Just look into the database into the tables `button` and `rule`.
Fill the `trandlated` column, for `rule`, the html structure has to be identical.

For `rule`: the columns `original_text` and `translated_text` are automatically updated
on each run of `process`, so do not bother to translate them, it's only for better reading.

## release

For a release I run this:

```shell
cargo r --release -p process -- \
  --public-url /galzyr-translate/de-DE/ \
  --target-dir ../galzyr-translate-web/de-DE/ \
  --copy-files
```

This does the the correct public url, uses a different directory than the testing (web-de) to
store the files and always copies it.

In order to actually upload it to github.com, lfs is required due to the filesize.

## development

This section can be skipped when you're only interested in running the tool.

### database

When developing this tool (required when changing sql queries), create a `.env` file containing

```
DATABASE_URL=postgres://[user]:[pass]@localhost/[database]
```

### check.sh

Requirement: working database with `.env`, see above.

This script does a few checks, to check if the code compiles and it updates the
cached sql definitions.

### other scripts

Both assume some paths + database, update them accordingly if required.

#### `update-database.sh`

Creates the sql dumps from an database which is minimally initialized.

#### `update-patch.sh`

Create the patches by comparing either the localized file (e.g. web-de/main.js) with the original (e.g. web-base/main.js).

After updating the patches, run `download` with `--only-patch` to apply (and test) them,
(without downloading again).

### result/panic

Since no error is recoverable I've decided to directly panic (at least for now).
Possible errors: Files/database not accessible, incorrect structure (also for both).
