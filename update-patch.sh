#!/bin/sh

if test $# -ne 2
then
  echo "Usage: $0 <source-dir> <target-dir>"
  echo "Example: $0 web-base web-de"
  exit 1
fi

tail -n +5 < "$2"/js/main.js > "$1"/js/main-patched.js
tail -n +2 < "$2"/service-worker.js > "$1"/service-worker-patched.js

diff -u "$1"/js/main.js "$1"/js/main-patched.js > download/src/main.js.patch
diff -u "$1"/service-worker.js "$1"/service-worker-patched.js > download/src/service-worker.js.patch
