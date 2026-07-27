#!/usr/bin/env sh
# Frees the dev ports before `npm run dev` starts.
#
# Why this is needed: Ctrl+C signals the shell's foreground process group, but the
# chain here is npm -> sh -> concurrently -> npm -> sh -> ts-node-dev/vite -> node.
# npm does not reliably forward the signal to grandchildren, so `concurrently` and
# everything under it gets orphaned (reparented to PID 1) and keeps running — still
# holding 4000 and 5173. `ts-node-dev --respawn` compounds it by design.
#
# Rather than fight the signal chain, just reclaim the ports on the way in.

for port in 4000 5173; do
  pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "[free-dev-ports] port $port held by pid(s): $pids — terminating"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null
  fi
done

# Give the sockets a moment to close before the servers try to bind.
sleep 1

for port in 4000 5173; do
  if lsof -ti tcp:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[free-dev-ports] port $port did not release to SIGTERM — sending SIGKILL"
    lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null | while read -r pid; do kill -9 "$pid" 2>/dev/null; done
  fi
done

exit 0
