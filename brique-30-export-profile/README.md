# Brique 30: Export Profil (GDPR, JSON/PDF signé)

**GDPR-compliant data export system with JSON (signed) and PDF (branded) formats for all Molam users.**

## Overview

This brique provides a comprehensive data export infrastructure that allows:
- External users (clients, merchants, partner agents) to export their personal data
- Internal users (Molam employees) to request data exports for compliance purposes
- Two export formats: JSON (with HMAC signature) and PDF (branded, human-readable)
- Asynchronous processing to avoid blocking operations
- Temporary S3 storage with automatic expiration and cleanup
- Complete audit trail for GDPR/CCPA/BCEAO compliance

## Features

### 1. Data Export
- **Profile data**: User information, preferences, language, currency
- **Badges**: All earned badges across subsidiaries
- **Activity history**: Last 90 days, anonymized counterparties
- **Media assets**: Uploaded photos, avatars, banners
- **Privacy settings**: Current privacy configuration
- **Connected devices**: List of trusted devices
- **Transactions** (optional): Payment/order history from Pay/Eats/Shop modules
- **KYC documents** (optional): Identity verification documents

### 2. Export Formats

**JSON** (Machine-readable):
- Complete data export in JSON format
- HMAC-SHA256 signature for integrity verification
- Includes metadata (generated_at, export_version, compliance)
- Suitable for data portability to other services

**PDF** (Human-readable):
- Branded Molam document with logo
- Clean, Apple-like layout
- Watermark: "Molam Confidential - GDPR Export"
- Includes all key information in readable format
- Suitable for printing or archiving

### 3. Processing Pipeline
1. User requests export via API
2. Request is queued with status `pending`
3. Worker picks up request and sets status to `processing`
4. Worker gathers data from all relevant tables
5. Worker generates JSON or PDF file
6. File is uploaded to S3 with encryption
7. Checksum (SHA256) is calculated for integrity
8. Status is updated to `ready` with presigned download URL
9. User receives download URL (valid for 1 hour)
10. File automatically expires after 7 days
11. Cleanup job deletes expired files from S3

### 4. Security & Compliance

- **HMAC signature** for JSON exports (guarantees integrity)
- **PDF watermark**: "Molam Confidential" with timestamp
- **Automatic expiration**: 7 days (configurable)
- **Audit logging**: Every export request, download, and deletion is logged
- **Rate limiting**: Max 5 export requests per hour per user
- **RBAC**: Users can only export their own data (unless admin/HR)
- **Encryption**: S3 server-side encryption (AES256)
- **SIRA integration**: Export events sent to SIRA for "data-awareness" scoring

### 5. Observability & Monitoring

**Prometheus Metrics**:
- `exports_requested_total`: Total export requests
- `exports_completed_total`: Successfully completed exports
- `exports_failed_total`: Failed exports
- `exports_ready_total`: Exports ready for download
- `exports_downloaded_total`: Total downloads
- `exports_expired_total`: Expired exports
- `export_processing_duration_seconds`: Time to generate export

**Alerts**:
- Alert if backlog > 50 pending exports
- Alert if failure rate > 10% in last hour
- Alert if S3 upload errors

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Applications                 │
│  (Web, iOS, Android, HarmonyOS, Desktop, Admin)        │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP API
                   │
