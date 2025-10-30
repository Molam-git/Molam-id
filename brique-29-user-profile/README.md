# Brique 29: User Profile Infrastructure

**Unified user profile layer for the Molam super app with S3 media storage, badge system, activity tracking, and GDPR compliance.**

## Overview

This brique provides a comprehensive profile infrastructure that allows users to:
- Create and manage rich profiles with avatars, banners, and personal information
- Earn and display badges awarded by subsidiary admins
- View privacy-aware activity feeds across all Molam modules
- Upload and manage media assets with async post-processing
- Control granular privacy settings for all profile fields
- Exercise GDPR rights (data export, rectification, deletion)

All operations are protected by Row-Level Security (RLS) and full audit trails are maintained for compliance.

## Features

### 1. User Profiles
- Display name, bio, location (country/city)
- Language and currency preferences (links to Briques 27 & 28)
- Avatar and banner images (S3-stored with signed URLs)
- Visibility controls (public, contacts, private)
- Auto-created on user registration

### 2. Badge System
- Managed by subsidiary roles (e.g., `pay_admin`, `eats_admin`)
- Pre-loaded global badges (Verified, Early Adopter)
- Subsidiary-specific badges (Agent, Merchant Star, Driver)
- Assignment/revocation with full audit trail
- Max count limits and utilization tracking
- User can hide badges from profile

### 3. Media Management
- S3-compatible storage with signed URL generation
- Async post-processing (thumbnail, resize variants)
- Image optimization with Sharp
- Content moderation workflow (pending → approved/rejected)
- Variants: thumbnail, small, medium, large (based on media type)
- Soft deletion for GDPR

### 4. Activity Tracking
- Cross-module activity feed (payments, orders, reviews, etc.)
- Privacy-aware visibility (public, contacts, private)
- Subsidiary tagging for module-specific activities
- Reference linking (to transactions, orders, etc.)
- Can be disabled per user (privacy setting)

### 5. Privacy Settings
- Granular field-level visibility controls:
  - Display name, bio, location, avatar, banner
  - Badges, activity feed
- Feature toggles:
  - Activity tracking on/off
  - Profile indexing (search engines) on/off
- All changes audited

### 6. GDPR Compliance
- Data export (JSON with all user data)
- Data rectification (update via API)
- Data deletion (anonymization with audit retention)
- Full audit trail (who changed what, when)
- Soft delete for media assets

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Applications                 │
│  (Web, iOS, Android, HarmonyOS, Desktop, Admin)        │
└──────────────────┬──────────────────────────────────────┘
                   │ MolamProfile SDK
                   │
┌──────────────────▼──────────────────────────────────────┐
│                    Profile API (Express)                │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Routes (RBAC + Rate Limiting)                    │ │
│  │  - Public: GET /profile/:userId                   │ │
│  │  - Auth: PUT /profile, POST /profile/media        │ │
│  │  - Admin: POST /admin/profile/badges/assign       │ │
│  └───────────────────┬───────────────────────────────┘ │
│                      │                                   │
│  ┌───────────────────▼───────────────────────────────┐ │
│  │  ProfileService                                   │ │
│  │  - Profile CRUD                                   │ │
│  │  - S3 media upload/download                       │ │
│  │  - Badge assignment/revocation                    │ │
│  │  - Activity logging                               │ │
│  │  - Privacy management                             │ │
│  │  - GDPR operations                                │ │
│  └───────────────────┬───────────────────────────────┘ │
└────────────────────┬─┴───────────────────────────────────┘
                     │           │
        ┌────────────▼───┐  ┌───▼─────────────┐
        │   PostgreSQL   │  │  AWS S3/Minio   │
        │   (Profiles,   │  │  (Media Assets) │
        │   Badges, RLS) │  │                 │
        └────────────────┘  └─────────────────┘
                                      │
                            ┌─────────▼──────────┐
                            │   Media Worker     │
                            │  (Sharp, Variants) │
                            └────────────────────┘
