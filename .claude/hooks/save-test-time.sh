#!/usr/bin/env bash
# PostToolUse/Bash: if the command ran pytest, record the timestamp.
# State is project-local (.claude/.last-test-time, gitignored) so running
# tests in another project does not affect the stale-test reminder here.
set -euo pipefail

cmd=$(jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0

if echo "$cmd" | grep -qE '(^|[[:space:];&|])pytest([[:space:]]|$)'; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
  date +%s > "$PROJECT_DIR/.last-test-time"
fi
