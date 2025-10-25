#!/bin/bash
# Cleanup script for test data

echo "Cleaning up test data from molam database..."

# Delete test users and cascade to related tables
docker compose exec -T db psql -U molam -d molam <<EOF
-- Delete test users (cascades to sessions, roles, attributes, etc.)
DELETE FROM molam_users
WHERE email LIKE '%test%'
   OR email LIKE '%@test.%'
   OR email LIKE '%@example.%'
   OR email LIKE '%@molam.sn'
   OR molam_id LIKE '%TEST%';

-- Clean up orphaned records
DELETE FROM molam_sessions WHERE created_at < NOW() - INTERVAL '1 day';
DELETE FROM molam_authz_cache WHERE created_at < NOW() - INTERVAL '1 day';
DELETE FROM molam_authz_audit WHERE created_at < NOW() - INTERVAL '1 day';
DELETE FROM molam_kyc_requests WHERE created_at < NOW() - INTERVAL '1 day';

-- Show counts
SELECT 'Users remaining:' as info, COUNT(*) as count FROM molam_users
UNION ALL
SELECT 'Sessions remaining:', COUNT(*) FROM molam_sessions;
EOF

echo "Cleaning up audit database..."
docker exec -i infra-postgres-audit-1 psql -U molam -d molam_audit <<EOF
-- Clean test audit events
DELETE FROM audit_events WHERE event_type LIKE '%test%';
DELETE FROM audit_batches WHERE created_at < NOW() - INTERVAL '1 day';

SELECT 'Audit events remaining:' as info, COUNT(*) as count FROM audit_events;
EOF

echo "Cleanup complete!"
