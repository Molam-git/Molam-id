# Deployment notes - Production checklist (summary)

1. Use AWS S3 with Object Lock enabled + versioning.
2. Provision KMS or HSM (AWS KMS multi-Region keys recommended). NEVER use local signer in prod.
3. Set bucket lifecycle rules (hot -> IA -> Glacier).
4. Create IAM roles/policies: audit-writer (PutObject), batch-uploader (PutObject+PutRetention), auditors (GetObject+List).
5. Enable server-side encryption SSE-KMS.
6. Set up mTLS for Audit API endpoints; restrict access to pay_audit_admin, CTO, CFO roles.
7. Run integrity monitor daily: verify batch merkle roots and signatures.
8. Backup Postgres WAL; enable cross-region replication for S3.
9. Configure monitoring: metrics (ingestion, upload success, verification fail).
10. Pen test & compliance audit before go-live.