┌──────────────────▼──────────────────────────────────────┐
│                    Export API (Express)                 │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Routes (RBAC + Rate Limiting)                    │ │
│  │  - POST /api/profile/export                       │ │
│  │  - GET /api/profile/export/:id                    │ │
│  │  - GET /api/profile/export/:id/download           │ │
│  │  - GET /api/profile/exports                       │ │
│  └───────────────────┬───────────────────────────────┘ │
│                      │                                   │
│  ┌───────────────────▼───────────────────────────────┐ │
│  │  ExportService                                    │ │
│  │  - requestExport()                                │ │
│  │  - getDownloadUrl()                               │ │
│  │  - getExportStatus()                              │ │
│  └───────────────────┬───────────────────────────────┘ │
└────────────────────┬─┴───────────────────────────────────┘
                     │
        ┌────────────▼───┐
        │   PostgreSQL   │
        │  (Export Queue)│
        └────────────┬───┘
                     │
              ┌──────▼──────┐
              │Export Worker│
              │(Async Poll) │
              └──────┬──────┘
                     │
        ┌────────────▼───────────────┐
        │  ExportService             │
        │  - gatherProfileData()     │
        │  - generateJSON() + HMAC   │
        │  - generatePDF() + Brand   │
        │  - uploadToS3() + Checksum │
        └────────────┬───────────────┘
                     │
              ┌──────▼──────┐
              │   AWS S3    │
              │(Encrypted)  │
              └─────────────┘
```

## Database Schema

### Tables

1. **molam_profile_exports**
   - Tracks all export requests
   - Status: pending → processing → ready/failed/expired
   - Storage: S3 key, size, checksum, signature
   - Lifecycle: requested_at, completed_at, expires_at
   - Audit: downloaded_count, last_downloaded_at

2. **molam_export_sections**
   - Available sections for export (for UI selection)
   - Sections: profile, badges, activity, media, privacy, devices, transactions, KYC
   - Each section has sensitivity level and module requirements

3. **molam_export_audit**
   - Complete audit trail for all export operations
   - Events: requested, processing_started, completed, downloaded, failed, expired, deleted
   - Context: actor_id, IP address, user agent
   - GDPR compliance: retention policy per event

### Key Functions

```sql
-- Request new export (with rate limiting)
request_profile_export(
  p_user_id UUID,
  p_format VARCHAR,
  p_sections JSONB,
  p_requested_by UUID,
  p_ip_address INET,
  p_user_agent TEXT
) RETURNS export_id

-- Get export status
get_export_status(p_export_id BIGINT, p_user_id UUID)
→ export_id, format, status, requested_at, completed_at, expires_at, ...

-- Mark as downloaded (increment counter)
mark_export_downloaded(p_export_id BIGINT, p_user_id UUID) RETURNS BOOLEAN

-- Cleanup expired exports (daily cron job)
cleanup_expired_exports() RETURNS deleted_count

-- Get pending exports for worker
get_pending_exports(p_limit INTEGER) RETURNS export_id, user_id, format, sections

-- Update export status
update_export_status(
  p_export_id BIGINT,
  p_status VARCHAR,
  p_storage_key TEXT,
  p_storage_size BIGINT,
  p_checksum TEXT,
  p_signature TEXT,
  p_error TEXT
) RETURNS BOOLEAN

-- Get statistics
get_export_statistics(p_user_id UUID, p_days INTEGER)
→ total_exports, ready_exports, failed_exports, json_exports, pdf_exports, ...
```

### Views

- **v_active_exports**: All active exports (pending, processing, ready)
- **v_export_stats_by_user**: Aggregated statistics per user

### Triggers

- **trg_export_audit**: Auto-log all export events
- **trg_export_expiration**: Auto-set expiration date (7 days)

### Row-Level Security (RLS)

- Users can only SELECT/INSERT their own exports
- Admin/HR can SELECT all exports for compliance purposes

## API Routes

### Public Routes (Authenticated Users)

```typescript
POST   /api/profile/export              // Request new export
GET    /api/profile/export/:exportId    // Get export status
GET    /api/profile/export/:exportId/download  // Get download URL (presigned)
GET    /api/profile/exports             // List user's exports
GET    /api/profile/export/stats        // Get user's export statistics
```

### Admin Routes (RBAC Required)

```typescript
POST   /api/admin/profile/export/:userId        // Request export for another user (HR/Admin)
GET    /api/admin/profile/export/stats          // Get global export statistics
POST   /api/admin/profile/export/cleanup        // Manually trigger cleanup (Maintenance)
```

### Rate Limiting

- **Public**: 5 export requests per hour per user
- **Admin**: No rate limiting (trusted internal use)

### Request/Response Examples

**Request export**:
```bash
POST /api/profile/export
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "format": "json",
  "include_sections": ["profile", "badges", "activity", "media", "privacy"]
}
```

Response (202 Accepted):
```json
{
  "export_id": 12345,
  "status": "pending",
  "message": "Export request accepted. Processing will complete in a few minutes.",
  "estimated_time": "2-5 minutes"
}
```

**Get export status**:
```bash
GET /api/profile/export/12345
Authorization: Bearer <jwt-token>
```

Response:
```json
{
  "export_id": 12345,
  "format": "json",
  "status": "ready",
  "requested_at": "2025-10-29T10:00:00Z",
  "completed_at": "2025-10-29T10:02:34Z",
  "expires_at": "2025-11-05T10:02:34Z",
  "storage_size": 45678,
  "downloaded_count": 0,
  "error_message": null
}
```

**Get download URL**:
```bash
GET /api/profile/export/12345/download
Authorization: Bearer <jwt-token>
```

Response:
```json
{
  "download_url": "https://molam-exports.s3.amazonaws.com/exports/user-123/12345.json?X-Amz-Signature=...",
  "expires_at": "2025-11-05T10:02:34Z",
  "format": "json",
  "size_bytes": 45678,
  "message": "Download URL is valid for 1 hour"
}
```

## Export Service

### Initialization

```typescript
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { ExportService } from './services/export/export.service';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1'
});