```

## Database Schema

### Tables

1. **molam_user_profiles**
   - Profile data (display name, bio, location, preferences)
   - Avatar/banner asset references
   - Cached counts (badges, activities)
   - Visibility level (default privacy)

2. **molam_media_assets**
   - S3 storage metadata (bucket, key, region)
   - File info (name, size, mime type)
   - Processing status (pending, processing, completed, failed)
   - Moderation status (pending, approved, rejected)
   - Variants JSON (thumbnails, resized versions)
   - Signed URL cache with expiration

3. **molam_badges**
   - Badge definition (key, name, description, icon, color)
   - Subsidiary ownership (NULL = global)
   - Required role to assign/revoke
   - Revokability flag
   - Max count limit

4. **molam_user_badges**
   - Badge assignment with assigned_by/assigned_at
   - Revocation tracking (revoked_by/revoked_at/revoked_reason)
   - Visibility flag (user can hide)
   - Metadata JSONB for extra data

5. **molam_user_activity**
   - Activity type, title, subtitle
   - Subsidiary and reference tagging
   - Activity data JSONB
   - Visibility (public, contacts, private)
   - IP and user agent for audit

6. **molam_user_privacy**
   - Field-level visibility settings
   - Feature toggles (tracking, indexing)

7. **molam_profile_audit**
   - Complete audit trail (INSERT, UPDATE, DELETE)
   - Old/new values (JSONB)
   - Actor, IP, user agent

### Key Functions

```sql
-- Get profile with privacy filtering
get_user_profile(p_user_id UUID, p_viewer_id UUID) → profile

-- Get user badges (visible only)
get_user_badges(p_user_id UUID) → badge[]

-- Get activity feed (privacy-aware)
get_user_activity_feed(p_user_id UUID, p_viewer_id UUID, limit, offset) → activity[]

-- Assign badge (with RBAC check placeholder)
assign_badge(p_user_id UUID, p_badge_id UUID, p_assigned_by UUID, p_reason TEXT) → user_badge_id

-- Revoke badge (checks is_revokable)
revoke_badge(p_user_badge_id UUID, p_revoked_by UUID, p_reason TEXT) → boolean

-- Log activity (respects privacy settings)
log_user_activity(...) → activity_id

-- GDPR: Get all user data
get_all_user_data(p_user_id UUID) → JSONB

-- GDPR: Delete all user data (anonymize)
delete_all_user_data(p_user_id UUID) → boolean
```

### Views

- **v_active_badges**: Active badge assignments with user/subsidiary details
- **v_badge_statistics**: Badge utilization and coverage
- **v_user_profile_summary**: Profile summary with user email

### Triggers

- **Auto-update `updated_at`** on profiles, media, badges, privacy
- **Audit trail logging** on profile changes
- **Cached counts update** (badge_count, activity_count)
- **Auto-create profile** when user registers

### Row-Level Security (RLS)

All tables have RLS enabled with policies:
- **Own data**: Users can SELECT/UPDATE their own profiles, media, privacy, activity
- **Admin access**: Admins can view all data (via service layer role escalation)

## API Routes

### Public Routes (No Auth)

```typescript
GET    /api/profile/:userId              // Get user profile (privacy-filtered)
GET    /api/profile/:userId/badges       // Get user badges
GET    /api/profile/:userId/activity     // Get activity feed (privacy-aware)
```

### Authenticated Routes (Own Profile)

```typescript
PUT    /api/profile                      // Update own profile
POST   /api/profile/media                // Upload media (avatar, banner, attachment)
GET    /api/profile/media/:id/signed-url // Get signed URL for media
DELETE /api/profile/media/:id            // Delete own media
GET    /api/profile/privacy              // Get privacy settings
PUT    /api/profile/privacy              // Update privacy settings
DELETE /api/profile/activity/:id         // Delete own activity
GET    /api/profile/export               // Export all data (GDPR)
```

### Admin Routes (RBAC Required)

```typescript
GET    /api/admin/profile/badges                  // List all badges
POST   /api/admin/profile/badges/assign           // Assign badge
POST   /api/admin/profile/badges/revoke           // Revoke badge
GET    /api/admin/profile/badges/statistics       // Badge statistics
POST   /api/admin/profile/media/:id/moderate      // Moderate media
GET    /api/admin/profile/statistics              // Profile statistics
DELETE /api/admin/profile/:userId                 // Delete user profile (GDPR)
```

### Rate Limiting

- **Public**: 100 req/15min per IP
- **Authenticated**: 300 req/15min per user
- **Upload**: 50 uploads/hour per user

## Media Processing

### Upload Flow

1. Client uploads file via `POST /api/profile/media`
2. File stored in S3 at `users/{userId}/{mediaType}/{assetId}.{ext}`
3. Database record created with status `pending`
4. Worker polls for pending assets
5. Worker generates variants (thumbnail, small, medium, large)
6. Variants uploaded to S3 with `_thumbnail`, `_small`, etc. suffixes
7. Asset updated to `completed` with variants JSON

### Variants Configuration

**Avatar**:
- Thumbnail: 64x64 (cover, 85% quality)
- Small: 150x150 (cover, 85% quality)
- Medium: 300x300 (cover, 90% quality)

**Banner**:
- Thumbnail: 400x150 (cover, 85% quality)
- Medium: 800x300 (cover, 90% quality)
- Large: 1600x600 (cover, 90% quality)

**Attachment**:
- Thumbnail: 200x200 (contain, 85% quality)
- Preview: 800px width (contain, 90% quality)

### Worker Deployment

**Development** (polling):
```bash
node api/src/workers/media.worker.js
```

**Production** (SQS):
- Uncomment `MediaWorkerSQS` class in worker file
- Configure SQS queue URL
- Deploy as separate service (ECS, Lambda, etc.)

## SDK Usage

### Initialization

```typescript
import { MolamProfile } from '@molam/profile-sdk';

