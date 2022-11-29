use crate::sync::PATH_STYLE_CSS;
use util::{Config, panicking};

pub(crate) fn generate_style_css(config: &Config) {
    panicking::copy(
        config.source_dir().join("css/style-extended.css"),
        config.target_dir().join(PATH_STYLE_CSS),
    );
}