const exportService = new ExportService(pool, s3Client, {
  exportSecret: process.env.EXPORT_SECRET!,  // For HMAC signatures
  s3Bucket: process.env.EXPORT_BUCKET!,       // S3 bucket name
  expiryDays: 7                               // Optional: days until expiration
});
```

### Request Export

```typescript
const result = await exportService.requestExport({
  user_id: 'user-uuid-123',
  format: 'json',
  include_sections: ['profile', 'badges', 'activity'],
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0...'
});

console.log(`Export requested: ${result.export_id}`);
// Export requested: 12345
```

### Process Export (Worker)

```typescript
await exportService.processExport(12345);
// Export 12345 completed successfully
```

### Get Download URL

```typescript
const download = await exportService.getDownloadUrl('user-uuid-123', 12345);
console.log(`Download: ${download.url}`);
console.log(`Expires: ${download.expires_at}`);
console.log(`Format: ${download.format}`);
console.log(`Size: ${download.size} bytes`);
```

## Export Worker

### Polling-based Worker (Development)

```typescript
import { ExportWorker } from './workers/export.worker';

const worker = new ExportWorker(pool, s3Client, {
  exportSecret: process.env.EXPORT_SECRET!,
  s3Bucket: process.env.EXPORT_BUCKET!
});

worker.start();

// Graceful shutdown
process.on('SIGINT', () => {
  worker.stop();
  process.exit(0);
});
```

### Worker Configuration

```typescript
const WORKER_CONFIG = {
  pollInterval: 5000,        // Poll every 5 seconds
  batchSize: 5,              // Process 5 exports at a time
  maxRetries: 3,             // Retry failed exports up to 3 times
  cleanupInterval: 3600000,  // Run cleanup every hour
};
```

### SQS-based Worker (Production)

For production deployments, use SQS for better scalability:

```typescript
import { ExportWorkerSQS } from './workers/export.worker';

const worker = new ExportWorkerSQS(pool, s3Client, {
  exportSecret: process.env.EXPORT_SECRET!,
  s3Bucket: process.env.EXPORT_BUCKET!,
  sqsQueueUrl: process.env.EXPORT_QUEUE_URL!
});