const profile = new MolamProfile({
  apiBaseUrl: 'https://api.molam.com',
  authToken: 'jwt-token-here',
  onAuthError: () => {
    // Redirect to login
    window.location.href = '/login';
  }
});
```

### Profile Operations

```typescript
// Get user profile
const userProfile = await profile.getProfile('user-id');
console.log(userProfile.display_name, userProfile.badge_count);

// Update own profile
await profile.updateProfile({
  display_name: 'John Doe',
  bio: 'Software engineer from Dakar',
  country_code: 'SN',
  city: 'Dakar',
  preferred_language: 'fr',
  preferred_currency: 'XOF'
});

// Export data (GDPR)
const data = await profile.exportData();
```

### Media Operations

```typescript
// Upload avatar
const file = document.querySelector('input[type="file"]').files[0];

// Validate
const validation = validateImageFile(file, 10); // 10MB max
if (!validation.valid) {
  alert(validation.error);
  return;
}

// Upload with progress
const asset = await profile.uploadAvatar(file, (progress) => {
  console.log(`Upload: ${progress}%`);
});

console.log('Avatar uploaded:', asset.asset_id);
// Profile automatically updated with avatar_url

// Get signed URL
const signedUrl = await profile.getSignedMediaUrl(asset.asset_id, 3600);
console.log('Accessible for 1 hour:', signedUrl);
```

### Badge Operations

```typescript
// Get user badges
const badges = await profile.getUserBadges('user-id');
badges.forEach((badge) => {
  console.log(`${badge.badge_name}: ${badge.description}`);
});

// Admin: Assign badge
await profile.assignBadge('user-id', 'badge-id', 'Great performance!');
```

### Activity Operations

```typescript
// Get user activity
const { activities, pagination } = await profile.getUserActivity('user-id', {
  limit: 20,
  offset: 0
});

activities.forEach((activity) => {
  console.log(formatActivityTime(activity.created_at), activity.activity_title);
});

// Delete own activity
await profile.deleteActivity('activity-id');
```

### Privacy Operations

```typescript
// Get privacy settings
const privacy = await profile.getPrivacySettings();

// Update privacy
await profile.updatePrivacySettings({
  visibility_display_name: 'public',
  visibility_bio: 'contacts',
  visibility_activity: 'private',
  allow_activity_tracking: true,
  allow_profile_indexing: false
});
```

## Admin Dashboard

### Features

**Statistics Tab**:
- Total profiles, profiles with avatar/banner/bio
- Total badges assigned, total activities
- Media storage usage

**Badge Management Tab**:
- Badge statistics with utilization
- Assign/revoke badges
- Subsidiary filtering

**Moderation Tab**:
- Pending media approval
- Approve/reject with reasons
- Preview images

### Integration

```typescript
import ProfileAdmin from '@molam/profile-admin/ProfileAdmin';

