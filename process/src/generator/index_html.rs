use crate::sync::PATH_INDEX_HTML;
use util::{Config, IndexHtml, panicking};

pub(crate) fn generate_index_html(
    config: &Config,
    index_html: &IndexHtml,
    stories_json_len: usize,
) {
    // update stories length in index.html
    let (pre, post) = index_html
        .contents()
        .split_once("\ndata-story-size=\"fan-stories-length\"\n")
        .unwrap_or_else(|| panic!("Failed to parse index.html"));
    let filename = config.target_dir().join(PATH_INDEX_HTML);
    let mut index_out = panicking::File::create(&filename);
    index_out.write(pre);
    index_out.write_fmt(format_args!("\ndata-story-size=\"{stories_json_len}\"\n"));
    index_out.write(post);
}
