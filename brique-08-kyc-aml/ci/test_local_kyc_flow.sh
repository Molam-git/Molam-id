#!/usr/bin/env bash
# test_local_kyc_flow.sh
# Test KYC flow: upload documents -> check status -> verify processing

set -eu

echo "=== Molam KYC/AML Brique - Integration Test ==="

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Check health
echo "Checking KYC API health..."
HEALTH=$(curl -s http://localhost:4201/health)
echo "Health response: $HEALTH"

# Generate test user ID
USER_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "test-user-12345")
echo "Test user ID: $USER_ID"

# Create temporary test images
TMP_DIR=$(mktemp -d)
echo "Creating test images in $TMP_DIR"

# Create dummy image files
echo "MOCK ID FRONT" > "$TMP_DIR/id_front.jpg"
echo "MOCK ID BACK" > "$TMP_DIR/id_back.jpg"
echo "MOCK SELFIE" > "$TMP_DIR/selfie.jpg"

# Submit KYC request
echo ""
echo "Submitting KYC request..."
KYC_RESPONSE=$(curl -s -X POST \
  -H "X-User-Id: $USER_ID" \
  -F "requested_level=P1" \
  -F "id_front=@$TMP_DIR/id_front.jpg" \
  -F "id_back=@$TMP_DIR/id_back.jpg" \
  -F "selfie=@$TMP_DIR/selfie.jpg" \
  http://localhost:4201/api/kyc/request)

echo "KYC Response:"
echo "$KYC_RESPONSE" | jq . || echo "$KYC_RESPONSE"

# Extract request ID
REQUEST_ID=$(echo "$KYC_RESPONSE" | jq -r '.request_id' 2>/dev/null || echo "")
if [ -z "$REQUEST_ID" ] || [ "$REQUEST_ID" = "null" ]; then
  echo "✗ Test FAILED - Could not create KYC request"
  rm -rf "$TMP_DIR"
  exit 1
fi

echo ""
echo "KYC Request ID: $REQUEST_ID"
echo "Waiting for processor to complete (15 seconds)..."
sleep 15

# Check status
echo ""
echo "Checking KYC status..."
STATUS_RESPONSE=$(curl -s http://localhost:4201/api/kyc/$REQUEST_ID/status)
echo "Status response:"
echo "$STATUS_RESPONSE" | jq . || echo "$STATUS_RESPONSE"

# Verify status is not pending
STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status' 2>/dev/null || echo "unknown")
echo ""
echo "Final status: $STATUS"

if [ "$STATUS" != "pending" ]; then
  echo "✓ Test PASSED - KYC request processed (status: $STATUS)"
  EXIT_CODE=0
else
  echo "✗ Test FAILED - KYC request still pending (processor may not be running)"
  EXIT_CODE=1
fi

# Cleanup
rm -rf "$TMP_DIR"
exit $EXIT_CODE
