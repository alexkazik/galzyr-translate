use crate::sync::PATH_MAIN_JS;
use util::{Config, panicking};

pub(crate) fn generate_main_js(config: &Config) {
    let mut main_js = format!(
        "fan_base_url_prefix = \"{}\";\nfan_language = \"{}\"\nfan_app = {:?}\nfan_language_name = \"{}\"\n",
        config.public_url(),
        config.language(),
        cfg!(feature = "app"),
        config.language_name(),
    );
    main_js.push_str(
        panicking::read_to_string(config.source_dir().join("js/main-patched.js")).as_str(),
    );
    panicking::write(config.target_dir().join(PATH_MAIN_JS), &main_js);
}