function App() {
  return (
    <Router>
      <Route path="/admin/profiles" element={<ProfileAdmin />} />
    </Router>
  );
}
```

## Security

### Authentication & Authorization

- **JWT RS256** for authentication
- **RBAC** for admin operations (admin, moderator roles)
- **Subsidiary-scoped badges**: Only `pay_admin` can assign MolamPay badges
- **RLS** ensures users can only access their own data

### S3 Security

- **Signed URLs** with TTL (default 1 hour, max 24 hours)
- **Bucket policies** restrict public access
- **IAM roles** for service-to-S3 communication
- **Encryption at rest** (S3 SSE-AES256)

### Privacy

- **Field-level visibility** (public, contacts, private)
- **Activity tracking opt-out** (user can disable)
- **Profile indexing opt-out** (for search engines)
- **Soft delete** for media (GDPR retention)

### Rate Limiting

- **Public**: 100 req/15min per IP
- **Auth**: 300 req/15min per user
- **Upload**: 50 uploads/hour per user

## GDPR Compliance

### Data Export

```bash
GET /api/profile/export
```

Returns JSON with all user data:
- Profile, privacy settings
- Badges, activity
- Media assets
- Full audit trail

### Data Rectification

Users can update any profile field via:
```bash
PUT /api/profile
PUT /api/profile/privacy
```

### Data Deletion

```bash
DELETE /api/admin/profile/:userId  # Admin only
```

Anonymizes:
- Display name → "Deleted User"
- Bio, location, avatar, banner → NULL
- Activity → deleted
- Badges → revoked
- Media → soft deleted

**Audit trail retained** for legal/compliance reasons.

## Observability

### Metrics (Prometheus)

```typescript
// Profile operations
molam_profile_get_total
molam_profile_update_total
molam_profile_delete_total

// Media operations
molam_media_upload_total
molam_media_upload_bytes_total
molam_media_processing_duration_seconds
molam_media_moderation_pending

// Badge operations
molam_badge_assign_total
molam_badge_revoke_total
molam_badge_utilization_pct

// Activity
molam_activity_log_total

// Errors
molam_profile_errors_total{operation, error_type}
```

### Alerts

```yaml
- alert: MediaProcessingBacklog
  expr: molam_media_moderation_pending > 100
  for: 30m
  annotations:
    summary: "Media processing backlog over 100"

- alert: ProfileServiceDown
  expr: up{job="profile-service"} == 0
  for: 5m

- alert: S3ErrorRate
  expr: rate(molam_profile_errors_total{error_type="s3"}[5m]) > 0.1
  for: 5m
```

## Testing

### Run Structure Tests

```bash
cd brique-29-user-profile
node test_structure.cjs
```

Expected output:
```
========================================
Brique 29: User Profile Structure Tests
========================================

SQL Migration Tests:
✓ SQL migration file exists
✓ SQL creates molam_user_profiles table
...

========================================
Results: 60/60 tests passed
========================================
```

### Run Integration Tests

```bash
npm test
```

## Deployment

### 1. Database Migration

```bash
psql $DATABASE_URL -f sql/029_user_profile.sql
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
S3_BUCKET=molam-user-media
```

### 3. Media Worker

```bash
cd api
node src/workers/media.worker.js
```

Or deploy as separate service (Docker, ECS, Lambda).

### 4. Admin Dashboard

```bash
cd admin
npm install
npm run build
# Serve build/ directory
```

## Dependencies

### Backend
- `express` ^4.18.2
- `pg` ^8.11.3 (PostgreSQL client)
- `@aws-sdk/client-s3` ^3.400.0 (S3 operations)
- `@aws-sdk/s3-request-presigner` ^3.400.0 (signed URLs)
- `multer` ^1.4.5-lts.1 (file upload)
- `sharp` ^0.32.6 (image processing)
- `express-rate-limit` ^6.10.0
- `uuid` ^9.0.1

### SDK
- `axios` ^1.6.2

### Admin
- `react` ^18.2.0
- `react-dom` ^18.2.0

## Roadmap

### Phase 1 (Current)
- ✅ Basic profile CRUD
- ✅ S3 media storage with signed URLs
- ✅ Badge system with RBAC
- ✅ Activity tracking
- ✅ Privacy settings
- ✅ GDPR compliance
- ✅ Media worker with variants
- ✅ Admin dashboard

### Phase 2 (Future)
- [ ] Profile verification workflow (KYC)
- [ ] Social connections (contacts, followers)
- [ ] Profile themes/customization
- [ ] Badge marketplace (users create/sell badges)
- [ ] Advanced media: video support, live streaming
- [ ] Activity feed with reactions (like, comment)
- [ ] Profile analytics dashboard (views, engagement)
- [ ] Profile templates for merchants
- [ ] Multi-factor auth integration (link to Brique 11)
- [ ] Profile import/export to other services

### Phase 3 (Advanced)
- [ ] AI-powered profile suggestions
- [ ] Automated moderation with ML
- [ ] Profile reputation score
- [ ] Decentralized identity (DID) integration
- [ ] Profile NFTs (badges as NFTs)

## License

MIT

## Support

For issues or questions:
- GitHub: https://github.com/molam/molam-id/issues
- Email: dev@molam.com
- Docs: https://docs.molam.com/briques/29-user-profile
