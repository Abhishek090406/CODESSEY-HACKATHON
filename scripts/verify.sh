#!/usr/bin/env bash
set -euo pipefail

# Verify script for UC-03
# Verifies /health returns 200 and runs test suite

TARGET_URL="${1:-http://localhost:3000}"

echo "========================================="
echo " Verifying UC-03 Connection Health SaaS"
echo " Target: ${TARGET_URL}"
echo "========================================="

echo "Step 1: Check /health endpoint..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${TARGET_URL}/health")
if [ "${HTTP_STATUS}" -ne 200 ]; then
  echo "FAIL: Expected /health to return 200, got ${HTTP_STATUS}"
  exit 1
fi
echo "SUCCESS: /health returned 200 OK."

echo "Step 2: Run automated test suite..."
npm test

echo "All verification checks passed!"