worker.start();
```

## JSON Export Format

```json
{
  "export_metadata": {
    "generated_at": "2025-10-29T10:02:34.567Z",
    "export_version": "1.0",
    "data_compliance": "GDPR, CCPA, BCEAO",
    "source": "Molam ID Platform",
    "signature_hmac_sha256": "abc123def456..."
  },
  "data": {
    "user": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john.doe@example.com",
      "phone_e164": "+221771234567",
      "first_name": "John",
      "last_name": "Doe",
      "preferred_language": "fr",
      "preferred_currency": "XOF",
      "created_at": "2024-01-15T08:30:00Z"
    },
    "profile": {
      "display_name": "John D.",
      "bio": "Software engineer from Dakar",
      "country_code": "SN",
      "city": "Dakar",
      "avatar_url": "https://...",
      "banner_url": "https://...",
      "badge_count": 3,
      "activity_count": 42
    },
    "badges": [
      {
        "badge_key": "verified",
        "badge_name": "Verified",
        "description": "Identity verified by Molam",
        "assigned_at": "2024-01-20T12:00:00Z"
      }
    ],
    "activity": [
      {
        "activity_type": "payment_sent",
        "activity_title": "Made a payment",
        "subsidiary_id": "pay",
        "created_at": "2025-10-28T14:30:00Z"
      }
    ],
    "privacy": {
      "visibility_display_name": "public",
      "visibility_bio": "contacts",
      "visibility_location": "public",
      "allow_activity_tracking": true,
      "allow_profile_indexing": false
    }
  },
  "signature": "abc123def456..."
}
```

## PDF Export Layout

```
┌─────────────────────────────────────────────────────────┐
│                           Molam                         │
│                 Personal Data Export                    │
│          Generated: October 29, 2025                    │
│       Molam Confidential - GDPR Export                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User Information                                       │
│  ───────────────                                        │
│  User ID: 550e8400-e29b-41d4-a716-446655440000         │
│  Email: john.doe@example.com                           │
│  Phone: +221771234567                                  │
│  Name: John Doe                                        │
│  Preferred Language: FR                                │
│  Preferred Currency: XOF                               │
│  Account Created: January 15, 2024                     │
│                                                         │
│  Profile                                               │
│  ───────                                               │
│  Display Name: John D.                                 │
│  Bio: Software engineer from Dakar                     │
│  Location: Dakar, SN                                   │
│  Badges: 3                                             │
│  Activities: 42                                        │
│                                                         │
│  Badges & Achievements                                 │
│  ──────────────────────                               │
│  • Verified (verified)                                 │
│    Identity verified by Molam                          │
│    Earned: January 20, 2024                            │
│                                                         │
│  Activity History (Last 90 Days)                       │
│  ────────────────────────────                          │
│  • Made a payment - October 28, 2025                   │
│  • Updated profile - October 25, 2025                  │
│  ...                                                   │
│                                                         │
│  Privacy Settings                                      │
│  ────────────────                                      │
│  Display Name Visibility: public                       │
│  Bio Visibility: contacts                              │
│  Location Visibility: public                           │
│  Activity Tracking: Enabled                            │
│  Profile Indexing: Disabled                            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  This export contains your personal data as stored     │
│  in the Molam platform. Generated in compliance with   │
│  GDPR, CCPA, and BCEAO regulations.                    │
│  For questions, contact: privacy@molam.com             │
└─────────────────────────────────────────────────────────┘
```

## Security

### HMAC Signature Verification

JSON exports include an HMAC-SHA256 signature for integrity verification:

```typescript
import crypto from 'crypto';

function verifyExport(exportData: any, exportSecret: string): boolean {
  const { signature, ...data } = exportData;
  const jsonData = JSON.stringify(data, null, 2);

  const computedSignature = crypto
    .createHmac('sha256', exportSecret)
    .update(jsonData)
    .digest('hex');

  return signature === computedSignature;
}
```

### S3 Security

- **Server-side encryption**: AES256 (SSE-S3)
- **Presigned URLs**: 1-hour validity
- **Bucket policy**: Private (no public access)
- **IAM roles**: Least-privilege access

### Rate Limiting

```typescript
// Export rate limiter (5 requests per hour)
const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many export requests. Please wait before requesting another export.'
});
```

### GDPR Compliance

- **Data portability**: JSON format for easy import to other services
- **Right to access**: Users can export all their data
- **Audit trail**: Complete log of all exports and downloads
- **Automatic deletion**: Exports expire after 7 days
- **Data minimization**: Only requested sections are included

## Observability

### Prometheus Metrics

```typescript
// Exports requested
exports_requested_total{format="json"} 1234
exports_requested_total{format="pdf"} 567

