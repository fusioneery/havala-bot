#!/bin/sh
set -e

# Fix volume mount permissions — Railway mounts volumes as root,
# but the app runs as non-root user "hawala" (uid 1001)
chown -R hawala:hawala /app/data

# Drop privileges and exec the CMD
exec gosu hawala "$@"
