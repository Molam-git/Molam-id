#!/usr/bin/env bash
# quick test script: publish a message to Kafka, wait, call verifier
set -eu
. infra/env.example || true
echo "Insert test event via kafka-console-producer..."
# For simplicity, write directly into Postgres using psql in this test (no kafka)
PG="psql $POSTGRES_DSN -t -q -X -v ON_ERROR_STOP=1 -c"
EVENT_ID=$(uuidgen)
$PG "INSERT INTO audit_events (id,event_type,module,payload,prev_hash,record_hash,signature,signer_key_id) 
VALUES ('$EVENT_ID','test.event','test', '{\"x\":\"y\"}', NULL, 'testhash', 'testsig', 'local')"
echo "Inserted event $EVENT_ID"
sleep 1
curl -s -X POST -H "Content-Type: application/json" -d "{\"event_id\":\"$EVENT_ID\"}" http://localhost:4100/api/audit/verify | jq .
