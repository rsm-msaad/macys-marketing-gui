#!/usr/bin/env bash
# Usage logger — writes one JSONL event per student prompt and per tool call.
#
# Handles two hook events:
#   UserPromptSubmit  -> records the student's prompt (truncated to 2000 chars)
#   PreToolUse        -> records the tool name + a short summary (cmd / path / pattern)
#
# Does NOT record tool results (file contents, command stdout) to keep the log
# small and to avoid leaking secrets into the log if a student ever reads one.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/usage-log"
mkdir -p "$LOG_DIR"

input=$(cat)
session=$(echo "$input" | jq -r '.session_id // "unknown"')
# Sanitize session id for filename use
session_safe=$(echo "$session" | tr -c 'A-Za-z0-9_-' '_')
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
date_tag=$(date -u +%Y%m%d)
LOG_FILE="$LOG_DIR/session-${date_tag}-${session_safe}.jsonl"

tool=$(echo "$input" | jq -r '.tool_name // empty')
prompt=$(echo "$input" | jq -r '.prompt // empty')

if [ -n "$prompt" ]; then
  echo "$input" | jq -c --arg ts "$ts" --arg session "$session" \
    '{ts: $ts, session: $session, event: "prompt", text: (.prompt | .[0:2000])}' \
    >> "$LOG_FILE"
elif [ -n "$tool" ]; then
  echo "$input" | jq -c --arg ts "$ts" --arg session "$session" '
    .tool_input as $i |
    {
      ts: $ts,
      session: $session,
      event: "tool",
      tool: .tool_name,
      summary: (
        if   .tool_name == "Bash"     then (($i.command     // "") | .[0:500])
        elif .tool_name == "Write"    then  ($i.file_path   // "")
        elif .tool_name == "Edit"     then  ($i.file_path   // "")
        elif .tool_name == "Read"     then  ($i.file_path   // "")
        elif .tool_name == "Grep"     then (($i.pattern     // "") | .[0:200])
        elif .tool_name == "Glob"     then (($i.pattern     // "") | .[0:200])
        elif .tool_name == "WebFetch" then  ($i.url         // "")
        elif .tool_name == "WebSearch"then (($i.query       // "") | .[0:200])
        elif .tool_name == "Agent"    then (($i.description // "") | .[0:200])
        else "" end
      )
    }' >> "$LOG_FILE"
fi
