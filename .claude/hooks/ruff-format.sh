#!/usr/bin/env bash
# PostToolUse/Write|Edit: auto-format Python files with ruff.
# Uses `uvx` so it works even before the student has added ruff as a dev dep.
set -euo pipefail

file=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -z "$file" ] && exit 0
[[ "$file" == *.py ]] || exit 0
[ -f "$file" ] || exit 0

uvx --quiet ruff format "$file" >/dev/null 2>&1 || true
