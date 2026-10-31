#!/usr/bin/env bash
# Usage: scripts/electron-lock.sh <role> <cmd...>
# One Electron instance at a time across all agents. Refuses if the lock is held by a live PID
# (set ALONGSIDE_LOCK_WAIT=<seconds> to wait instead). Kills the command (whole process group)
# after ALONGSIDE_LOCK_MAX_SECONDS (default 300) and exits 124.
set -u
# Agent/test runs only: the (unauthenticated) debug HTTP server is opt-in via ALONGSIDE_DEBUG=1 (see src/main/index.ts).
export ALONGSIDE_DEBUG=1
LOCK=/tmp/alongside-electron.lock
MAX=${ALONGSIDE_LOCK_MAX_SECONDS:-300}
WAIT=${ALONGSIDE_LOCK_WAIT:-0}

if [ $# -lt 2 ]; then
  echo "usage: $0 <role> <cmd...>" >&2
  exit 2
fi
ROLE=$1
shift

owner_alive() {
  local pid
  pid=$(sed -n 2p "$LOCK/owner" 2>/dev/null || true)
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

acquire() {
  local waited=0
  while true; do
    if mkdir "$LOCK" 2>/dev/null; then
      printf '%s\n%s\n' "$ROLE" "$$" > "$LOCK/owner"
      return 0
    fi
    # The owner file is written right after mkdir; give a racing holder a moment before judging.
    if [ ! -s "$LOCK/owner" ]; then sleep 0.3; fi
    if [ -s "$LOCK/owner" ] && ! owner_alive; then
      echo "[electron-lock] removing stale lock (role $(sed -n 1p "$LOCK/owner"), dead pid $(sed -n 2p "$LOCK/owner"))" >&2
      rm -rf "$LOCK"
      continue
    fi
    if [ "$waited" -ge "$WAIT" ]; then
      echo "[electron-lock] held by role $(sed -n 1p "$LOCK/owner" 2>/dev/null) (pid $(sed -n 2p "$LOCK/owner" 2>/dev/null)); retry later or use ALONGSIDE_HEADLESS=1" >&2
      return 1
    fi
    sleep 2
    waited=$((waited + 2))
  done
}

acquire || exit 75

CHILD=""
KILLER=""
cleanup() {
  trap - EXIT INT TERM
  if [ -n "$KILLER" ]; then
    local kids
    kids=$(pgrep -P "$KILLER" 2>/dev/null || true)
    kill "$KILLER" 2>/dev/null || true
    [ -n "$kids" ] && kill $kids 2>/dev/null || true
    wait "$KILLER" 2>/dev/null || true
  fi
  if [ -n "$CHILD" ] && kill -0 "$CHILD" 2>/dev/null; then
    kill -TERM -- "-$CHILD" 2>/dev/null || kill -TERM "$CHILD" 2>/dev/null || true
    sleep 1
    kill -KILL -- "-$CHILD" 2>/dev/null || true
  fi
  rm -rf "$LOCK"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Own process group so the whole Electron tree can be killed together (macOS has no `timeout`).
perl -e 'setpgrp(0, 0); exec @ARGV or die "exec failed: $!"' -- "$@" &
CHILD=$!

(
  sleep "$MAX"
  echo "[electron-lock] ${MAX}s limit reached, killing role $ROLE command" >&2
  touch "$LOCK/timed-out" 2>/dev/null
  kill -TERM -- "-$CHILD" 2>/dev/null
  sleep 2
  kill -KILL -- "-$CHILD" 2>/dev/null
) &
KILLER=$!

wait "$CHILD"
STATUS=$?
if [ -e "$LOCK/timed-out" ]; then STATUS=124; fi
exit "$STATUS"
