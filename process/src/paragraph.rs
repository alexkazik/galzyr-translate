use core::fmt;

pub(crate) struct ParagraphWriter {
    inner: String,
    first: bool,
}

impl ParagraphWriter {
    pub(crate) fn new() -> Self {
        Self {
            inner: String::new(),
            first: true,
        }
    }

    pub(crate) fn push_str(&mut self, mut s: &str) {
        if self.first {
            s = s.trim_start_matches(' ');
        }
        if s.is_empty() {
            return;
        }
        self.first = false;
        for (pos, s) in s.split('\n').enumerate() {
            if pos > 0 {
                self.inner.push(' ');
            }
            self.inner.push_str(s);
        }
    }

    pub(crate) fn push(&mut self, mut c: char) {
        if c == '\n' {
            c = ' ';
        }
        if self.first && c == ' ' {
            return;
        }
        self.inner.push(c);
        self.first = false;
    }

    pub(crate) fn newline(&mut self) {
        while self.inner.ends_with(' ') {
            self.inner.pop();
        }
        self.inner.push('\n');
        self.first = true;
    }

    pub(crate) fn finish(mut self) -> String {
        assert!(
            self.first,
            "ParagraphWriter::finish called in the middle of a line"
        );
        self.inner.pop();
        self.inner
    }
}

impl fmt::Write for ParagraphWriter {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        self.push_str(s);
        Ok(())
    }
}
