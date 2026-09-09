#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export TEST_ORG_ID="${TEST_ORG_ID:-$(cat /tmp/rag-e2e-org)}"
export TEST_WEBHOOK_SECRET="${TEST_WEBHOOK_SECRET:-test-rag-secret}"
export AI_WEBHOOK_SECRET="$TEST_WEBHOOK_SECRET"
node_modules/next/dist/bin/next dev -p 3105 >/tmp/prontoai24-next-rag.log 2>&1 &
server_pid=$!
cleanup() { kill "$server_pid" 2>/dev/null || true; }
trap cleanup EXIT
for attempt in $(seq 1 30); do
  if curl -fsS http://localhost:3105/login >/dev/null 2>&1; then break; fi
  sleep 1
done
TEST_BASE_URL=http://localhost:3105 npm run test:knowledge-rag
