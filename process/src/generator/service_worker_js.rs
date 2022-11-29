use crate::sync::PATH_SERVICE_WORKER;
use util::{Config, panicking};

pub(crate) fn create_service_worker_js(config: &Config) {
    let file = panicking::read_to_string(config.source_dir().join("service-worker-patched.js"));
    let mut sw_js = format!("fan_base_url_prefix = \"{}\";\n", config.public_url());
    sw_js.push_str(&file);
    panicking::write(config.target_dir().join(PATH_SERVICE_WORKER), &sw_js);
}