// Exports by status
exports_completed_total{format="json"} 1200
exports_failed_total{format="json"} 34
exports_expired_total{format="json"} 890

// Processing duration
export_processing_duration_seconds{format="json",quantile="0.5"} 2.3
export_processing_duration_seconds{format="pdf",quantile="0.95"} 5.7

// Downloads
exports_downloaded_total{format="json"} 1150
```

### Alerts

```yaml
groups:
  - name: exports
    rules:
      - alert: ExportBacklog
        expr: sum(molam_exports_pending) > 50
        for: 10m
        annotations:
          summary: "Export backlog over 50 requests"

      - alert: ExportFailureRate
        expr: rate(molam_exports_failed_total[1h]) > 0.1
        for: 5m
        annotations:
          summary: "Export failure rate above 10%"

      - alert: S3UploadErrors
        expr: rate(molam_s3_upload_errors_total[5m]) > 0
        for: 1m
        annotations:
          summary: "S3 upload errors detected"
```

## Testing

### Run Structure Tests

```bash
cd brique-30-export-profile
node test_structure.cjs
```

Expected output:
```
========================================
Brique 30: Export Profile Structure Tests
========================================

SQL Migration Tests:
✓ SQL migration file exists
✓ SQL creates molam_profile_exports table
...

========================================
Results: 47/47 tests passed
========================================
```

## Deployment

### 1. Database Migration

```bash
psql $DATABASE_URL -f sql/030_profile_export.sql
```

### 2. API Service

```bash
cd api
npm install
npm run build
npm start
```

Environment variables:
```bash
DATABASE_URL=postgresql://...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
EXPORT_BUCKET=molam-exports
EXPORT_SECRET=<secret-for-hmac-signature>
```

### 3. Export Worker

```bash
cd api
node src/workers/export.worker.js
```

Or deploy as separate service (Docker, ECS, Lambda).

### 4. Cron Job (Cleanup)

Add to crontab:
```bash
# Run cleanup daily at 2 AM
0 2 * * * psql $DATABASE_URL -c "SELECT cleanup_expired_exports()"
```

## Dependencies

### Backend
- `pg` ^8.11.3 (PostgreSQL client)
- `@aws-sdk/client-s3` ^3.400.0 (S3 operations)
- `@aws-sdk/s3-request-presigner` ^3.400.0 (presigned URLs)
- `pdfkit` ^0.13.0 (PDF generation)
- `express` ^4.18.2
- `express-rate-limit` ^6.10.0
- `zod` ^3.22.4 (validation)

## Roadmap

### Phase 1 (Current)
- ✅ JSON export with HMAC signature
- ✅ PDF export with branding
- ✅ Asynchronous processing
- ✅ S3 storage with presigned URLs
- ✅ Automatic expiration and cleanup
- ✅ Complete audit trail
- ✅ Rate limiting

### Phase 2 (Future)
- [ ] Email notification when export is ready
- [ ] Support for CSV format
- [ ] Scheduled exports (weekly, monthly)
- [ ] Export templates (customize sections)
- [ ] Encryption at rest (customer-managed keys)
- [ ] Export to external services (Google Drive, Dropbox)
- [ ] Bulk export for admin (multiple users)
- [ ] Export preview (before generating)

### Phase 3 (Advanced)
- [ ] Real-time export status via WebSocket
- [ ] Incremental exports (delta since last export)
- [ ] Export compression (ZIP archives)
- [ ] Multi-language PDF exports
- [ ] Digital signature (X.509 certificates)
- [ ] Blockchain-anchored exports (immutable proof)

## License

MIT

## Support

For issues or questions:
- GitHub: https://github.com/molam/molam-id/issues
- Email: privacy@molam.com
- Docs: https://docs.molam.com/briques/30-export-profile
