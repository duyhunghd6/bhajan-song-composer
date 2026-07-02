#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/log"
mkdir -p "$LOG_DIR"

LOG_FILE="$(mktemp "$LOG_DIR/implement-$(date +%Y%m%d-%H%M%S)-XXXXXX.log")"
PROMPT=$(cat <<'PROMPT_EOF'
Use /agentic-gsafe-beads-mem , pick me the tasks list ready to implementing (bv --robot ....) ---> Then start to implementing using guidance of tdd .

After finish, remember to commit to git changes (do not push). Note that: Test report must be given carefully, any screenshot - test report after iteration must be added into iteration log / iteration report.
PROMPT_EOF
)

if ! command -v bd >/dev/null 2>&1; then
  echo "Error: bd command not found in PATH" >&2
  exit 127
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Error: claude command not found in PATH" >&2
  exit 127
fi

if ! command -v script >/dev/null 2>&1; then
  echo "Error: script command not found; cannot capture a terminal-accurate Claude session log" >&2
  exit 127
fi

notify_user() {
  local message="$1"

  printf '%s\n' "$message"
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display notification \"$message\" with title \"implement.sh\"" >/dev/null 2>&1 || true
  fi
}

has_open_beads() {
  local open_beads_json

  if ! open_beads_json="$(bd list --status open --format json --limit 1)"; then
    echo "Error: bd list failed while checking for open beads issues" >&2
    exit 1
  fi

  printf '%s' "$open_beads_json" | grep -q '"status": "open"'
}

run_claude_iteration() {
  export CLAUDE_IMPLEMENT_PROMPT="$PROMPT"

  # `script` allocates a pseudo-terminal so the log captures Claude's console output
  # as it appears on screen, including interactive formatting and ANSI sequences.
  if script --version >/dev/null 2>&1; then
    # util-linux script(1)
    script -q -a -e -c 'claude --dangerously-skip-permissions -p "$CLAUDE_IMPLEMENT_PROMPT"' "$LOG_FILE"
  else
    # BSD/macOS script(1)
    script -q -a "$LOG_FILE" env CLAUDE_IMPLEMENT_PROMPT="$CLAUDE_IMPLEMENT_PROMPT" claude --dangerously-skip-permissions -p "$CLAUDE_IMPLEMENT_PROMPT"
  fi
}

format_stats() {
  local elapsed_seconds="$1"
  local iterations="$2"
  local elapsed_minutes average_minutes

  elapsed_minutes=$(( (elapsed_seconds + 59) / 60 ))
  if [ "$iterations" -gt 0 ]; then
    average_minutes=$(( (elapsed_seconds + (iterations * 60) - 1) / (iterations * 60) ))
  else
    average_minutes=0
  fi

  printf 'time processing: %s minute(s), iteration finished: %s, minutes per iteration: %s' \
    "$elapsed_minutes" "$iterations" "$average_minutes"
}

printf 'Logging Claude sessions to: %s\n' "$LOG_FILE"

cd "$ROOT_DIR"

start_time="$(date +%s)"
iteration=0

while has_open_beads; do
  iteration=$((iteration + 1))
  printf 'Starting Claude iteration %s...\n' "$iteration"
  run_claude_iteration
  printf 'Finished Claude iteration %s. Checking for remaining open beads issues...\n' "$iteration"
done

end_time="$(date +%s)"
stats="$(format_stats "$((end_time - start_time))" "$iteration")"
notify_user "No open beads issues remain. Stopping implement.sh. $stats"
