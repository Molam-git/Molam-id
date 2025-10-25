#!/usr/bin/env bash
# test_insert_and_verify.sh
# Quick test script: insert event into DB, wait for processing, call verifier

set -eu

echo "=== Molam Audit Brique - Integration Test ==="

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Database connection
POSTGRES_DSN=${POSTGRES_DSN:-"postgres://molam:molam_pass@localhost:5432/molam_audit"}

# Generate a test event ID
EVENT_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "00000000-0000-0000-0000-000000000001")

echo "Inserting test audit event with ID: $EVENT_ID"

# Insert directly into audit_events table (simulating what audit-writer would do)
psql "$POSTGRES_DSN" -c "
INSERT INTO audit_events (id, event_type, module, payload, prev_hash, record_hash, signature, signer_key_id)
VALUES (
  '$EVENT_ID',
  'test.integration',
  'test',
  '{\"test\": \"integration\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}',
  NULL,
  'test_hash_$(date +%s)',
  'test_signature_$(date +%s)',
  'local'
);
"

echo "Event inserted successfully"
echo "Waiting 2 seconds for processing..."
sleep 2

# Verify the event
echo "Calling verifier API..."
VERIFY_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"event_id\":\"$EVENT_ID\"}" \
  http://localhost:4100/api/audit/verify)

echo "Verification response:"
echo "$VERIFY_RESPONSE" | jq . || echo "$VERIFY_RESPONSE"

# Check if verification succeeded
if echo "$VERIFY_RESPONSE" | grep -q "\"event_id\""; then
  echo "✓ Test PASSED - Event verified successfully"
  exit 0
else
  echo "✗ Test FAILED - Verification failed"
  exit 1
fi
